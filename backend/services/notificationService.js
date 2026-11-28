
const { pool } = require("../config/database");

const SECURITY_NOTIFICATION_EVENTS = {
    FILE_INTEGRITY_FAILED: {
        category: "SECURITY",
        severity: "CRITICAL",
        title: "File integrity check failed",
        message: "A file integrity verification failed. Review your vault security."
    },

    ACCOUNT_LOCKED: {
        category: "SECURITY",
        severity: "CRITICAL",
        title: "Account locked",
        message: "Your account was locked after repeated unsuccessful login attempts."
    },

    LOGIN_FAILED: {
        category: "SECURITY",
        severity: "WARNING",
        title: "Failed login attempt",
        message: "An unsuccessful login attempt was recorded for your account."
    },

    KEY_ROTATION: {
        category: "SECURITY",
        severity: "INFO",
        title: "Encryption key rotated",
        message: "Your vault encryption key was rotated."
    },

    VAULT_LOCKED: {
        category: "SECURITY",
        severity: "INFO",
        title: "Vault locked",
        message: "Your vault was locked."
    }
};

const ALLOWED_CATEGORIES = [
    "SECURITY",
    "BACKUP",
    "ACCOUNT"
];

const ALLOWED_SEVERITIES = [
    "INFO",
    "WARNING",
    "CRITICAL"
];

function parseMetadata(value) {
    if (!value) return null;

    if (typeof value === "object") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function safeSecurityMetadata(value) {
    const metadata = parseMetadata(value);

    if (!metadata || typeof metadata !== "object") {
        return null;
    }

    const safe = {};

    if (typeof metadata.method === "string") {
        safe.method = metadata.method;
    }

    if (typeof metadata.reason === "string") {
        safe.reason = metadata.reason;
    }

    if (
        Number.isFinite(Number(metadata.timeoutMinutes)) &&
        metadata.timeoutMinutes !== null &&
        metadata.timeoutMinutes !== undefined
    ) {
        safe.timeoutMinutes = Number(metadata.timeoutMinutes);
    }

    return Object.keys(safe).length ? safe : null;
}

function validateUserId(userId) {
    const id = Number(userId);

    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new Error("A valid user ID is required.");
    }

    return id;
}

async function createNotification({
    userId,
    category,
    severity = "INFO",
    title,
    message,
    metadata = null,
    sourceType = null,
    sourceEventId = null
}) {
    const safeUserId = validateUserId(userId);

    const normalizedCategory = String(category || "").toUpperCase();
    const normalizedSeverity = String(severity || "INFO").toUpperCase();

    if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
        throw new Error("Invalid notification category.");
    }

    if (!ALLOWED_SEVERITIES.includes(normalizedSeverity)) {
        throw new Error("Invalid notification severity.");
    }

    if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof message !== "string" ||
        !message.trim()
    ) {
        throw new Error("Notification title and message are required.");
    }

    const metadataJson =
        metadata === null || metadata === undefined
            ? null
            : JSON.stringify(metadata);

    const [result] = await pool.execute(
        `INSERT INTO notifications (
            user_id,
            category,
            severity,
            title,
            message,
            metadata,
            source_type,
            source_event_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            safeUserId,
            normalizedCategory,
            normalizedSeverity,
            title.trim(),
            message.trim(),
            metadataJson,
            sourceType,
            sourceEventId
        ]
    );

    return {
        notificationId: result.insertId,
        created: result.affectedRows === 1
    };
}

async function syncSecurityNotifications(userId) {
    const safeUserId = validateUserId(userId);

    const eventTypes = Object.keys(SECURITY_NOTIFICATION_EVENTS);
    const placeholders = eventTypes.map(() => "?").join(",");

    const [events] = await pool.execute(
        `SELECT
            event_id,
            event_type,
            metadata,
            created_at
         FROM security_events
         WHERE user_id = ?
           AND event_type IN (${placeholders})
         ORDER BY event_id DESC
         LIMIT 500`,
        [safeUserId, ...eventTypes]
    );

    let createdCount = 0;

    for (const event of events) {
        const config = SECURITY_NOTIFICATION_EVENTS[event.event_type];

        if (!config) continue;

        let title = config.title;
        let message = config.message;

        const metadata = parseMetadata(event.metadata);
        const safeMetadata = safeSecurityMetadata(event.metadata);

        if (
            event.event_type === "VAULT_LOCKED" &&
            metadata?.method === "AUTO_LOCK"
        ) {
            title = "Vault automatically locked";
            message =
                "Your vault was automatically locked because of inactivity.";
        }

        // INSERT IGNORE prevents duplicate source events.
        // Existing soft-deleted notifications are not recreated
        // because source_event_id remains unique.
        const [result] = await pool.execute(
            `INSERT IGNORE INTO notifications (
                user_id,
                category,
                severity,
                title,
                message,
                metadata,
                source_type,
                source_event_id,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                safeUserId,
                config.category,
                config.severity,
                title,
                message,
                safeMetadata ? JSON.stringify(safeMetadata) : null,
                "SECURITY_EVENT",
                event.event_id,
                event.created_at
            ]
        );

        if (result.affectedRows === 1) {
            createdCount++;
        }
    }

    return { createdCount };
}

