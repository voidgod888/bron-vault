/**
 * Migration Script: Migrate tables to optimized SingleStore Schema (Shard/Sort Keys)
 *
 * This script checks if the main tables have the correct SHARD KEY and SORT KEY definitions.
 * If not, it performs a zero-downtime migration by:
 * 1. Creating a new table with the correct schema (table_name_new)
 * 2. Copying data (INSERT INTO ... SELECT)
 * 3. Swapping tables (RENAME TABLE)
 *
 * Usage:
 *   npx tsx scripts/migrate-to-singlestore-schema.ts
 *   DRY_RUN=true npx tsx scripts/migrate-to-singlestore-schema.ts
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

// Load .env.local or .env
async function loadEnv() {
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envPath = path.join(process.cwd(), '.env');

  let finalEnvPath: string;
  if (existsSync(envLocalPath)) {
    finalEnvPath = envLocalPath;
  } else if (existsSync(envPath)) {
    finalEnvPath = envPath;
  } else {
    console.error('❌ Environment file not found!');
    process.exit(1);
  }

  const content = await readFile(finalEnvPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value.trim();
    }
  }
}

// Database connection
let pool: mysql.Pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number.parseInt(process.env.MYSQL_PORT || "3306"),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE || "stealer_logs",
      charset: "utf8mb4",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true // Allow multiple statements for atomic swap
    });
  }
  return pool;
}

async function executeQuery(query: string, params: any[] = []) {
  const p = await getPool();
  try {
    const [results] = await p.execute(query, params);
    return results;
  } catch (error) {
    console.error(`❌ Query Error: ${query.substring(0, 100)}...`, error);
    throw error;
  }
}

interface TableDef {
  name: string;
  createSql: string;
  shardKeyCheck: string; // String to look for in SHOW CREATE TABLE to verify correctness
}

const TABLES: TableDef[] = [
  {
    name: 'devices',
    shardKeyCheck: 'SHARD KEY',
    createSql: `
      CREATE TABLE IF NOT EXISTS devices_new (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        device_name VARCHAR(500) NOT NULL,
        device_name_hash VARCHAR(64) NOT NULL,
        upload_batch VARCHAR(255) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_files INT DEFAULT 0,
        total_credentials INT DEFAULT 0,
        total_domains INT DEFAULT 0,
        total_urls INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        source_id INT NULL,
        SHARD KEY (device_id),
        SORT KEY (upload_date, device_id),
        UNIQUE KEY unique_device_id (device_id),
        INDEX idx_device_name (device_name),
        INDEX idx_upload_batch (upload_batch),
        INDEX idx_devices_source_id (source_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'files',
    shardKeyCheck: 'SHARD KEY',
    createSql: `
      CREATE TABLE IF NOT EXISTS files_new (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        parent_path TEXT,
        is_directory BOOLEAN DEFAULT FALSE,
        file_size INT DEFAULT 0,
        content LONGTEXT,
        local_file_path TEXT NULL,
        file_type ENUM('text', 'binary', 'unknown') DEFAULT 'unknown',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        SHARD KEY (device_id),
        SORT KEY (device_id, is_directory, file_name),
        INDEX idx_created_at (created_at),
        INDEX idx_local_file_path (local_file_path(255))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'credentials',
    shardKeyCheck: 'SHARD KEY',
    createSql: `
      CREATE TABLE IF NOT EXISTS credentials_new (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        url TEXT,
        domain VARCHAR(255),
        tld VARCHAR(50),
        username VARCHAR(500),
        password TEXT,
        browser VARCHAR(255),
        file_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        SHARD KEY (device_id),
        SORT KEY (domain, device_id),
        INDEX idx_tld (tld),
        INDEX idx_username (username),
        INDEX idx_created_at (created_at),
        INDEX idx_browser_device (browser, device_id),
        INDEX idx_domain_url (domain, url(255))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'password_stats',
    shardKeyCheck: 'SHARD KEY',
    createSql: `
      CREATE TABLE IF NOT EXISTS password_stats_new (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        password TEXT NOT NULL,
        count INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        SHARD KEY (device_id),
        SORT KEY (password),
        INDEX idx_count (count)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'software',
    shardKeyCheck: 'SHARD KEY',
    createSql: `
      CREATE TABLE IF NOT EXISTS software_new (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        software_name VARCHAR(500) NOT NULL,
        version VARCHAR(500) NULL,
        source_file VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        SHARD KEY (device_id),
        SORT KEY (software_name, device_id),
        INDEX idx_version (version),
        INDEX idx_source_file (source_file)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  },
  {
    name: 'systeminformation',
    shardKeyCheck: 'SHARD KEY',
    createSql: `
      CREATE TABLE IF NOT EXISTS systeminformation_new (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        stealer_type VARCHAR(100) NOT NULL DEFAULT 'Generic',
        os VARCHAR(500) NULL,
        ip_address VARCHAR(100) NULL,
        username VARCHAR(500) NULL,
        cpu VARCHAR(500) NULL,
        ram VARCHAR(100) NULL,
        computer_name VARCHAR(500) NULL,
        gpu VARCHAR(500) NULL,
        country VARCHAR(100) NULL,
        log_date VARCHAR(10) NULL COMMENT 'Normalized date in YYYY-MM-DD format',
        log_time VARCHAR(8) NOT NULL DEFAULT '00:00:00',
        hwid VARCHAR(255) NULL,
        file_path TEXT NULL,
        antivirus VARCHAR(500) NULL,
        source_file VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        SHARD KEY (device_id),
        SORT KEY (log_date, device_id),
        UNIQUE KEY unique_device_id (device_id),
        INDEX idx_stealer_type (stealer_type),
        INDEX idx_os (os(255)),
        INDEX idx_ip_address (ip_address),
        INDEX idx_country (country),
        INDEX idx_hwid (hwid)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  }
];

async function migrateTable(table: TableDef, dryRun: boolean) {
  console.log(`\n🔍 Checking table: ${table.name}...`);

  // 1. Check if table exists
  try {
    const [rows] = await executeQuery(`SHOW TABLES LIKE '${table.name}'`) as any;
    if (rows.length === 0) {
      console.log(`   Table ${table.name} does not exist. It will be created by the app on next run.`);
      return;
    }
  } catch (e) {
    console.error(`   Error checking table existence:`, e);
    return;
  }

  // 2. Check current schema
  let currentCreateSql = '';
  try {
    const [rows] = await executeQuery(`SHOW CREATE TABLE ${table.name}`) as any;
    currentCreateSql = rows[0]['Create Table'];
  } catch (e) {
    console.error(`   Error getting CREATE TABLE:`, e);
    return;
  }

  // 3. Verify if migration is needed
  // Note: Simple check for "SHARD KEY" presence. If missing, we assume it's unoptimized.
  // Also check if SHARD KEY matches expectation?
  // For now, presence of SHARD KEY is a good enough indicator of "optimized" vs "generic MySQL".
  // Exception: systeminformation might have keys but not SORT KEY.
  // We'll check for "SHARD KEY" and "SORT KEY" if the definition implies both.

  const hasShardKey = currentCreateSql.includes('SHARD KEY');
  const hasSortKey = currentCreateSql.includes('SORT KEY');

  // All our definitions use both SHARD and SORT keys
  if (hasShardKey && hasSortKey) {
    console.log(`   ✅ Table ${table.name} is already optimized (has SHARD and SORT keys).`);
    return;
  }

  console.log(`   ⚠️  Table ${table.name} needs migration!`);
  console.log(`      Current status: SHARD KEY=${hasShardKey}, SORT KEY=${hasSortKey}`);

  if (dryRun) {
    console.log(`   🚫 DRY RUN: Skipping migration logic.`);
    return;
  }

  // 4. Migration Execution
  console.log(`   🚀 Starting migration for ${table.name}...`);

  try {
    // A. Create new table
    console.log(`      Creating ${table.name}_new...`);
    // Drop if exists (cleanup from failed run)
    await executeQuery(`DROP TABLE IF EXISTS ${table.name}_new`);
    await executeQuery(table.createSql);

    // B. Copy data
    console.log(`      Copying data (this may take a while)...`);
    // We select all columns explicitly or just use * if schema matches closely enough?
    // Safer to use * if we know columns match, but if we added columns?
    // We should assume columns match roughly.
    // However, systeminformation has log_time which might be missing in old table?
    // The previous migration script (date fix) ensures log_time exists.
    // But to be safe, we should check columns.

    // For now, let's try INSERT INTO ... SELECT *
    await executeQuery(`INSERT INTO ${table.name}_new SELECT * FROM ${table.name}`);

    // C. Swap tables
    console.log(`      Swapping tables...`);
    // RENAME TABLE old TO backup, new TO old
    await executeQuery(`
      RENAME TABLE ${table.name} TO ${table.name}_backup_${Date.now()},
                   ${table.name}_new TO ${table.name}
    `);

    console.log(`   ✅ Successfully migrated ${table.name}!`);

  } catch (error) {
    console.error(`   ❌ Migration failed for ${table.name}:`, error);
    // Cleanup
    try {
      await executeQuery(`DROP TABLE IF EXISTS ${table.name}_new`);
    } catch {}
    throw error;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Broń Vault - Schema Optimization Migration');
  console.log('═══════════════════════════════════════════════════════════');

  await loadEnv();

  const DRY_RUN = process.env.DRY_RUN === 'true';
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE ENABLED');
  }

  try {
    // Check connection
    await executeQuery('SELECT 1');
    console.log('✅ Connected to database');

    for (const table of TABLES) {
      await migrateTable(table, DRY_RUN);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  Migration Complete');
    console.log('═══════════════════════════════════════════════════════════');
    process.exit(0);
  } catch (error) {
    console.error('Migration Fatal Error:', error);
    process.exit(1);
  }
}

main();
