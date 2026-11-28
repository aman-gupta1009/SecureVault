
const argon2 = require("argon2");

const { pool } = require("../config/database");
const { generateOTP } = require("../utils/otp");

const OTP_EXPIRY_MINUTES = Number(
    process.env.OTP_EXPIRY_MINUTES || 10
);

const OTP_MAX_ATTEMPTS = Number(
    process.env.OTP_MAX_ATTEMPTS || 5
);

const ALLOWED_PURPOSES = new Set([
    "REGISTRATION",
    "PASSWORD_RECOVERY",
    "EMAIL_CHANGE"
]);

function validateOTPConfig() {
    if (
        !Number.isSafeInteger(OTP_EXPIRY_MINUTES) ||
        OTP_EXPIRY_MINUTES < 1
    ) {
        throw new Error("OTP_EXPIRY_MINUTES must be a positive integer.");
    }

    if (
        !Number.isSafeInteger(OTP_MAX_ATTEMPTS) ||
        OTP_MAX_ATTEMPTS < 1
    ) {
        throw new Error("OTP_MAX_ATTEMPTS must be a positive integer.");
    }
}

function validateOTPRequest(userId, purpose) {
    if (
        !Number.isSafeInteger(Number(userId)) ||
        Number(userId) <= 0
    ) {
        throw new Error("Invalid user ID.");
    }

    if (!ALLOWED_PURPOSES.has(purpose)) {
        throw new Error("Invalid OTP purpose.");
    }
}

async function createOTP(userId, purpose) {
    validateOTPConfig();
    validateOTPRequest(userId, purpose);

    const normalizedUserId = Number(userId);
    const otp = String(generateOTP());

    if (!/^\d{6}$/.test(otp)) {
        throw new Error("OTP generator must return a six-digit OTP.");
    }

    // Only the Argon2 hash is stored in the database.
    const otpHash = await argon2.hash(otp, {
        type: argon2.argon2id
    });

    const connection = await pool.getConnection();
    let transactionStarted = false;

    try {
        await connection.beginTransaction();
        transactionStarted = true;

        // Serialize OTP creation for this user.
        // This also verifies that the user exists.
        const [users] = await connection.execute(
            `
            SELECT user_id
            FROM users
            WHERE user_id = ?
            FOR UPDATE
            `,
            [normalizedUserId]
        );

        if (users.length === 0) {
            throw new Error("OTP_USER_NOT_FOUND");
        }

        // Invalidate any previously active OTP for this purpose.
        await connection.execute(
            `
            UPDATE email_verifications
            SET used = TRUE
            WHERE user_id = ?
              AND purpose = ?
              AND used = FALSE
            `,
            [normalizedUserId, purpose]
        );

        await connection.execute(
            `
            INSERT INTO email_verifications
                (user_id, otp_hash, purpose, expires_at)
            VALUES
                (
                    ?,
                    ?,
                    ?,
                    DATE_ADD(NOW(), INTERVAL ? MINUTE)
                )
            `,
            [
                normalizedUserId,
                otpHash,
                purpose,
                OTP_EXPIRY_MINUTES
            ]
        );

        await connection.commit();
        transactionStarted = false;

        return otp;
    } catch (error) {
        if (transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "OTP creation rollback failed:",
                    rollbackError.message
                );
            }
        }

        throw error;
    } finally {
        connection.release();
    }
}

async function verifyOTP(userId, purpose, otp, options = {}) {
    validateOTPConfig();
    validateOTPRequest(userId, purpose);

    const { consume = true, connection: suppliedConnection } = options;

    if (typeof consume !== "boolean") {
        throw new Error("OTP consume option must be a boolean.");
    }

    if (typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
        return {
            success: false,
            reason: "INVALID_OTP"
        };
    }

    const ownsConnection = !suppliedConnection;
    const connection = suppliedConnection || await pool.getConnection();

    let transactionStarted = false;

    try {
        // Standalone calls manage their own transaction.
        // A caller supplying a connection manages its transaction.
        if (ownsConnection) {
            await connection.beginTransaction();
            transactionStarted = true;
        }

        const [rows] = await connection.execute(
            `
            SELECT
                verification_id,
                otp_hash,
                expires_at,
                attempts,
                used,
                (expires_at <= NOW()) AS is_expired
            FROM email_verifications
            WHERE user_id = ?
              AND purpose = ?
              AND used = FALSE
            ORDER BY created_at DESC, verification_id DESC
            LIMIT 1
            FOR UPDATE
            `,
            [Number(userId), purpose]
        );

        if (rows.length === 0) {
            if (transactionStarted) {
                await connection.commit();
                transactionStarted = false;
            }

            return {
                success: false,
                reason: "OTP_NOT_FOUND"
            };
        }

        const verification = rows[0];

        if (Number(verification.is_expired) === 1) {
            await connection.execute(
                `
                UPDATE email_verifications
                SET used = TRUE
                WHERE verification_id = ?
                  AND used = FALSE
                `,
                [verification.verification_id]
            );

            if (transactionStarted) {
                await connection.commit();
                transactionStarted = false;
            }

            return {
                success: false,
                reason: "OTP_EXPIRED"
            };
        }

        if (Number(verification.attempts) >= OTP_MAX_ATTEMPTS) {
            if (transactionStarted) {
                await connection.commit();
                transactionStarted = false;
            }

            return {
                success: false,
                reason: "OTP_ATTEMPTS_EXCEEDED"
            };
        }

        const valid = await argon2.verify(
            verification.otp_hash,
            otp
        );

        if (!valid) {
            await connection.execute(
                `
                UPDATE email_verifications
                SET attempts = attempts + 1
                WHERE verification_id = ?
                  AND used = FALSE
                  AND attempts < ?
                `,
                [
                    verification.verification_id,
                    OTP_MAX_ATTEMPTS
                ]
            );

            if (transactionStarted) {
                await connection.commit();
                transactionStarted = false;
            }

            return {
                success: false,
                reason: "INVALID_OTP"
            };
        }

        if (consume) {
            await connection.execute(
                `
                UPDATE email_verifications
                SET used = TRUE
                WHERE verification_id = ?
                  AND used = FALSE
                `,
                [verification.verification_id]
            );
        }

        if (transactionStarted) {
            await connection.commit();
            transactionStarted = false;
        }

        return {
            success: true
        };
    } catch (error) {
        if (transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "OTP verification rollback failed:",
                    rollbackError.message
                );
            }
        }

        throw error;
    } finally {
        if (ownsConnection) {
            connection.release();
        }
    }
}

module.exports = {
    createOTP,
    verifyOTP
};
