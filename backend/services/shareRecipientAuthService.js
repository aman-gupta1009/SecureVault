
const crypto = require("crypto");
const argon2 = require("argon2");

const { pool } = require("../config/database");
const emailService = require("./shareEmailService");

const OTP_EXPIRY_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const RECIPIENT_SESSION_MINUTES = 30;

function createAuthError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    throw error;
}

function normalizeEmail(email) {
    if (typeof email !== "string") {
        createAuthError("INVALID_RECIPIENT_EMAIL");
    }

    const normalized = email.trim().toLowerCase();

    if (
        normalized.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ) {
        createAuthError("INVALID_RECIPIENT_EMAIL");
    }

    return normalized;
}

function validateShareToken(token) {
    if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/i.test(token)
    ) {
        createAuthError("INVALID_SHARE_TOKEN", 400);
    }

    return crypto
        .createHash("sha256")
        .update(token, "utf8")
        .digest("hex");
}

function hashSessionToken(token) {
    return crypto
        .createHash("sha256")
        .update(token, "utf8")
        .digest("hex");
}

function generateOTP() {
    return crypto
        .randomInt(100000, 1000000)
        .toString();
}

function generateSessionToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}

function assertShareActive(share) {
    if (!share) {
        createAuthError("SHARE_NOT_FOUND", 404);
    }

    if (Number(share.revoked) === 1) {
        createAuthError("SHARE_REVOKED", 410);
    }

    if (
        share.expires_at &&
        new Date(share.expires_at).getTime() <= Date.now()
    ) {
        createAuthError("SHARE_EXPIRED", 410);
    }
}

/*
|--------------------------------------------------------------------------
| REQUEST SHARE ACCESS OTP
|--------------------------------------------------------------------------
*/

async function requestShareAccessOTP(shareToken, recipientEmail) {
    const tokenHash = validateShareToken(shareToken);
    const email = normalizeEmail(recipientEmail);

    const connection = await pool.getConnection();

    let otp;
    let otpHash;
    let shareId;

    try {
        await connection.beginTransaction();

        const [shareRows] = await connection.execute(
            `
            SELECT
                share_id,
                recipient_email,
                expires_at,
                revoked
            FROM file_shares
            WHERE share_token_hash = ?
            LIMIT 1
            FOR UPDATE
            `,
            [tokenHash]
        );

        const share = shareRows[0];

        assertShareActive(share);

        // If the owner fixed an email, no other email is allowed.
        if (
            share.recipient_email &&
            share.recipient_email.trim().toLowerCase() !== email
        ) {
            createAuthError(
                "RECIPIENT_EMAIL_NOT_ALLOWED",
                403
            );
        }

        shareId = Number(share.share_id);

        const [recentRows] = await connection.execute(
            `
            SELECT
                otp_id,
                last_sent_at
            FROM share_recipient_otps
            WHERE share_id = ?
              AND recipient_email = ?
              AND used = 0
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
            `,
            [shareId, email]
        );

        if (recentRows.length > 0) {
            const lastSentAt = new Date(
                recentRows[0].last_sent_at
            ).getTime();

            const elapsedSeconds =
                (Date.now() - lastSentAt) / 1000;

            if (
                Number.isFinite(elapsedSeconds) &&
                elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS
            ) {
                createAuthError(
                    "OTP_RESEND_COOLDOWN",
                    429
                );
            }
        }

        // Invalidate previous unused OTPs for this share/email.
        await connection.execute(
            `
            UPDATE share_recipient_otps
            SET used = 1
            WHERE share_id = ?
              AND recipient_email = ?
              AND used = 0
            `,
            [shareId, email]
        );

        otp = generateOTP();

        otpHash = await argon2.hash(otp, {
            type: argon2.argon2id
        });

        await connection.execute(
            `
            INSERT INTO share_recipient_otps
            (
                share_id,
                recipient_email,
                otp_hash,
                expires_at,
                attempts,
                used,
                last_sent_at
            )
            VALUES
            (
                ?,
                ?,
                ?,
                DATE_ADD(NOW(), INTERVAL ? MINUTE),
                0,
                0,
                CURRENT_TIMESTAMP
            )
            `,
            [
                shareId,
                email,
                otpHash,
                OTP_EXPIRY_MINUTES
            ]
        );

        await connection.commit();
    }  catch (error) {
    try {
        await connection.rollback();
    } catch (rollbackError) {
        // Preserve the original error.
    }

    throw error;
}finally {
        connection.release();
    }

    /*
     * Send the email after committing the OTP record.
     * If sending fails, invalidate that OTP.
     */

    try {
        if (
            typeof emailService.sendShareAccessOTPEmail !== "function"
        ) {
            throw new Error(
                "SHARE_OTP_EMAIL_FUNCTION_NOT_CONFIGURED"
            );
        }

        await emailService.sendShareAccessOTPEmail(
            email,
            otp
        );
    } catch (error) {
        await pool.execute(
            `
            UPDATE share_recipient_otps
            SET used = 1
            WHERE share_id = ?
              AND recipient_email = ?
              AND otp_hash = ?
              AND used = 0
            `,
            [shareId, email, otpHash]
        );

        throw error;
    }

    return {
        success: true,
        message: "If the recipient is eligible, a verification code has been sent.",
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS
    };
}

