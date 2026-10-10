const { pool } = require("../config/database");

async function getSecurityDashboard(userId) {
    // ---------------------------------------------------------
    // 1. USER ACCOUNT
    // ---------------------------------------------------------

    const [userRows] = await pool.execute(
        `
        SELECT
            user_id,
            email,
            email_verified,
            account_status,
            failed_login_attempts,
            locked_until,
            last_login_at,
            created_at
        FROM users
        WHERE user_id = ?
        LIMIT 1
        `,
        [userId]
    );

    if (userRows.length === 0) {
        const error = new Error("USER_NOT_FOUND");
        error.statusCode = 404;
        throw error;
    }

    const user = userRows[0];

    // ---------------------------------------------------------
    // 2. FILE STATISTICS
    // ---------------------------------------------------------

    const [fileStatsRows] = await pool.execute(
        `
        SELECT
            COUNT(*) AS totalFiles,
            COALESCE(SUM(file_size), 0) AS totalStorageBytes
        FROM vault_files
        WHERE user_id = ?
        `,
        [userId]
    );

    const fileStats = {
        totalFiles: Number(fileStatsRows[0].totalFiles),
        totalStorageBytes: Number(fileStatsRows[0].totalStorageBytes)
    };

    // ---------------------------------------------------------
    // 3. SESSION STATISTICS
    // ---------------------------------------------------------

    const [sessionRows] = await pool.execute(
        `
        SELECT
            COUNT(*) AS activeSessions
        FROM sessions
        WHERE user_id = ?
          AND revoked = 0
          AND expires_at > CURRENT_TIMESTAMP
        `,
        [userId]
    );

    const activeSessions = Number(sessionRows[0].activeSessions);

    // ---------------------------------------------------------
    // 4. VAULT STATUS
    // ---------------------------------------------------------

    const [vaultRows] = await pool.execute(
        `
        SELECT
            is_locked,
            locked_at,
            unlocked_at,
            last_activity_at
        FROM vault_locks
        WHERE user_id = ?
        ORDER BY lock_id DESC
        LIMIT 1
        `,
        [userId]
    );

    let vault;

    if (vaultRows.length === 0) {
        vault = {
            isLocked: true,
            lockedAt: null,
            unlockedAt: null,
            lastActivityAt: null
        };
    } else {
        const vaultRow = vaultRows[0];

        vault = {
            isLocked: Boolean(vaultRow.is_locked),
            lockedAt: vaultRow.locked_at,
            unlockedAt: vaultRow.unlocked_at,
            lastActivityAt: vaultRow.last_activity_at
        };
    }

    // ---------------------------------------------------------
    // 5. SECURITY EVENT STATISTICS
    // ---------------------------------------------------------

    const [eventStatsRows] = await pool.execute(
        `
        SELECT
            COUNT(*) AS totalEvents,

            COALESCE(
                SUM(event_type = 'LOGIN_SUCCESS'),
                0
            ) AS successfulLogins,

            COALESCE(
                SUM(event_type = 'LOGIN_FAILED'),
                0
            ) AS failedLogins,

            COALESCE(
                SUM(event_type = 'ACCOUNT_LOCKED'),
                0
            ) AS accountLockEvents,

            COALESCE(
                SUM(event_type = 'FILE_UPLOADED'),
                0
            ) AS fileUploads,

            COALESCE(
                SUM(event_type = 'FILE_DOWNLOADED'),
                0
            ) AS fileDownloads,

            COALESCE(
                SUM(event_type = 'FILE_DELETED'),
                0
            ) AS fileDeletions,

            COALESCE(
                SUM(event_type = 'VAULT_UNLOCKED'),
                0
            ) AS vaultUnlocks,

            COALESCE(
                SUM(event_type = 'VAULT_LOCKED'),
                0
            ) AS vaultLocks,

            COALESCE(
                SUM(event_type = 'FILE_INTEGRITY_FAILED'),
                0
            ) AS integrityFailures,

            COALESCE(
                SUM(event_type = 'KEY_ROTATION'),
                0
            ) AS keyRotations

        FROM security_events
        WHERE user_id = ?
        `,
        [userId]
    );

    const eventStats = {
        totalEvents: Number(eventStatsRows[0].totalEvents),
        successfulLogins: Number(eventStatsRows[0].successfulLogins),
        failedLogins: Number(eventStatsRows[0].failedLogins),
        accountLockEvents: Number(eventStatsRows[0].accountLockEvents),
        fileUploads: Number(eventStatsRows[0].fileUploads),
        fileDownloads: Number(eventStatsRows[0].fileDownloads),
        fileDeletions: Number(eventStatsRows[0].fileDeletions),
        vaultUnlocks: Number(eventStatsRows[0].vaultUnlocks),
        vaultLocks: Number(eventStatsRows[0].vaultLocks),
        integrityFailures: Number(eventStatsRows[0].integrityFailures),
        keyRotations: Number(eventStatsRows[0].keyRotations)
    };

    // ---------------------------------------------------------
    // 6. RECENT SECURITY ACTIVITY
    // ---------------------------------------------------------

    const [recentRows] = await pool.execute(
        `
        SELECT
            event_id,
            event_type,
            ip_address,
            user_agent,
            metadata,
            created_at
        FROM security_events
        WHERE user_id = ?
        ORDER BY created_at DESC, event_id DESC
        LIMIT 10
        `,
        [userId]
    );

    const recentActivity = recentRows.map((event) => {
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
    // 7. FINAL DASHBOARD
    // ---------------------------------------------------------

    return {
        account: {
            email: user.email,
            emailVerified: Boolean(user.email_verified),
            accountStatus: user.account_status,
            failedLoginAttempts: Number(user.failed_login_attempts),
            lockedUntil: user.locked_until,
            lastLoginAt: user.last_login_at,
            createdAt: user.created_at
        },

        vault,

        files: fileStats,

        sessions: {
            activeSessions
        },

        security: eventStats,

        recentActivity
    };
}

module.exports = {
    getSecurityDashboard
};