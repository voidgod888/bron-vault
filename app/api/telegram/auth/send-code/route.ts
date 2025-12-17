import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { settingsManager, SETTING_KEYS } from "@/lib/settings";
import { authClients } from "@/lib/telegram-auth-state";

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

    // Initialize client
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

    // Store client for the next step (verify code)
    // We use the phone number as the key
    authClients.set(phone, client);

    // Set a timeout to clean up the client if not used
    setTimeout(() => {
      if (authClients.has(phone)) {
        authClients.get(phone)?.disconnect();
        authClients.delete(phone);
      }
    }, 300000); // 5 minutes

    return NextResponse.json({ success: true, phoneCodeHash });
  } catch (error) {
    console.error("Telegram send code error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Exporting authClients creates a conflict with Next.js route types.
// We should move this state to a separate file or keep it internal if not needed elsewhere.
// Since it's used in other routes, we'll move it to lib/telegram-auth-state.ts (simulated here by just NOT exporting it from route)
// Wait, if other routes import it, removing export breaks them.
// But Next.js complains about exporting it from a route file.
// Correct fix: Move shared state to a separate file.
