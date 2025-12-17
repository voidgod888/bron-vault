import mysql from "mysql2/promise"
import fs from "fs"
import path from "path"

const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number.parseInt(process.env.MYSQL_PORT || "3306"),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "bronvaultnew",
  multipleStatements: true, // Needed for running SQL files with multiple statements
}

export async function runSqlFile(filePath: string) {
  try {
    const sql = fs.readFileSync(filePath, "utf8")
    const connection = await mysql.createConnection(dbConfig)

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
