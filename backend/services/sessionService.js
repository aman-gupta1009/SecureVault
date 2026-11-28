
const crypto = require("crypto");

const {
    pool
} = require("../config/database");






// =====================================================
// SESSION CONFIGURATION
// =====================================================

const SESSION_TTL_HOURS = Number(
    process.env.SESSION_TTL_HOURS || 24
);


// =====================================================
// HASH SESSION TOKEN
// =====================================================

function hashSessionToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


// =====================================================
// CREATE SESSION
// =====================================================

async function createSession(
    userId,
    req
) {

    // -------------------------------------------------
    // Generate secure random session token
    // -------------------------------------------------

    const sessionToken =
        crypto
            .randomBytes(32)
            .toString("hex");


    // -------------------------------------------------
    // Hash token before database storage
    // -------------------------------------------------

    const sessionTokenHash =
        hashSessionToken(
            sessionToken
        );


    // -------------------------------------------------
    // Calculate expiry
    // -------------------------------------------------

    const expiresAt =
        new Date(
            Date.now() +
            SESSION_TTL_HOURS *
            60 *
            60 *
            1000
        );


    // -------------------------------------------------
    // Request information
    // -------------------------------------------------

    const ipAddress =
        req.ip || null;


    const userAgent =
        req.get("user-agent") || null;


    const deviceName =
        "Web Browser";


    // -------------------------------------------------
    // Store session
    // -------------------------------------------------

    const [
        result
    ] = await pool.execute(
        `
        INSERT INTO sessions
        (
            user_id,
            session_token_hash,
            device_name,
            ip_address,
            user_agent,
            expires_at,
            revoked
        )
        VALUES
        (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            FALSE
        )
        `,
        [
            userId,
            sessionTokenHash,
            deviceName,
            ipAddress,
            userAgent,
            expiresAt
        ]
    );


    // -------------------------------------------------
    // Return original token
    // -------------------------------------------------

    return {

        sessionId:
            result.insertId,

        sessionToken,

        expiresAt

    };
}


// =====================================================
// GET SESSION
// =====================================================

async function getSession(
    sessionToken
) {

    // -------------------------------------------------
    // Validate token
    // -------------------------------------------------

    if (
        !sessionToken ||
        typeof sessionToken !== "string"
    ) {

        return null;
    }


    // -------------------------------------------------
    // Hash incoming token
    // -------------------------------------------------

    const sessionTokenHash =
        hashSessionToken(
            sessionToken
        );


    // -------------------------------------------------
    // Find active session
    // -------------------------------------------------

    const [
        rows
    ] = await pool.execute(
        `
        SELECT
            s.session_id,
            s.user_id,
            s.device_name,
            s.ip_address,
            s.user_agent,
            s.expires_at,
            s.revoked,
            s.created_at,
            s.last_activity_at,

            u.email,
            u.email_verified

        FROM sessions s

        INNER JOIN users u
            ON u.user_id = s.user_id

        WHERE
            s.session_token_hash = ?

        AND
            s.revoked = FALSE

        AND
            s.expires_at > NOW()

        LIMIT 1
        `,
        [
            sessionTokenHash
        ]
    );


    // -------------------------------------------------
    // Session not found / expired / revoked
    // -------------------------------------------------

    if (
        rows.length === 0
    ) {

        return null;
    }


    const session =
        rows[0];


    // -------------------------------------------------
    // Update activity
    // -------------------------------------------------

    await pool.execute(
        `
        UPDATE sessions

        SET
            last_activity_at = NOW()

        WHERE
            session_id = ?

        AND
            revoked = FALSE

        AND
            expires_at > NOW()
        `,
        [
            session.session_id
        ]
    );


    // -------------------------------------------------
    // Return session
    // -------------------------------------------------

    return session;
}


// =====================================================
// REVOKE CURRENT SESSION
// =====================================================

async function revokeSession(
    sessionToken
) {

    if (
        !sessionToken ||
        typeof sessionToken !== "string"
    ) {

        return false;
    }


    const sessionTokenHash =
        hashSessionToken(
            sessionToken
        );


    const [
        result
    ] = await pool.execute(
        `
        UPDATE sessions

        SET
            revoked = TRUE

        WHERE
            session_token_hash = ?

        AND
            revoked = FALSE
        `,
        [
            sessionTokenHash
        ]
    );


    return (
        result.affectedRows > 0
    );
}


// =====================================================
// REVOKE ALL USER SESSIONS
// =====================================================