/*
|--------------------------------------------------------------------------
| VERIFY SHARE ACCESS OTP
|--------------------------------------------------------------------------
*/

async function verifyShareAccessOTP(
    shareToken,
    recipientEmail,
    submittedOTP
) {
    const tokenHash = validateShareToken(shareToken);
    const email = normalizeEmail(recipientEmail);

    if (
        typeof submittedOTP !== "string" ||
        !/^\d{6}$/.test(submittedOTP.trim())
    ) {
        createAuthError("INVALID_OTP_FORMAT", 400);
    }

    const otp = submittedOTP.trim();

    const connection = await pool.getConnection();

    let result;
    let sessionToken;

    try {
        await connection.beginTransaction();

        const [shareRows] = await connection.execute(
            `
            SELECT
                share_id,
                recipient_email,
                expires_at,
                revoked
            FROM file_shares
            WHERE share_token_hash = ?
            LIMIT 1
            FOR UPDATE
            `,
            [tokenHash]
        );

        const share = shareRows[0];

        assertShareActive(share);

        if (
            share.recipient_email &&
            share.recipient_email.trim().toLowerCase() !== email
        ) {
            createAuthError(
                "RECIPIENT_EMAIL_NOT_ALLOWED",
                403
            );
        }

        const shareId = Number(share.share_id);

        const [otpRows] = await connection.execute(
            `
            SELECT
                otp_id,
                otp_hash,
                expires_at,
                attempts
            FROM share_recipient_otps
            WHERE share_id = ?
              AND recipient_email = ?
              AND used = 0
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
            `,
            [shareId, email]
        );

        if (otpRows.length === 0) {
            createAuthError("OTP_NOT_FOUND_OR_ALREADY_USED", 400);
        }

        const otpRecord = otpRows[0];

        if (Number(otpRecord.attempts) >= OTP_MAX_ATTEMPTS) {
            await connection.execute(
                `
                UPDATE share_recipient_otps
                SET used = 1
                WHERE otp_id = ?
                `,
                [otpRecord.otp_id]
            );

            await connection.commit();

            createAuthError("OTP_MAX_ATTEMPTS_REACHED", 429);
        }

        if (
            new Date(otpRecord.expires_at).getTime() <= Date.now()
        ) {
            await connection.execute(
                `
                UPDATE share_recipient_otps
                SET used = 1
                WHERE otp_id = ?
                `,
                [otpRecord.otp_id]
            );

            await connection.commit();

            createAuthError("OTP_EXPIRED", 400);
        }

        const isValid = await argon2.verify(
            otpRecord.otp_hash,
            otp
        );

        if (!isValid) {
            const nextAttempts =
                Number(otpRecord.attempts) + 1;

            await connection.execute(
                `
                UPDATE share_recipient_otps
                SET
                    attempts = ?,
                    used = ?
                WHERE otp_id = ?
                `,
                [
                    nextAttempts,
                    nextAttempts >= OTP_MAX_ATTEMPTS ? 1 : 0,
                    otpRecord.otp_id
                ]
            );

            await connection.commit();

            createAuthError(
                nextAttempts >= OTP_MAX_ATTEMPTS
                    ? "OTP_MAX_ATTEMPTS_REACHED"
                    : "INVALID_OTP",
                nextAttempts >= OTP_MAX_ATTEMPTS ? 429 : 400
            );
        }

        await connection.execute(
            `
            UPDATE share_recipient_otps
            SET used = 1
            WHERE otp_id = ?
            `,
            [otpRecord.otp_id]
        );

        sessionToken = generateSessionToken();

        const sessionTokenHash = hashSessionToken(
            sessionToken
        );

        await connection.execute(
            `
            INSERT INTO share_access_sessions
            (
                share_id,
                recipient_email,
                session_token_hash,
                expires_at,
                revoked
            )
            VALUES
            (
                ?,
                ?,
                ?,
                CASE
                    WHEN ? IS NULL
                        THEN DATE_ADD(
                            NOW(),
                            INTERVAL ? MINUTE
                        )
                    ELSE LEAST(
                        DATE_ADD(
                            NOW(),
                            INTERVAL ? MINUTE
                        ),
                        ?
                    )
                END,
                0
            )
            `,
            [
                shareId,
                email,
                sessionTokenHash,
                share.expires_at,
                RECIPIENT_SESSION_MINUTES,
                RECIPIENT_SESSION_MINUTES,
                share.expires_at
            ]
        );

        const [sessionRows] = await connection.execute(
            `
            SELECT expires_at
            FROM share_access_sessions
            WHERE session_token_hash = ?
            LIMIT 1
            `,
            [sessionTokenHash]
        );

        result = {
            success: true,
            sessionToken,
            recipientEmail: email,
            expiresAt: sessionRows[0].expires_at
        };

        await connection.commit();
    } catch (error) {
        try {
            await connection.rollback();
        } catch {
            // Preserve the original error.
        }

        throw error;
    } finally {
        connection.release();
    }

    return result;
}

