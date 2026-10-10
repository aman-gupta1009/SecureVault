
const argon2 = require("argon2");

const { pool } = require("../config/database");
const { generateOTP } = require("../utils/otp");

const OTP_EXPIRY_MINUTES = Number(
    process.env.OTP_EXPIRY_MINUTES || 10
);

const OTP_MAX_ATTEMPTS = Number(
    process.env.OTP_MAX_ATTEMPTS || 5
);

async function createOTP(userId, purpose) {
    const otp = generateOTP();

    // Store only a hash of the OTP.
    const otpHash = await argon2.hash(otp, {
        type: argon2.argon2id
    });

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        await connection.execute(
            `
            UPDATE email_verifications
            SET used = TRUE
            WHERE user_id = ?
              AND purpose = ?
              AND used = FALSE
            `,
            [userId, purpose]
        );

        await connection.execute(
            `
            INSERT INTO email_verifications
                (user_id, otp_hash, purpose, expires_at)
            VALUES
                (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
            `,
            [userId, otpHash, purpose, OTP_EXPIRY_MINUTES]
        );

        await connection.commit();
        return otp;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function verifyOTP(userId, purpose, otp, options = {}) {
    const { consume = true } = options;

    const [rows] = await pool.execute(
        `
        SELECT
            verification_id,
            otp_hash,
            expires_at,
            attempts,
            used
        FROM email_verifications
        WHERE user_id = ?
          AND purpose = ?
          AND used = FALSE
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [userId, purpose]
    );

    if (rows.length === 0) {
        return {
            success: false,
            reason: "OTP_NOT_FOUND"
        };
    }

    const verification = rows[0];

    if (new Date(verification.expires_at).getTime() <= Date.now()) {
        await pool.execute(
            `
            UPDATE email_verifications
            SET used = TRUE
            WHERE verification_id = ?
            `,
            [verification.verification_id]
        );

        return {
            success: false,
            reason: "OTP_EXPIRED"
        };
    }

    if (Number(verification.attempts) >= OTP_MAX_ATTEMPTS) {
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
        await pool.execute(
            `
            UPDATE email_verifications
            SET attempts = attempts + 1
            WHERE verification_id = ?
            `,
            [verification.verification_id]
        );

        return {
            success: false,
            reason: "INVALID_OTP"
        };
    }

    if (consume) {
        await pool.execute(
            `
            UPDATE email_verifications
            SET used = TRUE
            WHERE verification_id = ?
              AND used = FALSE
            `,
            [verification.verification_id]
        );
    }

    return {
        success: true
    };
}

module.exports = {
    createOTP,
    verifyOTP
};