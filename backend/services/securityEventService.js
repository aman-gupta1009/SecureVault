const { pool } = require("../config/database");


// =====================================================
// LOG SECURITY EVENT
// =====================================================

async function logSecurityEvent({
    userId = null,
    eventType,
    req = null,
    metadata = null
}) {

    if (
        typeof eventType !== "string" ||
        eventType.trim() === ""
    ) {
        throw new Error(
            "Security event type is required."
        );
    }


    // -------------------------------------------------
    // Request information
    // -------------------------------------------------

    const ipAddress =
        req?.ip || null;


    const userAgent =
        req?.get?.("user-agent") || null;


    // -------------------------------------------------
    // Convert metadata to JSON
    // -------------------------------------------------

    let metadataJson = null;


    if (metadata !== null && metadata !== undefined) {

        metadataJson =
            JSON.stringify(metadata);

    }


    // -------------------------------------------------
    // Insert security event
    // -------------------------------------------------

    await pool.execute(
        `
        INSERT INTO security_events
        (
            user_id,
            event_type,
            ip_address,
            user_agent,
            metadata
        )
        VALUES
        (
            ?,
            ?,
            ?,
            ?,
            ?
        )
        `,
        [
            userId,
            eventType.trim(),
            ipAddress,
            userAgent,
            metadataJson
        ]
    );

}


// =====================================================
// GET USER SECURITY EVENTS
// =====================================================

async function getUserSecurityEvents(
    userId,
    limit = 100
) {

    const safeLimit =
        Math.min(
            Math.max(
                Number(limit) || 100,
                1
            ),
            100
        );


    const [
        rows
    ] = await pool.execute(
        `
        SELECT
            event_id,
            user_id,
            event_type,
            ip_address,
            user_agent,
            metadata,
            created_at
        FROM security_events
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
        `,
        [
            userId
        ]
    );


    return rows;

}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    logSecurityEvent,

    getUserSecurityEvents

};