/*
|--------------------------------------------------------------------------
| VALIDATE RECIPIENT SESSION
|--------------------------------------------------------------------------
*/

async function validateShareRecipientSession(
    shareToken,
    sessionToken
) {
    const tokenHash = validateShareToken(shareToken);

    if (
        typeof sessionToken !== "string" ||
        !/^[a-f0-9]{64}$/i.test(sessionToken)
    ) {
        createAuthError(
            "RECIPIENT_SESSION_REQUIRED",
            401
        );
    }

    const sessionHash = hashSessionToken(sessionToken);

    const [rows] = await pool.execute(
        `
        SELECT
            s.session_id,
            s.share_id,
            s.recipient_email,
            s.expires_at AS session_expires_at,
            s.revoked AS session_revoked,

            fs.file_id,
            fs.owner_user_id,
            fs.recipient_email AS fixed_recipient_email,
            fs.permission_type,
            fs.watermark_enabled,
            fs.expires_at AS share_expires_at,
            fs.max_downloads,
            fs.download_count,
            fs.revoked AS share_revoked

        FROM share_access_sessions s

        INNER JOIN file_shares fs
            ON fs.share_id = s.share_id

        WHERE s.session_token_hash = ?
          AND fs.share_token_hash = ?
        LIMIT 1
        `,
        [sessionHash, tokenHash]
    );

    if (rows.length === 0) {
        createAuthError(
            "INVALID_RECIPIENT_SESSION",
            401
        );
    }

    const session = rows[0];

    if (
        Number(session.session_revoked) === 1 ||
        Number(session.share_revoked) === 1
    ) {
        createAuthError(
            "RECIPIENT_SESSION_REVOKED",
            410
        );
    }

    const now = Date.now();

    if (
        new Date(session.session_expires_at).getTime() <= now
    ) {
        createAuthError(
            "RECIPIENT_SESSION_EXPIRED",
            401
        );
    }

    if (
        session.share_expires_at &&
        new Date(session.share_expires_at).getTime() <= now
    ) {
        createAuthError("SHARE_EXPIRED", 410);
    }

    if (
        session.fixed_recipient_email &&
        session.fixed_recipient_email.trim().toLowerCase() !==
            session.recipient_email.trim().toLowerCase()
    ) {
        createAuthError(
            "RECIPIENT_EMAIL_NOT_ALLOWED",
            403
        );
    }

    return session;
}

module.exports = {
    requestShareAccessOTP,
    verifyShareAccessOTP,
    validateShareRecipientSession
};
