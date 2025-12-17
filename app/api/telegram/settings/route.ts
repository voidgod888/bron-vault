import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/lib/auth";
import { settingsManager, SETTING_KEYS } from "@/lib/settings";

export async function POST(request: NextRequest) {
  const user = await validateRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { channels, isEnabled } = body;

    if (channels !== undefined) {
      await settingsManager.updateSetting(SETTING_KEYS.TELEGRAM_CHANNELS, channels);
    }

    if (isEnabled !== undefined) {
      await settingsManager.updateSetting(SETTING_KEYS.TELEGRAM_SCRAPER_ENABLED, isEnabled);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Telegram settings update error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
