
const argon2 = require("argon2");
const { z } = require("zod");

const { pool } = require("../config/database");
const { createOTP, verifyOTP } = require("../services/otpService");
const { sendOTPEmail } = require("../services/emailService");
const { revokeAllUserSessions } = require("../services/sessionService");

// Password validation: same basic rules as registration
const passwordSchema = z
    .string()
    .min(12, "Password must be at least 12 characters")
    .max(128, "Password must not exceed 128 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/[0-9]/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

const emailSchema = z.string().trim().email();
const otpSchema = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

// 1. REQUEST PASSWORD RECOVERY OTP
async function requestPasswordRecovery(req, res, next) {
    try {
        const emailResult = emailSchema.safeParse(req.body?.email);

        if (!emailResult.success) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        const email = emailResult.data.toLowerCase();

        const [users] = await pool.execute(
            `SELECT user_id, email, email_verified, account_status
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [email]
        );

        // Use the same response for unknown and ineligible accounts
        // to avoid revealing which email addresses are registered.
        const genericMessage =
            "If an eligible account exists, password recovery instructions will be sent to its email.";

        if (
            users.length === 0 ||
            !users[0].email_verified ||
            users[0].account_status === "DISABLED"
        ) {
            return res.status(200).json({
                success: true,
                message: genericMessage
            });
        }

        const user = users[0];

        // Enforce a resend cooldown for password recovery.
        const resendSeconds = Number(
            process.env.OTP_RESEND_SECONDS || 60
        );

        const [recentOTPs] = await pool.execute(
            `SELECT created_at
             FROM email_verifications
             WHERE user_id = ?
               AND purpose = 'PASSWORD_RECOVERY'
             ORDER BY created_at DESC
             LIMIT 1`,
            [user.user_id]
        );

        if (recentOTPs.length > 0) {
            const createdAt = new Date(recentOTPs[0].created_at).getTime();
            const elapsedSeconds = (Date.now() - createdAt) / 1000;

            if (elapsedSeconds < resendSeconds) {
                return res.status(200).json({
                    success: true,
                    message: genericMessage
                });
            }
        }

        const otp = await createOTP(
            user.user_id,
            "PASSWORD_RECOVERY"
        );

        await sendOTPEmail(
            user.email,
            otp,
            "PASSWORD_RECOVERY"
        );

        return res.status(200).json({
            success: true,
            message: genericMessage
        });
    } catch (error) {
        next(error);
    }
}

// 2. VERIFY PASSWORD RECOVERY OTP
async function verifyPasswordRecoveryOTP(req, res, next) {
    try {
        const emailResult = emailSchema.safeParse(req.body?.email);
        const otpResult = otpSchema.safeParse(
            String(req.body?.otp ?? "")
        );

        if (!emailResult.success || !otpResult.success) {
            return res.status(400).json({
                success: false,
                message: "Enter a valid email address and 6-digit OTP."
            });
        }

        const email = emailResult.data.toLowerCase();

        const [users] = await pool.execute(
            `SELECT user_id, account_status
             FROM users
             WHERE email = ?
               AND email_verified = TRUE
             LIMIT 1`,
            [email]
        );

        if (
            users.length === 0 ||
            users[0].account_status === "DISABLED"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP."
            });
        }

        const result = await verifyOTP(
            users[0].user_id,
            "PASSWORD_RECOVERY",
            otpResult.data,
            { consume: false }
        );

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP."
            });
        }

        return res.status(200).json({
            success: true,
            message: "OTP verified. You can now reset your password."
        });
    } catch (error) {
        next(error);
    }
}

// 3. RESET PASSWORD
async function resetPassword(req, res, next) {
    try {
        const emailResult = emailSchema.safeParse(req.body?.email);
        const otpResult = otpSchema.safeParse(
            String(req.body?.otp ?? "")
        );
        const passwordResult = passwordSchema.safeParse(
            req.body?.newPassword
        );

        if (
            !emailResult.success ||
            !otpResult.success ||
            !passwordResult.success
        ) {
            return res.status(400).json({
                success: false,
                message: "Provide a valid email, 6-digit OTP, and a password meeting all security requirements."
            });
        }

        const email = emailResult.data.toLowerCase();

        const [users] = await pool.execute(
            `SELECT user_id, account_status
             FROM users
             WHERE email = ?
               AND email_verified = TRUE
             LIMIT 1`,
            [email]
        );

        if (
            users.length === 0 ||
            users[0].account_status === "DISABLED"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP."
            });
        }

        const user = users[0];

        // Verify and consume the OTP before changing the password.
        const otpVerification = await verifyOTP(
            user.user_id,
            "PASSWORD_RECOVERY",
            otpResult.data,
            { consume: true }
        );

        if (!otpVerification.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP."
            });
        }

        const passwordHash = await argon2.hash(
            passwordResult.data,
            { type: argon2.argon2id }
        );

        await pool.execute(
            `UPDATE users
             SET password_hash = ?,
                 failed_login_attempts = 0,
                 locked_until = NULL,
                 account_status = CASE
                     WHEN account_status = 'LOCKED' THEN 'ACTIVE'
                     ELSE account_status
                 END
             WHERE user_id = ?`,
            [passwordHash, user.user_id]
        );

        // Invalidate sessions on all devices after a password change.
        await revokeAllUserSessions(user.user_id);

        return res.status(200).json({
            success: true,
            message: "Password reset successfully. Please log in again."
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    requestPasswordRecovery,
    verifyPasswordRecoveryOTP,
    resetPassword
};

