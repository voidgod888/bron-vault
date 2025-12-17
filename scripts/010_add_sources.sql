-- =====================================================
-- Migration: Add Sources and Telegram Support
-- =====================================================

-- 1. Create sources table
CREATE TABLE IF NOT EXISTS sources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(255) NOT NULL, -- Channel ID or Username
    type VARCHAR(50) DEFAULT 'telegram',
    enabled BOOLEAN DEFAULT TRUE,
    last_scraped_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY idx_identifier_type (identifier, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add source_id to devices table
-- We use a stored procedure to safely add the column if it doesn't exist
DELIMITER //

CREATE PROCEDURE AddSourceIdToDevices()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.columns
        WHERE table_schema = DATABASE()
        AND table_name = 'devices'
        AND column_name = 'source_id'
    ) THEN
        ALTER TABLE devices ADD COLUMN source_id INT NULL;
        ALTER TABLE devices ADD CONSTRAINT fk_devices_source
            FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL;
        CREATE INDEX idx_devices_source_id ON devices(source_id);
    END IF;
END //

DELIMITER ;

CALL AddSourceIdToDevices();
DROP PROCEDURE IF EXISTS AddSourceIdToDevices;