async function revokeAllUserSessions(userId, connection = pool) {
    if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
        throw new Error("Invalid user ID.");
    }

    const [result] = await connection.execute(
        `UPDATE sessions
         SET revoked = TRUE
         WHERE user_id = ?
           AND revoked = FALSE`,
        [Number(userId)]
    );

    return result.affectedRows;
}



// =====================================================
// CLEAN EXPIRED SESSIONS
// =====================================================

async function cleanupExpiredSessions() {

    const [
        result
    ] = await pool.execute(
        `
        DELETE FROM sessions

        WHERE
            expires_at < NOW()

        OR
        (
            revoked = TRUE

            AND
            created_at < DATE_SUB(
                NOW(),
                INTERVAL 7 DAY
            )
        )
        `
    );


    return (
        result.affectedRows
    );
}


// =====================================================
// START SESSION CLEANUP JOB
// =====================================================

function startSessionCleanupJob() {

    // Run immediately
    cleanupExpiredSessions()
        .catch((error) => {

            console.error(
                "Session cleanup error:",
                error
            );

        });


    // Run every hour
    setInterval(
        async () => {

            try {

                const deleted =
                    await cleanupExpiredSessions();


                if (deleted > 0) {

                    console.log(
                        `🧹 Session cleanup: ${deleted} session(s) removed.`
                    );

                }

            } catch (error) {

                console.error(
                    "Session cleanup error:",
                    error
                );

            }

        },
        60 * 60 * 1000
    );
}

async function getUserSessions(userId, currentSessionId) {
    const safeUserId = Number(userId);

    if (!Number.isSafeInteger(safeUserId) || safeUserId <= 0) {
        throw new Error("Invalid user ID.");
    }

    const [rows] = await pool.execute(
        `SELECT
            session_id,
            device_name,
            ip_address,
            user_agent,
            expires_at,
            created_at,
            last_activity_at
         FROM sessions
         WHERE user_id = ?
           AND revoked = FALSE
           AND expires_at > NOW()
         ORDER BY last_activity_at DESC`,
        [safeUserId]
    );

    return rows.map((session) => ({
        sessionId: session.session_id,
        deviceName: session.device_name || "Unknown device",
        ipAddress: session.ip_address || "Unavailable",
        userAgent: session.user_agent || "",
        expiresAt: session.expires_at,
        createdAt: session.created_at,
        lastActivityAt: session.last_activity_at,
        isCurrent: Number(session.session_id) === Number(currentSessionId)
    }));
}

async function revokeUserSession(userId, sessionId, currentSessionId) {
    const safeUserId = Number(userId);
    const safeSessionId = Number(sessionId);
    const safeCurrentSessionId = Number(currentSessionId);

    if (
        !Number.isSafeInteger(safeUserId) || safeUserId <= 0 ||
        !Number.isSafeInteger(safeSessionId) || safeSessionId <= 0
    ) {
        throw new Error("Invalid session information.");
    }

    // Prevent accidentally revoking the session making this request.
    if (safeSessionId === safeCurrentSessionId) {
        return { revoked: false, reason: "CURRENT_SESSION" };
    }

    const [result] = await pool.execute(
        `UPDATE sessions
         SET revoked = TRUE
         WHERE session_id = ?
           AND user_id = ?
           AND revoked = FALSE
           AND expires_at > NOW()`,
        [safeSessionId, safeUserId]
    );

    return {
        revoked: result.affectedRows > 0,
        reason: result.affectedRows > 0 ? null : "NOT_FOUND"
    };
}

async function revokeOtherUserSessions(userId, currentSessionId) {
    const safeUserId = Number(userId);
    const safeCurrentSessionId = Number(currentSessionId);

    if (
        !Number.isSafeInteger(safeUserId) || safeUserId <= 0 ||
        !Number.isSafeInteger(safeCurrentSessionId) || safeCurrentSessionId <= 0
    ) {
        throw new Error("Invalid session information.");
    }

    const [result] = await pool.execute(
        `UPDATE sessions
         SET revoked = TRUE
         WHERE user_id = ?
           AND session_id <> ?
           AND revoked = FALSE`,
        [safeUserId, safeCurrentSessionId]
    );

    return result.affectedRows;
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    createSession,

    getSession,

    revokeSession,

    revokeAllUserSessions,

    cleanupExpiredSessions,

    startSessionCleanupJob,

    getUserSessions,

    revokeUserSession,

    revokeOtherUserSessions

};

