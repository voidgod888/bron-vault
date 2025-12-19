import { executeQuery } from "../lib/db"

async function main() {
  console.log("🚀 Starting migration: Add last_message_id to sources")

  try {
    // Check if column exists
    const checkQuery = `
      SELECT count(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sources'
      AND COLUMN_NAME = 'last_message_id'
    `
    const result = await executeQuery(checkQuery) as any[]

    if (result[0].count > 0) {
      console.log("⚠️ Column last_message_id already exists in sources table")
    } else {
      console.log("Adding last_message_id column...")
      await executeQuery(`
        ALTER TABLE sources
        ADD COLUMN last_message_id BIGINT DEFAULT 0 AFTER last_scraped_at
      `)
      console.log("✅ Column added successfully")
    }

  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }
}

main().catch(console.error)
