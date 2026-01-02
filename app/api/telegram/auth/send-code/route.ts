import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { settingsManager, SETTING_KEYS } from "@/lib/settings";
import { authState } from "@/lib/telegram-auth-state";

export async function POST(request: NextRequest) {
  const user = await validateRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { apiId, apiHash, phone } = body;

    if (!apiId || !apiHash || !phone) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Save initial settings
    await settingsManager.updateSetting(SETTING_KEYS.TELEGRAM_API_ID, apiId);
    await settingsManager.updateSetting(SETTING_KEYS.TELEGRAM_API_HASH, apiHash);
    await settingsManager.updateSetting(SETTING_KEYS.TELEGRAM_PHONE, phone);

    // Initialize client with empty session
    const client = new TelegramClient(new StringSession(""), Number(apiId), apiHash, {
      connectionRetries: 5,
    });

    await client.connect();

    // Send code
    const { phoneCodeHash } = await client.sendCode(
      {
        apiId: Number(apiId),
        apiHash,
      },
      phone
    );

    // Save session string (which now contains the auth state needed to verify the code)
    const sessionString = client.session.save() as unknown as string;

    // Store state in Redis
    await authState.set(phone, {
      phoneCodeHash,
      sessionString,
    });

    // Disconnect client - we'll reconnect in the next step using the saved session
    await client.disconnect();

    return NextResponse.json({ success: true, phoneCodeHash });
  } catch (error) {
    console.error("Telegram send code error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