async function listNotifications(
    userId,
    {
        page = 1,
        limit = 20,
        category = null,
        unreadOnly = false
    } = {}
) {
    const safeUserId = validateUserId(userId);

    const parsedPage = Number.parseInt(page, 10);
    const parsedLimit = Number.parseInt(limit, 10);

    const safePage = Math.max(
        1,
        Number.isFinite(parsedPage) ? parsedPage : 1
    );

    const safeLimit = Math.min(
        50,
        Math.max(
            1,
            Number.isFinite(parsedLimit) ? parsedLimit : 20
        )
    );

    const offset = (safePage - 1) * safeLimit;

    // Deleted notifications are excluded from all normal lists.
    const conditions = [
        "user_id = ?",
        "deleted_at IS NULL"
    ];

    const values = [safeUserId];

    if (category) {
        const normalizedCategory = String(category).toUpperCase();

        if (!ALLOWED_CATEGORIES.includes(normalizedCategory)) {
            throw new Error("INVALID_CATEGORY");
        }

        conditions.push("category = ?");
        values.push(normalizedCategory);
    }

    if (
        unreadOnly === true ||
        unreadOnly === "true" ||
        unreadOnly === "1"
    ) {
        conditions.push("is_read = 0");
    }

    const whereClause = conditions.join(" AND ");

    const sqlLimit = String(safeLimit);
    const sqlOffset = String(offset);

    const [rows] = await pool.execute(
        `SELECT
            notification_id,
            user_id,
            category,
            severity,
            title,
            message,
            metadata,
            source_type,
            is_read,
            created_at,
            read_at
         FROM notifications
         WHERE ${whereClause}
         ORDER BY created_at DESC, notification_id DESC
         LIMIT ${sqlLimit} OFFSET ${sqlOffset}`,
        values
    );

    const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total
         FROM notifications
         WHERE ${whereClause}`,
        values
    );

    const total = Number(countRows[0].total);

    return {
        notifications: rows.map((row) => ({
            ...row,
            metadata: parseMetadata(row.metadata),
            is_read: Boolean(row.is_read)
        })),

        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit)
        }
    };
}

async function getUnreadCount(userId) {
    const safeUserId = validateUserId(userId);

    const [rows] = await pool.execute(
        `SELECT COUNT(*) AS unreadCount
         FROM notifications
         WHERE user_id = ?
           AND is_read = 0
           AND deleted_at IS NULL`,
        [safeUserId]
    );

    return Number(rows[0].unreadCount);
}

async function markNotificationRead(userId, notificationId) {
    const safeUserId = validateUserId(userId);
    const safeNotificationId = validateUserId(notificationId);

    const [result] = await pool.execute(
        `UPDATE notifications
         SET is_read = 1,
             read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
         WHERE notification_id = ?
           AND user_id = ?
           AND deleted_at IS NULL`,
        [safeNotificationId, safeUserId]
    );

    return result.affectedRows > 0;
}

async function markAllNotificationsRead(userId) {
    const safeUserId = validateUserId(userId);

    const [result] = await pool.execute(
        `UPDATE notifications
         SET is_read = 1,
             read_at = CURRENT_TIMESTAMP
         WHERE user_id = ?
           AND is_read = 0
           AND deleted_at IS NULL`,
        [safeUserId]
    );

    return result.affectedRows;
}

async function deleteNotification(userId, notificationId) {
    const safeUserId = validateUserId(userId);
    const safeNotificationId = validateUserId(notificationId);

    // Soft delete: retain the row and source_event_id.
    // This prevents security-event synchronization from
    // recreating the deleted notification.
    const [result] = await pool.execute(
        `UPDATE notifications
         SET deleted_at = CURRENT_TIMESTAMP
         WHERE notification_id = ?
           AND user_id = ?
           AND deleted_at IS NULL`,
        [safeNotificationId, safeUserId]
    );

    return result.affectedRows > 0;
}

module.exports = {
    createNotification,
    syncSecurityNotifications,
    listNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification
};
