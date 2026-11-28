
USE secure_vault;

-- =========================================================
-- FILE SHARES
-- =========================================================

CREATE TABLE IF NOT EXISTS file_shares (
    share_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    file_id BIGINT UNSIGNED NOT NULL,
    owner_user_id BIGINT UNSIGNED NOT NULL,

    share_token_hash CHAR(64) NOT NULL,

    recipient_email VARCHAR(255) DEFAULT NULL,

    permission_type ENUM('VIEW', 'DOWNLOAD')
        NOT NULL DEFAULT 'VIEW',

    watermark_enabled TINYINT(1)
        NOT NULL DEFAULT 0,

    expires_at DATETIME DEFAULT NULL,

    max_downloads INT UNSIGNED DEFAULT NULL,
    download_count INT UNSIGNED NOT NULL DEFAULT 0,

    -- Independent opening limit and counter.
    max_opens INT UNSIGNED DEFAULT NULL,
    open_count INT UNSIGNED NOT NULL DEFAULT 0,

    revoked TINYINT(1) NOT NULL DEFAULT 0,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (share_id),

    UNIQUE KEY uq_file_shares_token_hash (share_token_hash),

    KEY idx_file_shares_owner (owner_user_id, created_at),
    KEY idx_file_shares_file (file_id),
    KEY idx_file_shares_expiry (expires_at),

    CONSTRAINT fk_file_shares_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =========================================================
-- RECIPIENT EMAIL OTP RECORDS
-- =========================================================

CREATE TABLE IF NOT EXISTS share_recipient_otps (
    otp_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    share_id BIGINT UNSIGNED NOT NULL,

    recipient_email VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,

    expires_at DATETIME NOT NULL,

    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    used TINYINT(1) NOT NULL DEFAULT 0,

    last_sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (otp_id),

    KEY idx_share_otp_lookup (
        share_id,
        recipient_email,
        used,
        created_at
    ),

    KEY idx_share_otp_expiry (expires_at),

    CONSTRAINT fk_share_otp_share
        FOREIGN KEY (share_id)
        REFERENCES file_shares(share_id)
        ON DELETE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- =========================================================
-- VERIFIED RECIPIENT SESSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS share_access_sessions (
    session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    share_id BIGINT UNSIGNED NOT NULL,

    recipient_email VARCHAR(255) NOT NULL,
    session_token_hash CHAR(64) NOT NULL,

    expires_at DATETIME NOT NULL,
    revoked TINYINT(1) NOT NULL DEFAULT 0,

    -- A successful file-info opening is counted once per session.
    opened_at DATETIME DEFAULT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (session_id),

    UNIQUE KEY uq_share_session_token (session_token_hash),

    KEY idx_share_sessions_share (share_id),
    KEY idx_share_sessions_expiry (expires_at),

    CONSTRAINT fk_share_session_share
        FOREIGN KEY (share_id)
        REFERENCES file_shares(share_id)
        ON DELETE CASCADE

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
