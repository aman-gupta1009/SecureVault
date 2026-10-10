CREATE DATABASE IF NOT EXISTS secure_vault;

USE secure_vault;


-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    email VARCHAR(255) NOT NULL UNIQUE,

    password_hash VARCHAR(255) NOT NULL,

    email_verified BOOLEAN NOT NULL DEFAULT FALSE,

    account_status ENUM(
        'ACTIVE',
        'LOCKED',
        'DISABLED'
    ) NOT NULL DEFAULT 'ACTIVE',

    failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,

    locked_until DATETIME NULL,

    last_login_at DATETIME NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);


-- =====================================================
-- EMAIL VERIFICATIONS / OTP
-- =====================================================

CREATE TABLE IF NOT EXISTS email_verifications (
    verification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    otp_hash VARCHAR(255) NOT NULL,

    purpose ENUM(
        'REGISTRATION',
        'PASSWORD_RECOVERY',
        'EMAIL_CHANGE'
    ) NOT NULL,

    expires_at DATETIME NOT NULL,

    attempts INT UNSIGNED NOT NULL DEFAULT 0,

    used BOOLEAN NOT NULL DEFAULT FALSE,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_email_verification_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    INDEX idx_email_verification_user (user_id),

    INDEX idx_email_verification_expiry (expires_at)
);


-- =====================================================
-- SESSIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS sessions (
    session_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NOT NULL,

    session_token_hash VARCHAR(255) NOT NULL UNIQUE,

    device_name VARCHAR(255),

    ip_address VARCHAR(45),

    user_agent TEXT,

    expires_at DATETIME NOT NULL,

    revoked BOOLEAN NOT NULL DEFAULT FALSE,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    last_activity_at DATETIME NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_session_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    INDEX idx_sessions_user (user_id)
);


-- =====================================================
-- SECURITY EVENTS / ACTIVITY TIMELINE
-- =====================================================

CREATE TABLE IF NOT EXISTS security_events (
    event_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    user_id BIGINT UNSIGNED NULL,

    event_type VARCHAR(100) NOT NULL,

    ip_address VARCHAR(45),

    user_agent TEXT,

    metadata JSON,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_security_event_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE SET NULL,

    INDEX idx_security_event_user (user_id),

    INDEX idx_security_event_type (event_type),

    INDEX idx_security_event_created (created_at)
);