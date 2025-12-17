import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { Api } from "telegram/tl";
import { settingsManager, SETTING_KEYS } from "../lib/settings";
import { processFileUploadFromPath } from "../lib/upload/file-upload-processor";
import * as fs from "fs";
import * as path from "path";
import { ensureAppSettingsTable } from "../lib/mysql";

// Logger helper
const log = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
};

class TelegramScraper {
  private client: TelegramClient | null = null;
  private isRunning = false;
  private bytesDownloaded = 0;
  private lastResetTime = Date.now();
  private readonly DOWNLOAD_LIMIT = 100 * 1024 * 1024 * 1024; // 100 GB
  private readonly RESET_INTERVAL = 60 * 60 * 1000; // 1 hour

  constructor() {}

  async start() {
    if (this.isRunning) {
      log("Scraper is already running", "warning");
      return;
    }

    try {
      await ensureAppSettingsTable();

      const enabled = await settingsManager.getSettingBoolean(SETTING_KEYS.TELEGRAM_SCRAPER_ENABLED, false);
      if (!enabled) {
        log("Telegram scraper is disabled in settings. Exiting...", "info");
        return;
      }

      log("Starting Telegram Scraper...", "info");

      // Load settings
      const apiId = await settingsManager.getSettingString(SETTING_KEYS.TELEGRAM_API_ID);
      const apiHash = await settingsManager.getSettingString(SETTING_KEYS.TELEGRAM_API_HASH);
      const sessionString = await settingsManager.getSettingString(SETTING_KEYS.TELEGRAM_SESSION);
      const channelsStr = await settingsManager.getSettingString(SETTING_KEYS.TELEGRAM_CHANNELS);

      if (!apiId || !apiHash || !sessionString) {
        log("Missing Telegram credentials. Please configure them in Settings.", "error");
        return;
      }

      // Initialize client
      this.client = new TelegramClient(
        new StringSession(sessionString),
        Number(apiId),
        apiHash,
        {
          connectionRetries: 5,
        }
      );

      await this.client.connect();
      log("Connected to Telegram!", "success");

      // Load throttling state
      this.bytesDownloaded = await settingsManager.getSettingNumber(SETTING_KEYS.TELEGRAM_BYTES_DOWNLOADED, 0);
      this.lastResetTime = await settingsManager.getSettingNumber(SETTING_KEYS.TELEGRAM_LAST_RESET_TIME, Date.now());

      // Parse channels
      const channels = channelsStr
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (channels.length === 0) {
        log("No channels configured. Waiting for configuration...", "warning");
      } else {
        log(`Monitoring channels: ${channels.join(", ")}`, "info");

        // Add event handler
        this.client.addEventHandler(
          (event) => this.handleNewMessage(event),
          new NewMessage({ chats: channels })
        );
      }

      this.isRunning = true;

      // Keep process alive
      // In a real script, we might need a better way to keep it running if the client disconnects
      // but TelegramClient usually handles reconnection.

    } catch (error) {
      log(`Failed to start scraper: ${error}`, "error");
      process.exit(1);
    }
  }

  private async handleNewMessage(event: any) {
    try {
      const message = event.message;

      if (!message || !message.file) {
        return;
      }

      // Check throttling
      this.checkThrottling();
      if (this.bytesDownloaded >= this.DOWNLOAD_LIMIT) {
        log("Download limit reached (100GB/hour). Skipping download.", "warning");
        return;
      }

      // Check file type
      const mimeType = message.file.mimeType || "";
      const fileName = message.file.name || "unknown";

      if (!fileName.endsWith(".zip") && !fileName.endsWith(".rar") && !mimeType.includes("zip")) {
        // Only interested in archives
        return;
      }

      log(`Found file: ${fileName} in ${message.chatId}`, "info");

      // Download file
      const buffer = await this.client?.downloadMedia(message, {});

      if (!buffer || buffer.length === 0) {
        log("Failed to download file or empty buffer", "error");
        return;
      }

      // Update usage
      this.bytesDownloaded += buffer.length;
      await this.saveThrottlingState();

      // Save to disk temporarily
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const tempFilePath = path.join(uploadsDir, `telegram_${Date.now()}_${fileName}`);
      fs.writeFileSync(tempFilePath, buffer);

      log(`Downloaded ${fileName} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`, "success");

      // Process file
      log("Processing file...", "info");

      // We need to define a logging callback compatible with the processor
      const logCallback = (msg: string, type: "info" | "success" | "warning" | "error" = "info") => {
        log(`[Processor] ${msg}`, type);
      };

      try {
        const result = await processFileUploadFromPath(
          tempFilePath,
          fileName,
          "telegram-scraper",
          logCallback,
          true // Delete after processing
        );

        if (result.success) {
          log(`Successfully processed ${fileName}`, "success");
        } else {
          log(`Failed to process ${fileName}: ${result.error}`, "error");
        }
      } catch (procError) {
        log(`Error processing file ${fileName}: ${procError}`, "error");
      }

    } catch (error) {
      log(`Error handling message: ${error}`, "error");
    }
  }

  private checkThrottling() {
    const now = Date.now();
    if (now - this.lastResetTime > this.RESET_INTERVAL) {
      // Reset limit
      this.bytesDownloaded = 0;
      this.lastResetTime = now;
      this.saveThrottlingState();
      log("Throttling limit reset", "info");
    }
  }

  private async saveThrottlingState() {
    try {
      await settingsManager.updateSetting(SETTING_KEYS.TELEGRAM_BYTES_DOWNLOADED, this.bytesDownloaded);
      await settingsManager.updateSetting(SETTING_KEYS.TELEGRAM_LAST_RESET_TIME, this.lastResetTime);
    } catch (error) {
      console.error("Failed to save throttling state", error);
    }
  }
}

// Start scraper
const scraper = new TelegramScraper();
scraper.start().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
