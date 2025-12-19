import { TelegramClient } from "telegram"
import { StringSession } from "telegram/sessions"
import { executeQuery, initializeDatabase } from "../lib/mysql"
import { processFileUploadFromPath } from "../lib/upload/file-upload-processor"
import { telegramConfig } from "../lib/telegram-config"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { pipeline } from "stream"
import input from "input" // Optional, for CLI interaction if needed
// @ts-ignore
import mime from "mime-types"
import JSZip from "jszip"

const streamPipeline = promisify(pipeline)

// Simple state management for incremental scraping
const STATE_FILE = path.join(process.cwd(), "telegram_scraper_state.json")

interface ScraperState {
  [sourceId: number]: {
    lastMessageId: number
    lastScrapedAt: string
  }
}

function loadState(): ScraperState {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
    } catch (e) {
      console.error("⚠️ Failed to load state file, starting fresh", e)
    }
  }
  return {}
}

function saveState(state: ScraperState) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  } catch (e) {
    console.error("⚠️ Failed to save state file", e)
  }
}

async function getSources() {
  return await executeQuery("SELECT * FROM sources WHERE enabled = TRUE AND type = 'telegram'") as any[]
}

async function updateLastScraped(id: number) {
  await executeQuery("UPDATE sources SET last_scraped_at = NOW() WHERE id = ?", [id])
}

async function downloadMedia(client: TelegramClient, message: any, downloadDir: string): Promise<string | null> {
  try {
      if (!message.media) return null

      // Check for FloodWait
      try {
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
      } catch (error: any) {
        if (error.errorMessage === 'FLOOD') {
           console.log(`⏳ FloodWait: waiting for ${error.seconds} seconds...`)
           await new Promise(resolve => setTimeout(resolve, error.seconds * 1000))
           // Retry once recursively
           return downloadMedia(client, message, downloadDir)
        }
        throw error
      }

  } catch (error) {
      console.error(`Failed to download media for message ${message.id}:`, error)
      return null
  }
}

// Wrap text file in a zip
async function zipTextFile(filePath: string): Promise<string | null> {
  try {
    const zip = new JSZip()
    const content = await fs.promises.readFile(filePath)
    const fileName = path.basename(filePath)
    zip.file(fileName, content)

    const zipPath = filePath + ".zip"
    const zipContent = await zip.generateAsync({ type: "nodebuffer" })
    await fs.promises.writeFile(zipPath, zipContent)

    // Delete original text file
    await fs.promises.unlink(filePath)

    return zipPath
  } catch (error) {
    console.error(`Failed to zip text file ${filePath}:`, error)
    return null
  }
}

