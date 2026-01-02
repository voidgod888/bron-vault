import mysql from "mysql2/promise"
import fs from "fs"
import path from "path"
import { dbConfig } from "../lib/db"

export async function runSqlFile(filePath: string) {
  try {
    const sql = fs.readFileSync(filePath, "utf8")
    // Use the imported config but ensure multipleStatements is true
    const connection = await mysql.createConnection({
        ...dbConfig,
        multipleStatements: true
    })

    console.log(`Running SQL from ${filePath}...`)
    await connection.query(sql)
    console.log("Done.")

    await connection.end()
  } catch (error) {
    console.error("Error running SQL file:", error)
  }
}

// If executed directly
if (require.main === module) {
    const file = process.argv[2]
    if (!file) {
        console.error("Please provide an SQL file path.")
        process.exit(1)
    }
    runSqlFile(path.resolve(file))
}
