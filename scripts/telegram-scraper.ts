import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions"
import { executeQuery, initializeDatabase } from "../lib/db"
import { processFileUploadFromPath } from "../lib/upload/file-upload-processor"
import { telegramConfig } from "../lib/telegram-config"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { pipeline } from "stream"
// @ts-ignore
import mime from "mime-types"

// Ensure dynamic imports for GramJS to avoid issues in some environments (e.g. Next.js edge, though this is a script)
// Keeping imports standard here as it's a standalone script.

const streamPipeline = promisify(pipeline)

async function getSources() {
  // Use SingleStore query
  return await executeQuery("SELECT * FROM sources WHERE enabled = TRUE AND type = 'telegram'") as any[]
}

async function updateLastScraped(id: number) {
  // Use SingleStore query
  await executeQuery("UPDATE sources SET last_scraped_at = NOW() WHERE id = ?", [id])
}

async function downloadMedia(client: TelegramClient, message: any, downloadDir: string): Promise<string | null> {
  try {
      if (!message.media) return null

      const buffer = await client.downloadMedia(message, {
          workers: 1,
      } as any)

      if (!buffer) return null

      let fileName = "unknown"
      // Try to get filename from attributes
      if (message.media.document && message.media.document.attributes) {
          for (const attr of message.media.document.attributes) {
              if (attr.className === "DocumentAttributeFilename") {
                  fileName = attr.fileName
                  break
              }
          }
      }

      // If no filename, generate one based on mime type or date
      if (fileName === "unknown") {
          const ext = mime.extension(message.media.document?.mimeType) || "bin"
          fileName = `file_${message.id}.${ext}`
      }

      const filePath = path.join(downloadDir, fileName)
      await fs.promises.writeFile(filePath, buffer)
      return filePath

  } catch (error) {
      console.error(`Failed to download media for message ${message.id}:`, error)
      return null
  }
}

async function main() {
  console.log("🚀 Starting Telegram Scraper (SingleStore Enabled)...")

  // 1. Initialize DB (ensures schema and connection)
  await initializeDatabase()

  // 2. Load Config
  const config = await telegramConfig.getConfig()
  if (!config.apiId || !config.apiHash || !config.session) {
    console.error("❌ Telegram not configured. Please configure it in the dashboard.")
    process.exit(1)
  }

  // 3. Connect to Telegram
  const client = new TelegramClient(new StringSession(config.session), Number(config.apiId), config.apiHash, {
    connectionRetries: 5,
  })

  await client.connect()
  console.log("✅ Connected to Telegram")

  // 4. Get Sources
  const sources = await getSources()
  console.log(`📋 Found ${sources.length} active sources`)

  // Ensure download directory exists
  const downloadDir = path.join(process.cwd(), "downloads_temp")
  if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true })
  }

  // 5. Iterate Sources
  for (const source of sources) {
    console.log(`\n🔍 Scraping source: ${source.name} (${source.identifier})`)

    try {
        // Resolve entity (channel/user)
        const entity = await client.getEntity(source.identifier)

        // Fetch messages (limit to last 20 for now)
        const messages = await client.getMessages(entity, { limit: 20 })

        console.log(`   Found ${messages.length} messages`)

        for (const message of messages) {
            // Check if message has file
            const media = message.media as any;
            if (media && media.document) {
                const mimeType = media.document.mimeType
                const isZip = mimeType === "application/zip" || mimeType === "application/x-zip-compressed"
                const isTxt = mimeType === "text/plain"

                if (isZip || isTxt) {
                    console.log(`   ⬇️ Downloading message ${message.id}...`)
                    const filePath = await downloadMedia(client, message, downloadDir)

                    if (filePath) {
                        console.log(`   📦 Processing ${path.basename(filePath)}...`)

                        // Define a logger for the processor
                        const logger = (msg: string, type: any) => console.log(`      [Processor] ${type?.toUpperCase() || 'INFO'}: ${msg}`)

                        // Process the file
                        if (filePath.toLowerCase().endsWith(".zip")) {
                             await processFileUploadFromPath(
                                filePath,
                                path.basename(filePath),
                                "telegram_scraper",
                                logger,
                                true, // Delete after processing
                                source.id // Pass source ID
                            )
                        } else {
                            console.log("      ⚠️ Non-zip files not yet fully supported by processor directly (needs packing). Skipping for now.")
                            // TODO: Implement text file handling (e.g. read and insert directly or wrap in zip)
                            fs.unlinkSync(filePath)
                        }
                    }
                }
            }
        }

        await updateLastScraped(source.id)

    } catch (error) {
        console.error(`❌ Error scraping ${source.name}:`, error)
    }
  }

  console.log("\n✅ Scraping cycle complete.")
  // In a real loop, we would wait here. For now, exit.
  process.exit(0)
}

main().catch(console.error)
