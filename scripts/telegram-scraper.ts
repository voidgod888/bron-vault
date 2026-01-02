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
import JSZip from "jszip"
import PQueue from "p-queue"
import os from "os"
import { createExtractorFromData } from "node-unrar-js"

const streamPipeline = promisify(pipeline)

interface ScraperSource {
  id: number
  name: string
  identifier: string
  last_message_id: number
  last_scraped_at: string
}

export class TelegramScraper {
  private client: TelegramClient | null = null
  private downloadQueue: PQueue
  private downloadDir: string
  private isShuttingDown: boolean = false

  constructor() {
    // Dynamic concurrency based on CPU cores, with a safeguard
    const cpuCount = os.cpus().length
    // Minimum 1, max 4 (to avoid flood limits more than CPU limits) or CPU-1
    const concurrency = Math.max(1, Math.min(4, cpuCount - 1))

    console.log(`🚀 Initializing Telegram Scraper with concurrency: ${concurrency}`)

    this.downloadQueue = new PQueue({ concurrency })

    this.downloadDir = path.join(process.cwd(), "downloads_temp")
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true })
    }

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown())
    process.on('SIGTERM', () => this.shutdown())
  }

  private async shutdown() {
    console.log("\n⚠️ Shutting down gracefully... waiting for pending tasks.")
    this.isShuttingDown = true
    this.downloadQueue.pause()
    await this.downloadQueue.onIdle()
    console.log("✅ All tasks completed. Exiting.")
    process.exit(0)
  }

  async init() {
    await initializeDatabase()

    const config = await telegramConfig.getConfig()
    if (!config.apiId || !config.apiHash || !config.session) {
      console.error("❌ Telegram not configured. Please configure it in the dashboard.")
      process.exit(1)
    }

    this.client = new TelegramClient(new StringSession(config.session), Number(config.apiId), config.apiHash, {
      connectionRetries: 5,
    })

    await this.client.connect()
    console.log("✅ Connected to Telegram")
  }

  async getSources(): Promise<ScraperSource[]> {
    return await executeQuery("SELECT * FROM sources WHERE enabled = TRUE AND type = 'telegram'") as any[]
  }

  async updateLastMessageId(sourceId: number, messageId: number) {
    await executeQuery("UPDATE sources SET last_message_id = ?, last_scraped_at = NOW() WHERE id = ?", [messageId, sourceId])
  }

  async processRarFile(filePath: string): Promise<string | null> {
    try {
      console.log(`      📦 Converting RAR to ZIP: ${path.basename(filePath)}`)
      const fileBuffer = await fs.promises.readFile(filePath)

      // Open RAR using node-unrar-js
      const extractor = await createExtractorFromData({ data: fileBuffer.buffer })
      const list = extractor.getFileList()
      const files = [...list.fileHeaders] // Consume iterator

      if (files.length === 0) {
        console.warn(`      ⚠️ Empty RAR file: ${path.basename(filePath)}`)
        return null
      }

      const zip = new JSZip()
      const extracted = extractor.extract()
      for (const file of extracted.files) {
         if (file.fileHeader.flags.directory) continue; // Skip directories
         // Add to zip
         // file.extraction is Uint8Array
         if(file.extraction) {
             zip.file(file.fileHeader.name, file.extraction)
         }
      }

      const zipPath = filePath + ".zip"
      const zipContent = await zip.generateAsync({ type: "nodebuffer" })
      await fs.promises.writeFile(zipPath, zipContent)

      // Cleanup original RAR
      await fs.promises.unlink(filePath)

      return zipPath
    } catch (error) {
      console.error(`      ❌ Failed to convert RAR ${path.basename(filePath)}:`, error)
      return null
    }
  }

  async processTextFile(filePath: string): Promise<string | null> {
    try {
      console.log(`      📦 Converting Text to ZIP: ${path.basename(filePath)}`)
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
      console.error(`      ❌ Failed to zip text file ${filePath}:`, error)
      return null
    }
  }

  async downloadMedia(message: any): Promise<string | null> {
    if (!this.client) return null
    if (!message.media) return null

    try {
      // Check for FloodWait inside download logic or retry wrapper?
      // GramJS usually handles it, but let's be safe.

      const buffer = await this.client.downloadMedia(message, {
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

      // If no filename, generate one
      if (fileName === "unknown") {
          const ext = mime.extension(message.media.document?.mimeType) || "bin"
          fileName = `file_${message.id}.${ext}`
      }

      const filePath = path.join(this.downloadDir, fileName)
      await fs.promises.writeFile(filePath, buffer)
      return filePath

    } catch (error: any) {
      if (error.errorMessage === 'FLOOD') {
         console.log(`⏳ FloodWait: waiting for ${error.seconds} seconds...`)
         await new Promise(resolve => setTimeout(resolve, error.seconds * 1000))
         return this.downloadMedia(message)
      }
      console.error(`Failed to download media for message ${message.id}:`, error)
      return null
    }
  }

  async processSource(source: ScraperSource) {
    if (this.isShuttingDown || !this.client) return

    console.log(`\n🔍 Scraping source: ${source.name} (${source.identifier})`)

    try {
        let entity;
        try {
           entity = await this.client.getEntity(source.identifier)
        } catch (e) {
           console.error(`❌ Failed to resolve entity ${source.identifier}:`, e)
           return
        }

        const lastMessageId = Number(source.last_message_id || 0)
        console.log(`   Last message ID: ${lastMessageId}`)

        const options: any = { limit: 20 }
        if (lastMessageId > 0) {
             options.minId = lastMessageId
             options.limit = 50 // Slightly higher for incremental catch-up
        }

        const messages = await this.client.getMessages(entity, options)
        console.log(`   Found ${messages.length} new messages`)

        let maxId = lastMessageId

        // Process messages oldest to newest
        const sortedMessages = messages.reverse()

        for (const message of sortedMessages) {
            if (this.isShuttingDown) break

            if (message.id > maxId) maxId = message.id

            const media = message.media as any;
            if (media && media.document) {
                const mimeType = media.document.mimeType
                // We trust extension check more often for rar/zip because mime types vary
                let fileName = "unknown"
                if (media.document.attributes) {
                    for (const attr of media.document.attributes) {
                        if (attr.className === "DocumentAttributeFilename") {
                            fileName = attr.fileName
                            break
                        }
                    }
                }

                const lowerName = fileName.toLowerCase()
                const isZip = mimeType === "application/zip" || mimeType === "application/x-zip-compressed" || lowerName.endsWith(".zip")
                const isRar = mimeType === "application/x-rar-compressed" || lowerName.endsWith(".rar")
                const isTxt = mimeType === "text/plain" || lowerName.endsWith(".txt")

                if (isZip || isRar || isTxt) {
                    // Queue download task
                    const task = this.downloadQueue.add(async () => {
                        console.log(`   ⬇️ [${source.name}] Downloading message ${message.id} (${fileName})...`)
                        let filePath = await this.downloadMedia(message)

                        if (filePath) {
                            // Conversion logic
                            if (isTxt) {
                                filePath = await this.processTextFile(filePath)
                            } else if (isRar) {
                                filePath = await this.processRarFile(filePath)
                            }

                            if (filePath && filePath.endsWith(".zip")) {
                                console.log(`   📦 Processing ${path.basename(filePath)}...`)
                                const logger = (msg: string, type: any) => console.log(`      [Processor] ${type?.toUpperCase() || 'INFO'}: ${msg}`)

                                try {
                                    await processFileUploadFromPath(
                                        filePath,
                                        path.basename(filePath),
                                        "telegram_scraper",
                                        logger,
                                        true, // Delete after processing
                                        source.id
                                    )
                                } catch (e) {
                                    console.error(`      ❌ Processing failed:`, e)
                                }
                            } else {
                                // Cleanup if conversion failed
                                if (filePath) try { await fs.promises.unlink(filePath) } catch {}
                            }
                        }
                    })
                    // No await here, let queue handle it
                }
            }
        }

        // Wait for all tasks in this batch (source) to complete before updating state
        await this.downloadQueue.onIdle()

        // Update state in DB
        if (maxId > lastMessageId) {
            await this.updateLastMessageId(source.id, maxId)
            console.log(`   ✅ Source ${source.name} updated to ID ${maxId}`)
        }

    } catch (error: any) {
        if (error.errorMessage === 'FLOOD') {
           console.log(`⏳ FloodWait on source ${source.name}: waiting for ${error.seconds} seconds...`)
        } else {
           console.error(`❌ Error scraping ${source.name}:`, error)
        }
    }
  }

  async run() {
    const args = process.argv.slice(2)
    const daemonMode = args.includes('--daemon')

    await this.init()

    while (!this.isShuttingDown) {
      const sources = await this.getSources()
      console.log(`📋 Found ${sources.length} active sources`)

      // Process sources sequentially (or with limited concurrency if desired, but we have internal queue)
      // Since we want to respect rate limits, processing sources one by one but downloading in parallel (via queue) is safer.
      // Or we can process sources in parallel.
      // Let's stick to batching sources to avoid hitting "GetMessages" limits too fast.

      for (const source of sources) {
          if (this.isShuttingDown) break
          await this.processSource(source)

          // Wait a bit between sources
          await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // Wait for queue to drain before finishing cycle (optional, but good for cleanliness)
      await this.downloadQueue.onIdle()

      console.log("\n✅ Scraping cycle complete.")

      if (!daemonMode) {
          break
      }

      const waitTime = 5 * 60 * 1000 // 5 minutes
      console.log(`💤 Sleeping for ${waitTime / 1000}s...`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    await this.shutdown()
  }
}

new TelegramScraper().run().catch(console.error)
