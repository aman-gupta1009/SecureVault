
CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,

    category VARCHAR(40) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',

    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    metadata JSON DEFAULT NULL,

    source_type VARCHAR(50) DEFAULT NULL,
    source_event_id BIGINT UNSIGNED DEFAULT NULL,

    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME DEFAULT NULL,

    PRIMARY KEY (notification_id),

    UNIQUE KEY uq_notification_source_event (source_event_id),

    KEY idx_notification_user_read_created
        (user_id, is_read, created_at),

    KEY idx_notification_user_created
        (user_id, created_at),

    KEY idx_notification_category
        (user_id, category),

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_notification_source_event
        FOREIGN KEY (source_event_id)
        REFERENCES security_events(event_id)
        ON DELETE SET NULL

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;
