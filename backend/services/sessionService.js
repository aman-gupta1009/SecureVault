
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

async function revokeAllUserSessions(
    userId
) {

    const [
        result
    ] = await pool.execute(
        `
        UPDATE sessions

        SET
            revoked = TRUE

        WHERE
            user_id = ?

        AND
            revoked = FALSE
        `,
        [
            userId
        ]
    );


    return (
        result.affectedRows
    );
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


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    createSession,

    getSession,

    revokeSession,

    revokeAllUserSessions,

    cleanupExpiredSessions,

    startSessionCleanupJob

};

