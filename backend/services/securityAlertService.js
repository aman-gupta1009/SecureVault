const { pool } = require("../config/database");

const ALERT_EVENT_TYPES = new Set([
    "FILE_INTEGRITY_FAILED",
    "ACCOUNT_LOCKED",
    "LOGIN_FAILED",
    "KEY_ROTATION",
    "VAULT_LOCKED"
]);

function buildAlert(event) {
    let metadata = event.metadata;

    if (typeof metadata === "string") {
        try {
            metadata = JSON.parse(metadata);
        } catch {
            metadata = null;
        }
    }

    switch (event.event_type) {
        case "FILE_INTEGRITY_FAILED":
            return {
                alertId: event.event_id,
                severity: "CRITICAL",
                alertType: "FILE_INTEGRITY_FAILED",
                title: "File integrity verification failed",
                message:
                    "A stored file failed cryptographic integrity verification.",
                eventId: event.event_id,
                metadata,
                createdAt: event.created_at
            };

        case "ACCOUNT_LOCKED":
            return {
                alertId: event.event_id,
                severity: "HIGH",
                alertType: "ACCOUNT_LOCKED",
                title: "Account locked",
                message:
                    "Your account was temporarily locked after repeated failed login attempts.",
                eventId: event.event_id,
                metadata,
                createdAt: event.created_at
            };

        case "LOGIN_FAILED":
            return {
                alertId: event.event_id,
                severity: "MEDIUM",
                alertType: "LOGIN_FAILED",
                title: "Failed login attempt",
                message:
                    "A login attempt for your account was unsuccessful.",
                eventId: event.event_id,
                metadata,
                createdAt: event.created_at
            };

        case "KEY_ROTATION":
            return {
                alertId: event.event_id,
                severity: "INFO",
                alertType: "KEY_ROTATION",
                title: "Encryption key rotation",
                message:
                    "A file encryption key was rotated.",
                eventId: event.event_id,
                metadata,
                createdAt: event.created_at
            };

        case "VAULT_LOCKED":
            if (
                metadata &&
                metadata.method === "AUTO_LOCK"
            ) {
                return {
                    alertId: event.event_id,
                    severity: "MEDIUM",
                    alertType: "VAULT_AUTO_LOCKED",
                    title: "Vault automatically locked",
                    message:
                        "Your vault was automatically locked because of inactivity.",
                    eventId: event.event_id,
                    metadata,
                    createdAt: event.created_at
                };
            }

            return {
                alertId: event.event_id,
                severity: "INFO",
                alertType: "VAULT_LOCKED",
                title: "Vault locked",
                message:
                    "Your vault was locked.",
                eventId: event.event_id,
                metadata,
                createdAt: event.created_at
            };

        default:
            return null;
    }
}

async function getSecurityAlerts(userId, options = {}) {
    const page = Number(
    options.page === undefined ? 1 : options.page
);

const limit = Number(
    options.limit === undefined ? 20 : options.limit
);
    const severity = options.severity
        ? String(options.severity).trim().toUpperCase()
        : null;

    if (!Number.isInteger(page) || page < 1) {
        const error = new Error("INVALID_PAGE");
        error.statusCode = 400;
        throw error;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        const error = new Error("INVALID_LIMIT");
        error.statusCode = 400;
        throw error;
    }

    const allowedSeverities = new Set([
        "CRITICAL",
        "HIGH",
        "MEDIUM",
        "INFO"
    ]);

    if (severity && !allowedSeverities.has(severity)) {
        const error = new Error("INVALID_SEVERITY");
        error.statusCode = 400;
        throw error;
    }

    const [rows] = await pool.execute(
        `
        SELECT
            event_id,
            event_type,
            metadata,
            created_at
        FROM security_events
        WHERE user_id = ?
          AND event_type IN (
              'FILE_INTEGRITY_FAILED',
              'ACCOUNT_LOCKED',
              'LOGIN_FAILED',
              'KEY_ROTATION',
              'VAULT_LOCKED'
          )
        ORDER BY created_at DESC, event_id DESC
        `,
        [userId]
    );

    let alerts = rows
        .map(buildAlert)
        .filter(Boolean);

    if (severity) {
        alerts = alerts.filter(
            (alert) => alert.severity === severity
        );
    }

    const total = alerts.length;
    const totalPages = total === 0
        ? 0
        : Math.ceil(total / limit);

    const offset = (page - 1) * limit;

    const paginatedAlerts = alerts.slice(
        offset,
        offset + limit
    );

    return {
        alerts: paginatedAlerts,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        }
    };
}

module.exports = {
    getSecurityAlerts
};