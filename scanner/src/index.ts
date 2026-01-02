import Redis from 'ioredis';
import mysql, { PoolOptions } from 'mysql2/promise';
import axios from 'axios';
import net from 'net';
import { promises as dns } from 'dns';
import sslChecker from 'ssl-checker';
import winston from 'winston';

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Environment variables
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// SingleStore (MySQL compatible) configuration
// Matches ../lib/db.ts
const MYSQL_CONFIG: PoolOptions = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'stealer_logs',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
  flags: ['-FOUND_ROWS'] // SingleStore specific
};

// Top ports to scan
const PORTS_TO_SCAN = [
  21, 22, 23, 25, 53, 80, 110, 143, 443, 465, 587, 993, 995, 3306, 3389, 5432, 8080, 8443
];

// Redis connection
const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

// MySQL connection pool
const pool = mysql.createPool(MYSQL_CONFIG);

async function scanPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000); // 2s timeout

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

interface WebData {
  status?: number | null;
  title?: string | null;
  server?: string | null;
  error?: string;
}

async function getWebData(domain: string): Promise<WebData> {
  try {
    const response = await axios.get(`http://${domain}`, {
      timeout: 5000,
      maxContentLength: 500000, // Limit to 500KB
      validateStatus: () => true // Accept all status codes
    });

    // Extract title
    const titleMatch = response.data.toString().match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : null;

    return {
      status: response.status,
      title: title ? title.substring(0, 255) : null, // Truncate
      server: response.headers['server'] ? (response.headers['server'] as string).substring(0, 255) : null
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

interface SslData {
  valid: boolean;
  issuer: string | null;
  expiry: Date;
}

async function getSslData(domain: string): Promise<SslData | null> {
  try {
    const sslData = await sslChecker(domain, { method: "GET", port: 443 }) as any;
    return {
      valid: sslData.valid,
      issuer: sslData.issuer ? (sslData.issuer.O || sslData.issuer.CN || null) : null,
      expiry: new Date(sslData.validTo)
    };
  } catch (error) {
    return null;
  }
}

async function processDomain(domain: string, priority: string) {
  logger.info(`Starting scan for ${domain} (Priority: ${priority})`);

  // 1. Resolve DNS
  let ip: string | null = null;
  try {
    const addresses = await dns.resolve4(domain);
    ip = addresses[0];
  } catch (error: any) {
    logger.error(`DNS Resolution failed for ${domain}: ${error.message}`);
    // Update status to failed
    await pool.execute(
        'INSERT INTO scanned_hosts (domain, scan_status, error_message, priority) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE scan_status = ?, error_message = ?',
        [domain, 'failed', 'DNS resolution failed', priority, 'failed', 'DNS resolution failed']
    );
    return;
  }

  // 2. Scan Ports
  const openPorts: number[] = [];
  for (const port of PORTS_TO_SCAN) {
    if (ip) {
        const isOpen = await scanPort(ip, port);
        if (isOpen) openPorts.push(port);
    }
  }

  // 3. Web Data (if 80 or 443 open)
  let webData: WebData = {};
  if (openPorts.includes(80) || openPorts.includes(443)) {
    webData = await getWebData(domain);
  }

  // 4. SSL Data (if 443 open)
  let sslData: SslData | null = null;
  if (openPorts.includes(443)) {
    sslData = await getSslData(domain);
  }

  // 5. Save Results
  try {
    await pool.execute(
      `INSERT INTO scanned_hosts
       (domain, ip_address, ports, http_status, http_title, http_server, ssl_issuer, ssl_expiry, scan_status, priority, scan_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
       ip_address = VALUES(ip_address),
       ports = VALUES(ports),
       http_status = VALUES(http_status),
       http_title = VALUES(http_title),
       http_server = VALUES(http_server),
       ssl_issuer = VALUES(ssl_issuer),
       ssl_expiry = VALUES(ssl_expiry),
       scan_status = VALUES(scan_status),
       priority = VALUES(priority),
       scan_date = NOW()`,
      [
        domain,
        ip,
        JSON.stringify(openPorts),
        webData.status || null,
        webData.title || null,
        webData.server || null,
        sslData ? sslData.issuer : null,
        sslData ? sslData.expiry : null,
        'completed',
        priority
      ]
    );
    logger.info(`Scan completed for ${domain}`);
  } catch (error: any) {
    logger.error(`Database save failed for ${domain}: ${error.message}`);
  }
}

async function main() {
  logger.info("Scanner Worker Started (SingleStore)");

  // Ensure Redis connection
  redis.on('error', (err) => logger.error('Redis Client Error', err));

  while (true) {
    try {
      // Blocking pop from 'scanner_queue'
      const result = await redis.blpop('scanner_queue', 0);
      if (result) {
        const data = JSON.parse(result[1]);
        await processDomain(data.domain, data.priority || 'low');
      }
    } catch (error: any) {
      logger.error(`Worker Loop Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before retrying
    }
  }
}

main();
