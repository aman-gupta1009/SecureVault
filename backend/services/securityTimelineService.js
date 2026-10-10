const { pool } = require("../config/database");

const ALLOWED_EVENT_TYPES = new Set([
    // Authentication
    "LOGIN_SUCCESS",
    "LOGIN_FAILED",
    "ACCOUNT_LOCKED",
    "LOGOUT",
    "LOGOUT_ALL",

    // Vault
    "VAULT_UNLOCKED",
    "VAULT_LOCKED",

    // File management
    "FILE_UPLOADED",
    "FILE_DOWNLOADED",
    "FILE_DELETED",

    // Key management
    "KEY_ROTATION",

    // File integrity
    "FILE_INTEGRITY_FAILED",

    // File sharing
    "SHARE_CREATED",
    "FILE_SHARED",
    "SHARE_ACCESSED",
    "SHARE_DOWNLOAD",
    "SHARE_DOWNLOAD_LIMIT_REACHED",
    "SHARE_REVOKED",
    "SHARE_EXPIRED"
]);

async function getUserSecurityEvents(userId, options = {}) {

    // ---------------------------------------------------------
    // PAGINATION
    // ---------------------------------------------------------

    const page = options.page === undefined
        ? 1
        : Number(options.page);

    const limit = options.limit === undefined
        ? 20
        : Number(options.limit);

    const eventType = options.eventType || null;

    if (!Number.isInteger(page) || page < 1) {
        throw new Error("INVALID_PAGE");
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new Error("INVALID_LIMIT");
    }

    const offset = (page - 1) * limit;

    // ---------------------------------------------------------
    // USER FILTER
    // ---------------------------------------------------------

    let whereClause = `
        WHERE user_id = ?
    `;

    const params = [userId];

    // ---------------------------------------------------------
    // OPTIONAL EVENT TYPE FILTER
    // ---------------------------------------------------------

    if (eventType) {

        if (!ALLOWED_EVENT_TYPES.has(eventType)) {
            const error = new Error("INVALID_EVENT_TYPE");
            error.statusCode = 400;
            throw error;
        }

        whereClause += `
            AND event_type = ?
        `;

        params.push(eventType);
    }

    // ---------------------------------------------------------
    // TOTAL COUNT
    // ---------------------------------------------------------

    const [countRows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM security_events
        ${whereClause}
        `,
        params
    );

    const total = Number(countRows[0].total);

    // ---------------------------------------------------------
    // SECURITY EVENTS
    //
    // page / limit / offset are already validated integers.
    // They are intentionally embedded into SQL instead of being
    // passed as mysql2 prepared-statement parameters.
    // ---------------------------------------------------------

    const [rows] = await pool.execute(
        `
        SELECT
            event_id,
            event_type,
            ip_address,
            user_agent,
            metadata,
            created_at
        FROM security_events
        ${whereClause}
        ORDER BY created_at DESC, event_id DESC
        LIMIT ${limit} OFFSET ${offset}
        `,
        params
    );

    // ---------------------------------------------------------
    // FORMAT EVENTS
    // ---------------------------------------------------------

    const events = rows.map((event) => {

        let metadata = event.metadata;

        if (typeof metadata === "string") {
            try {
                metadata = JSON.parse(metadata);
            } catch {
                metadata = null;
            }
        }

        return {
            eventId: event.event_id,
            eventType: event.event_type,
            ipAddress: event.ip_address,
            userAgent: event.user_agent,
            metadata,
            createdAt: event.created_at
        };
    });

    // ---------------------------------------------------------
    // PAGINATION RESULT
    // ---------------------------------------------------------

    const totalPages = total === 0
        ? 0
        : Math.ceil(total / limit);

    return {
        events,

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
    getUserSecurityEvents
};