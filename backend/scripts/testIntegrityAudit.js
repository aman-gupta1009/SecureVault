require("dotenv").config();

const { pool } = require("../config/database");
const { logSecurityEvent } = require("../services/securityEventService");

async function main() {
    let connection;

    try {
        connection = await pool.getConnection();

        // Get an existing user so the foreign-key constraint is satisfied.
        const [users] = await connection.execute(`
            SELECT user_id
            FROM users
            ORDER BY user_id ASC
            LIMIT 1
        `);

        if (users.length === 0) {
            throw new Error("NO_USER_FOUND");
        }

        const userId = users[0].user_id;

        console.log(
            `Testing FILE_INTEGRITY_FAILED audit for userId=${userId}...`
        );

        // Insert a synthetic audit event.
        await logSecurityEvent({
            userId,
            eventType: "FILE_INTEGRITY_FAILED",
            req: null,
            metadata: {
                fileId: 0,
                reason: "AUDIT_SYSTEM_TEST"
            }
        });

        // Verify that the event was actually stored.
        const [events] = await connection.execute(`
            SELECT
                event_id,
                event_type,
                user_id,
                metadata,
                created_at
            FROM security_events
            WHERE event_type = 'FILE_INTEGRITY_FAILED'
              AND JSON_UNQUOTE(
                    JSON_EXTRACT(metadata, '$.reason')
                  ) = 'AUDIT_SYSTEM_TEST'
              AND user_id = ?
            ORDER BY event_id DESC
            LIMIT 1
        `, [userId]);

        if (events.length === 0) {
            throw new Error("AUDIT_EVENT_NOT_FOUND_AFTER_INSERT");
        }

        console.log("\nPASS: FILE_INTEGRITY_FAILED audit event was inserted.");
        console.table(events);

        // Delete ONLY the synthetic test event.
        await connection.execute(`
            DELETE FROM security_events
            WHERE event_id = ?
        `, [events[0].event_id]);

        // Verify that the synthetic event was removed.
        const [remaining] = await connection.execute(`
            SELECT COUNT(*) AS count
            FROM security_events
            WHERE event_id = ?
        `, [events[0].event_id]);

        if (Number(remaining[0].count) !== 0) {
            throw new Error("TEST_EVENT_DELETE_FAILED");
        }

        console.log("\nPASS: Synthetic audit test event was removed.");
        console.log("No encrypted file was modified.");
        console.log("No test audit event was left behind.");

    } catch (error) {
        console.error("\nAUDIT TEST FAILED:", error.message);
        process.exitCode = 1;
    } finally {
        if (connection) {
            connection.release();
        }

        await pool.end();
    }
}

main();