async function processSource(client: TelegramClient, source: any, state: ScraperState, downloadDir: string) {
    console.log(`\n🔍 Scraping source: ${source.name} (${source.identifier})`)

    try {
        // Resolve entity (channel/user)
        let entity;
        try {
           entity = await client.getEntity(source.identifier)
        } catch (e) {
           console.error(`❌ Failed to resolve entity ${source.identifier}:`, e)
           return
        }

        const sourceState = state[source.id] || { lastMessageId: 0, lastScrapedAt: '' }
        const lastMessageId = sourceState.lastMessageId

        console.log(`   Last message ID: ${lastMessageId}`)

        // Fetch messages
        // If we have a lastMessageId, we try to fetch messages since then.
        // Limit to 50 to avoid huge fetches
        const options: any = { limit: 20 }
        if (lastMessageId > 0) {
             options.minId = lastMessageId
             // If we are incremental, we might want to fetch more to catch up, but let's stick to batches
             // to avoid overloading.
             options.limit = 50
        }

        const messages = await client.getMessages(entity, options)
        console.log(`   Found ${messages.length} new messages`)

        let maxId = lastMessageId
        let processedCount = 0

        // Reverse to process oldest first (so we update maxId correctly as we go)
        for (const message of messages.reverse()) {
            if (message.id > maxId) maxId = message.id

            // Check if message has file
            const media = message.media as any;
            if (media && media.document) {
                const mimeType = media.document.mimeType
                const isZip = mimeType === "application/zip" || mimeType === "application/x-zip-compressed"
                const isTxt = mimeType === "text/plain"

                if (isZip || isTxt) {
                    console.log(`   ⬇️ [${source.name}] Downloading message ${message.id}...`)
                    let filePath = await downloadMedia(client, message, downloadDir)

                    if (filePath) {
                        // Handle Text Files by zipping them
                        if (isTxt || !filePath.toLowerCase().endsWith(".zip")) {
                             console.log(`      Converting text file to ZIP...`)
                             const zippedPath = await zipTextFile(filePath)
                             if (zippedPath) {
                               filePath = zippedPath
                             } else {
                               console.error(`      Failed to zip file, skipping.`)
                               // Cleanup
                               try { await fs.promises.unlink(filePath) } catch {}
                               continue
                             }
                        }

                        console.log(`   📦 Processing ${path.basename(filePath)}...`)

                        // Define a logger for the processor
                        const logger = (msg: string, type: any) => console.log(`      [Processor] ${type?.toUpperCase() || 'INFO'}: ${msg}`)

                        try {
                             await processFileUploadFromPath(
                                filePath,
                                path.basename(filePath),
                                "telegram_scraper",
                                logger,
                                true, // Delete after processing
                                source.id // Pass source ID
                            )
                            processedCount++
                        } catch (e) {
                            console.error(`      ❌ Processing failed:`, e)
                        }
                    }
                }
            }
        }

        // Update state
        if (maxId > lastMessageId) {
            state[source.id] = {
                lastMessageId: maxId,
                lastScrapedAt: new Date().toISOString()
            }
            saveState(state)
        }

        await updateLastScraped(source.id)
        console.log(`   ✅ Processed ${processedCount} files. New last ID: ${maxId}`)

    } catch (error: any) {
        if (error.errorMessage === 'FLOOD') {
           console.log(`⏳ FloodWait on source ${source.name}: waiting for ${error.seconds} seconds...`)
           // We don't wait here to block everything, we just skip this source for now
        } else {
           console.error(`❌ Error scraping ${source.name}:`, error)
        }
    }
}

async function main() {
  const args = process.argv.slice(2)
  const daemonMode = args.includes('--daemon')

  console.log("🚀 Starting Telegram Scraper" + (daemonMode ? " (Daemon Mode)" : "") + "...")

  // 1. Initialize DB
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

  // Ensure download directory exists
  const downloadDir = path.join(process.cwd(), "downloads_temp")
  if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true })
  }

  // Run Loop
  while (true) {
      // 4. Get Sources
      const sources = await getSources()
      console.log(`📋 Found ${sources.length} active sources`)

      // Load State
      const state = loadState()

      // 5. Process Sources with Concurrency
      // We'll process in batches of 3 to allow some concurrency but prevent flood
      const BATCH_SIZE = 3
      for (let i = 0; i < sources.length; i += BATCH_SIZE) {
          const batch = sources.slice(i, i + BATCH_SIZE)
          console.log(`\n🔄 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(sources.length/BATCH_SIZE)}`)

          await Promise.all(batch.map((source: any) => processSource(client, source, state, downloadDir)))

          // Small pause between batches to be nice to Telegram API
          if (i + BATCH_SIZE < sources.length) {
              await new Promise(resolve => setTimeout(resolve, 2000))
          }
      }

      console.log("\n✅ Scraping cycle complete.")

      if (!daemonMode) {
          break
      }

      // Wait for next cycle (e.g., 5 minutes)
      const waitTime = 5 * 60 * 1000 // 5 minutes
      console.log(`💤 Sleeping for ${waitTime / 1000}s...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  process.exit(0)
}

main().catch(console.error)
