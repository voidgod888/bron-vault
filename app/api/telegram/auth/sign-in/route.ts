import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { settingsManager, SETTING_KEYS } from "@/lib/settings";
import { authState } from "@/lib/telegram-auth-state";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

export async function POST(request: NextRequest) {
  const user = await validateRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { phone, code, phoneCodeHash } = body;

    if (!phone || !code || !phoneCodeHash) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Retrieve state from Redis
    const savedState = await authState.get(phone);
    if (!savedState || savedState.phoneCodeHash !== phoneCodeHash) {
      return NextResponse.json(
        { success: false, error: "Auth session expired or not found. Please try again." },
        { status: 400 }
      );
    }

    // Reconstruct client from session string
    const apiId = await settingsManager.getSetting<string>(SETTING_KEYS.TELEGRAM_API_ID);
    const apiHash = await settingsManager.getSetting<string>(SETTING_KEYS.TELEGRAM_API_HASH);

    if (!apiId || !apiHash) {
        return NextResponse.json({ success: false, error: "Configuration lost. Please try again." }, { status: 500 });
    }

    const client = new TelegramClient(
        new StringSession(savedState.sessionString),
        Number(apiId),
        apiHash,
        { connectionRetries: 5 }
    );

    await client.connect();

    // Sign in
    const { Api } = await import("telegram/tl");
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash: phoneCodeHash,
        phoneCode: code,
      })
    );

    // Save session string
    const sessionString = client.session.save() as unknown as string;
    await settingsManager.updateSetting(SETTING_KEYS.TELEGRAM_SESSION, sessionString);

    // Clean up
    await client.disconnect();
    await authState.delete(phone);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Telegram sign in error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
