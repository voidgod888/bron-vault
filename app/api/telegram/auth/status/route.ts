import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { settingsManager, SETTING_KEYS } from "@/lib/settings";

export async function GET(request: NextRequest) {
  const user = await validateRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const session = await settingsManager.getSettingString(SETTING_KEYS.TELEGRAM_SESSION, "");
    const isConnected = !!session && session.length > 0;

    // Also return other settings
    const apiId = await settingsManager.getSettingString(SETTING_KEYS.TELEGRAM_API_ID, "");
    const apiHash = await settingsManager.getSettingString(SETTING_KEYS.TELEGRAM_API_HASH, "");
    const phone = await settingsManager.getSettingString(SETTING_KEYS.TELEGRAM_PHONE, "");
    const channels = await settingsManager.getSettingString(SETTING_KEYS.TELEGRAM_CHANNELS, "");
    const isEnabled = await settingsManager.getSettingBoolean(SETTING_KEYS.TELEGRAM_SCRAPER_ENABLED, false);

    return NextResponse.json({
      success: true,
      isConnected,
      settings: {
        apiId,
        apiHash,
        phone,
        channels,
        isEnabled
      }
    });
  } catch (error) {
    console.error("Telegram status error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
