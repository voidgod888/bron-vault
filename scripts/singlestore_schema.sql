-- =====================================================
-- Complete SingleStore Database Schema
-- =====================================================

-- IMPORTANT: Explicitly create and select database for bootstrap
CREATE DATABASE IF NOT EXISTS stealer_logs;
USE stealer_logs;

-- =====================================================
-- Table: devices
-- High-volume table, main entity.
-- Shard by device_id for uniform distribution.
-- Sort by upload_date for time-series analytics.
-- =====================================================
CREATE TABLE IF NOT EXISTS devices (
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
    KEY idx_device_name (device_name),
    KEY idx_upload_batch (upload_batch),
    UNIQUE KEY unique_device_id (device_id)
);

-- =====================================================
-- Table: files
-- High-volume table.
-- Shard by device_id to co-locate with devices.
-- Sort by device_id and file_name for listing files per device.
-- =====================================================
CREATE TABLE IF NOT EXISTS files (
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
    KEY idx_created_at (created_at),
    KEY idx_local_file_path (local_file_path(255))
);

-- =====================================================
-- Table: credentials
-- High-volume table.
-- Shard by device_id.
-- Sort by domain and device_id for fast domain reconnaissance.
-- =====================================================
CREATE TABLE IF NOT EXISTS credentials (
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
    KEY idx_tld (tld),
    KEY idx_username (username),
    KEY idx_created_at (created_at),
    KEY idx_browser_device (browser, device_id),
    KEY idx_domain_url (domain, url(255))
);

-- =====================================================
-- Table: password_stats
-- Analytical table for top passwords.
-- Shard by device_id.
-- Sort by password for aggregation.
-- =====================================================
CREATE TABLE IF NOT EXISTS password_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    count INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    SHARD KEY (device_id),
    SORT KEY (password),
    KEY idx_count (count)
);

-- =====================================================
-- Table: analytics_cache
-- Operational table for caching heavy query results.
-- =====================================================
CREATE TABLE IF NOT EXISTS analytics_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cache_data LONGTEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    SHARD KEY (cache_key),
    KEY idx_expires_at (expires_at)
);

-- =====================================================
-- Table: software
-- Analytical table for installed software.
-- =====================================================
CREATE TABLE IF NOT EXISTS software (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(255) NOT NULL,
    software_name VARCHAR(500) NOT NULL,
    version VARCHAR(500) NULL,
    source_file VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    SHARD KEY (device_id),
    SORT KEY (software_name, device_id),
    KEY idx_version (version),
    KEY idx_source_file (source_file)
);

-- =====================================================
-- Table: systeminformation
-- Detailed device info.
-- =====================================================
CREATE TABLE IF NOT EXISTS systeminformation (
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
    KEY idx_stealer_type (stealer_type),
    KEY idx_os (os(255)),
    KEY idx_ip_address (ip_address),
    KEY idx_country (country),
    KEY idx_hwid (hwid)
);

-- =====================================================
-- Table: app_settings
-- Small configuration table.
-- =====================================================
CREATE TABLE IF NOT EXISTS app_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(255) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    SHARD KEY (id)
);

-- =====================================================
-- Table: users
-- Small user table.
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    SHARD KEY (id)
);

-- =====================================================
-- Table: scanned_hosts
-- Scanner results.
-- Shard by domain.
-- =====================================================
CREATE TABLE IF NOT EXISTS scanned_hosts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(100),
    ports JSON,
    http_status INT,
    http_title TEXT,
    http_server VARCHAR(255),
    ssl_issuer VARCHAR(255),
    ssl_expiry DATETIME,
    scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    priority ENUM('high', 'low') DEFAULT 'low',
    scan_status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    SHARD KEY (domain),
    SORT KEY (scan_date),
    KEY idx_ip_address (ip_address),
    KEY idx_scan_status (scan_status)
);

-- =====================================================
-- Table: saved_searches
-- =====================================================
CREATE TABLE IF NOT EXISTS saved_searches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  query TEXT NOT NULL,
  search_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  SHARD KEY (id)
);

-- =====================================================
-- Table: detection_rules
-- =====================================================
CREATE TABLE IF NOT EXISTS detection_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  pattern TEXT NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  SHARD KEY (id)
);

-- =====================================================
-- Table: sources
-- =====================================================
CREATE TABLE IF NOT EXISTS sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  identifier VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'telegram',
  enabled BOOLEAN DEFAULT TRUE,
  last_scraped_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  SHARD KEY (id),
  UNIQUE KEY idx_identifier_type (identifier, type)
);

-- Insert default admin user
INSERT IGNORE INTO users (email, password_hash, name) VALUES
    ('admin@bronvault.local', '$2b$12$V3YGoZlvgABmhIbt7H0ZyeygLONKnSe1TKuvp8OwEvc4u7nFWUUd.', 'Admin');

-- Insert default app settings
INSERT IGNORE INTO app_settings (key_name, value, description) VALUES
    ('upload_max_file_size', '10737418240', 'Maximum file upload size in bytes (default: 10GB)'),
    ('upload_chunk_size', '10485760', 'Chunk size for large file uploads in bytes (default: 10MB)'),
    ('upload_max_concurrent_chunks', '3', 'Maximum concurrent chunk uploads (default: 3)'),
    ('db_batch_size_credentials', '1000', 'Batch size for credentials bulk insert (default: 1000)'),
    ('db_batch_size_password_stats', '500', 'Batch size for password stats bulk insert (default: 500)'),
    ('db_batch_size_files', '500', 'Batch size for files bulk insert (default: 500)'),
    ('file_write_parallel_limit', '10', 'Maximum concurrent file writes (default: 10)');
