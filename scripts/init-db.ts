
import { initializeDatabase } from '../lib/db';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Load .env.local or .env
async function loadEnv() {
  // Try .env.local first, then fallback to .env
  const envLocalPath = path.join(process.cwd(), '.env.local');
  const envPath = path.join(process.cwd(), '.env');

  let finalEnvPath: string;
  if (existsSync(envLocalPath)) {
    finalEnvPath = envLocalPath;
  } else if (existsSync(envPath)) {
    finalEnvPath = envPath;
  } else {
    console.error('❌ Environment file not found!');
    console.error('   Please create .env.local or .env with MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE');
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

  // Verify required env vars
  const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error(`   Please check your ${finalEnvPath.includes('.env.local') ? '.env.local' : '.env'} file`);
    process.exit(1);
  }

  console.log(`✅ Environment variables loaded from ${finalEnvPath.includes('.env.local') ? '.env.local' : '.env'}`);
}

async function main() {
  try {
    console.log('📋 Loading environment variables...');
    await loadEnv();

    console.log('\n--- Initializing Database Schema ---');
    await initializeDatabase();

    console.log('\n✅ Database initialization completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error);
    process.exit(1);
  }
}

main();
