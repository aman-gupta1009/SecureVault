const { pool } = require("../config/database");
const { logSecurityEvent } = require("./securityEventService");

// Default: 15 minutes
const VAULT_AUTO_LOCK_MINUTES = Number(
    process.env.VAULT_AUTO_LOCK_MINUTES || 15
);

async function getVaultLockStatus(userId) {
    const [rows] = await pool.execute(
        `
        SELECT
            lock_id,
            user_id,
            is_locked,
            locked_at,
            unlocked_at,
            last_activity_at
        FROM vault_locks
        WHERE user_id = ?
        LIMIT 1
        `,
        [userId]
    );

    if (rows.length === 0) {
        return {
            isLocked: true,
            lockId: null,
            lockedAt: null,
            unlockedAt: null,
            lastActivityAt: null
        };
    }

    const vault = rows[0];

    return {
        isLocked: Boolean(vault.is_locked),
        lockId: vault.lock_id,
        lockedAt: vault.locked_at,
        unlockedAt: vault.unlocked_at,
        lastActivityAt: vault.last_activity_at
    };
}

async function createVaultLock(userId) {
    await pool.execute(
        `
        INSERT INTO vault_locks
        (
            user_id,
            is_locked,
            locked_at
        )
        VALUES
        (
            ?,
            TRUE,
            NOW()
        )
        ON DUPLICATE KEY UPDATE
            user_id = user_id
        `,
        [userId]
    );

    return getVaultLockStatus(userId);
}

async function lockVault(userId) {
    await pool.execute(
        `
        INSERT INTO vault_locks
        (
            user_id,
            is_locked,
            locked_at,
            unlocked_at,
            last_activity_at
        )
        VALUES
        (
            ?,
            TRUE,
            NOW(),
            NULL,
            NULL
        )
        ON DUPLICATE KEY UPDATE
            is_locked = TRUE,
            locked_at = NOW(),
            unlocked_at = NULL,
            last_activity_at = NULL
        `,
        [userId]
    );

    return getVaultLockStatus(userId);
}

async function unlockVault(userId) {
    await pool.execute(
        `
        INSERT INTO vault_locks
        (
            user_id,
            is_locked,
            locked_at,
            unlocked_at,
            last_activity_at
        )
        VALUES
        (
            ?,
            FALSE,
            NULL,
            NOW(),
            NOW()
        )
        ON DUPLICATE KEY UPDATE
            is_locked = FALSE,
            locked_at = NULL,
            unlocked_at = NOW(),
            last_activity_at = NOW()
        `,
        [userId]
    );

    return getVaultLockStatus(userId);
}

async function updateVaultActivity(userId) {
    await pool.execute(
        `
        UPDATE vault_locks
        SET last_activity_at = NOW()
        WHERE user_id = ?
        AND is_locked = FALSE
        `,
        [userId]
    );
}

/**
 * Automatically locks one inactive vault.
 *
 * Returns true if the vault was actually locked.
 *
 * req is optional:
 * - When called from a user request, IP/user-agent can be recorded.
 * - When called by the background auto-lock job, those values are unavailable.
 */
async function autoLockVaultIfInactive(userId, req = null) {
    const [result] = await pool.execute(
        `
        UPDATE vault_locks
        SET
            is_locked = TRUE,
            locked_at = NOW(),
            unlocked_at = NULL,
            last_activity_at = NULL
        WHERE user_id = ?
        AND is_locked = FALSE
        AND last_activity_at IS NOT NULL
        AND last_activity_at <
            DATE_SUB(
                NOW(),
                INTERVAL ? MINUTE
            )
        `,
        [userId, VAULT_AUTO_LOCK_MINUTES]
    );

    if (result.affectedRows > 0) {
        await logSecurityEvent({
            userId,
            eventType: "VAULT_LOCKED",
            req,
            metadata: {
                method: "AUTO_LOCK",
                reason: "INACTIVITY_TIMEOUT",
                timeoutMinutes: VAULT_AUTO_LOCK_MINUTES
            }
        });

        return true;
    }

    return false;
}

async function autoLockInactiveVaults() {
    /*
     * Find vaults that have become inactive.
     *
     * We select user IDs first so every automatically
     * locked vault can receive its own audit event.
     */
    const [rows] = await pool.execute(
        `
        SELECT user_id
        FROM vault_locks
        WHERE is_locked = FALSE
        AND last_activity_at IS NOT NULL
        AND last_activity_at <
            DATE_SUB(
                NOW(),
                INTERVAL ? MINUTE
            )
        `,
        [VAULT_AUTO_LOCK_MINUTES]
    );

    let lockedCount = 0;

    for (const row of rows) {
        const locked = await autoLockVaultIfInactive(row.user_id);

        if (locked) {
            lockedCount++;
        }
    }

    return lockedCount;
}

async function isVaultLocked(userId, req = null) {
    await autoLockVaultIfInactive(userId, req);

    const status = await getVaultLockStatus(userId);

    return status.isLocked;
}

async function requireUnlockedVault(userId, req = null) {
    const locked = await isVaultLocked(userId, req);

    if (locked) {
        const error = new Error("VAULT_LOCKED");
        throw error;
    }

    await updateVaultActivity(userId);
}

function startVaultAutoLockJob() {
    const intervalMs = 60 * 1000;

    const timer = setInterval(async () => {
        try {
            const lockedCount = await autoLockInactiveVaults();

            if (lockedCount > 0) {
                console.log(
                    `🔒 Auto-locked ${lockedCount} inactive vault(s).`
                );
            }
        } catch (error) {
            console.error(
                "❌ Vault auto-lock job failed:"
            );

            console.error(error.message);
        }
    }, intervalMs);

    if (timer.unref) {
        timer.unref();
    }

    console.log(
        `🔐 Vault auto-lock enabled: ${VAULT_AUTO_LOCK_MINUTES} minute(s) inactivity timeout.`
    );

    return timer;
}

module.exports = {
    getVaultLockStatus,
    createVaultLock,
    lockVault,
    unlockVault,
    updateVaultActivity,
    autoLockVaultIfInactive,
    autoLockInactiveVaults,
    isVaultLocked,
    requireUnlockedVault,
    startVaultAutoLockJob
};