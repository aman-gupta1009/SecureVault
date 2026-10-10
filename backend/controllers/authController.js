const {
    registerSchema
} = require("../validators/authValidator");

const {
    registerUser,
    loginUser
} = require("../services/authService");

const {
    sendOTPEmail
} = require("../services/emailService");

const {
    verifyOTP,
    createOTP
} = require("../services/otpService");

const {
    pool
} = require("../config/database");

const {
    logSecurityEvent
} = require("../services/securityEventService");

const {
    createSession,
    revokeSession,
    revokeAllUserSessions
} = require("../services/sessionService");


// =====================================================
// REGISTER
// =====================================================

async function register(req, res, next) {

    try {

        const validation =
            registerSchema.safeParse(req.body);


        if (!validation.success) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid registration data",

                errors:
                    validation.error.flatten()

            });
        }


        const {
            email,
            password
        } = validation.data;


        const result =
            await registerUser(
                email,
                password
            );


        await sendOTPEmail(
            result.email,
            result.otp,
            "REGISTRATION"
        );


        return res.status(201).json({

            success: true,

            message:
                "Registration successful. OTP sent to your email.",

            data: {

                userId:
                    result.userId,

                email:
                    result.email

            }

        });

    } catch (error) {

        if (
            error.message ===
            "ACCOUNT_ALREADY_EXISTS"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "An account with this email already exists."

            });
        }


        next(error);
    }
}


// =====================================================
// VERIFY REGISTRATION OTP
// =====================================================

async function verifyRegistrationOTP(
    req,
    res,
    next
) {

    try {

        const {
            email,
            otp
        } = req.body;


        if (
            typeof email !== "string" ||
            typeof otp !== "string"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and OTP are required."

            });
        }


        const normalizedEmail =
            email.trim().toLowerCase();

        const normalizedOTP =
            otp.trim();


        if (!/^\d{6}$/.test(normalizedOTP)) {

            return res.status(400).json({

                success: false,

                message:
                    "OTP must be a 6-digit number."

            });
        }


        const [
            users
        ] = await pool.execute(

            `
            SELECT
                user_id,
                email,
                email_verified
            FROM users
            WHERE email = ?
            LIMIT 1
            `,

            [
                normalizedEmail
            ]

        );


        if (users.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Account not found."

            });
        }


        const user =
            users[0];


        if (user.email_verified === 1) {

            return res.status(400).json({

                success: false,

                message:
                    "Email is already verified."

            });
        }


        const verification =
            await verifyOTP(
                user.user_id,
                "REGISTRATION",
                normalizedOTP
            );


        if (!verification.success) {

            switch (
                verification.reason
            ) {

                case "OTP_NOT_FOUND":

                    return res.status(400).json({

                        success: false,

                        message:
                            "No active OTP found. Please request a new OTP."

                    });


                case "OTP_EXPIRED":

                    return res.status(400).json({

                        success: false,

                        message:
                            "OTP has expired. Please request a new OTP."

                    });


                case "OTP_ATTEMPTS_EXCEEDED":

                    return res.status(429).json({

                        success: false,

                        message:
                            "Too many incorrect OTP attempts. Please request a new OTP."

                    });


                case "INVALID_OTP":

                    return res.status(400).json({

                        success: false,

                        message:
                            "Invalid OTP."

                    });


                default:

                    return res.status(400).json({

                        success: false,

                        message:
                            "OTP verification failed."

                    });
            }
        }


        await pool.execute(

            `
            UPDATE users
            SET email_verified = TRUE
            WHERE user_id = ?
            `,

            [
                user.user_id
            ]

        );


        return res.status(200).json({

            success: true,

            message:
                "Email verified successfully.",

            data: {

                userId:
                    user.user_id,

                email:
                    user.email,

                emailVerified:
                    true

            }

        });

    } catch (error) {

        next(error);

    }
}


// =====================================================
// RESEND REGISTRATION OTP
// =====================================================

async function resendRegistrationOTP(
    req,
    res,
    next
) {

    try {

        const {
            email
        } = req.body;


        if (
            typeof email !== "string"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Email is required."

            });
        }


        const normalizedEmail =
            email.trim().toLowerCase();


        const [
            users
        ] = await pool.execute(

            `
            SELECT
                user_id,
                email,
                email_verified
            FROM users
            WHERE email = ?
            LIMIT 1
            `,

            [
                normalizedEmail
            ]

        );


        if (users.length === 0) {

            return res.status(404).json({

                success: false,

                message:
                    "Account not found."

            });
        }


        const user =
            users[0];


        if (user.email_verified === 1) {

            return res.status(400).json({

                success: false,

                message:
                    "Email is already verified."

            });
        }


        const resendCooldownSeconds =
            Number(
                process.env.OTP_RESEND_SECONDS || 60
            );


        const [
            recentOTP
        ] = await pool.execute(

            `
            SELECT
                created_at
            FROM email_verifications
            WHERE user_id = ?
            AND purpose = 'REGISTRATION'
            ORDER BY created_at DESC
            LIMIT 1
            `,

            [
                user.user_id
            ]

        );


        if (recentOTP.length > 0) {

            const createdAt =
                new Date(
                    recentOTP[0].created_at
                );


            const elapsedSeconds =
                Math.floor(
                    (
                        Date.now() -
                        createdAt.getTime()
                    ) / 1000
                );


            if (
                elapsedSeconds <
                resendCooldownSeconds
            ) {

                const retryAfter =
                    resendCooldownSeconds -
                    elapsedSeconds;


                return res.status(429).json({

                    success: false,

                    message:
                        `Please wait ${retryAfter} seconds before requesting another OTP.`,

                    retryAfter

                });
            }
        }


        const otp =
            await createOTP(
                user.user_id,
                "REGISTRATION"
            );


        await sendOTPEmail(
            user.email,
            otp,
            "REGISTRATION"
        );


        return res.status(200).json({

            success: true,

            message:
                "A new OTP has been sent to your email."

        });

    } catch (error) {

        next(error);

    }
}

// =====================================================
// LOGIN
// =====================================================

async function login(
    req,
    res,
    next
) {

    try {

        const {
            email,
            password
        } = req.body;


        // -------------------------------------------------
        // VALIDATE INPUT
        // -------------------------------------------------

        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Email and password are required."

            });
        }


        const normalizedEmail =
            email.trim().toLowerCase();


        // -------------------------------------------------
        // FIND USER
        // -------------------------------------------------

        const [
            users
        ] = await pool.execute(

            `
            SELECT
                user_id,
                email,
                password_hash,
                email_verified,
                account_status,
                failed_login_attempts,
                locked_until

            FROM users

            WHERE email = ?

            LIMIT 1
            `,

            [
                normalizedEmail
            ]

        );


        // -------------------------------------------------
        // USER NOT FOUND
        // -------------------------------------------------

        if (
            users.length === 0
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid email or password."

            });
        }


        const user =
            users[0];


        // -------------------------------------------------
        // DISABLED ACCOUNT
        // -------------------------------------------------

        if (
            user.account_status ===
            "DISABLED"
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "This account has been disabled."

            });
        }


        // -------------------------------------------------
        // CHECK TEMPORARY LOGIN LOCK
        // -------------------------------------------------

        if (
            user.locked_until &&
            new Date(user.locked_until) > new Date()
        ) {

            const remainingMs =
                new Date(
                    user.locked_until
                ).getTime() -
                Date.now();


            const remainingMinutes =
                Math.ceil(
                    remainingMs / 60000
                );


            return res.status(429).json({

                success: false,

                message:
                    `Too many failed login attempts. Please try again in ${remainingMinutes} minute(s).`,

                retryAfter:
                    remainingMinutes

            });
        }


        // -------------------------------------------------
        // CLEAR EXPIRED LOCK
        // -------------------------------------------------

        if (
            user.locked_until &&
            new Date(user.locked_until) <= new Date()
        ) {

            await pool.execute(

                `
                UPDATE users

                SET
                    failed_login_attempts = 0,
                    locked_until = NULL,
                    account_status = 'ACTIVE'

                WHERE user_id = ?
                `,

                [
                    user.user_id
                ]

            );


            user.failed_login_attempts = 0;
            user.locked_until = null;
            user.account_status = "ACTIVE";
        }


        // -------------------------------------------------
        // EMAIL VERIFICATION CHECK
        // -------------------------------------------------

        if (
            user.email_verified !== 1
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Please verify your email before logging in."

            });
        }


        // -------------------------------------------------
        // VERIFY PASSWORD
        // -------------------------------------------------

        const argon2 =
            require("argon2");


        const passwordValid =
            await argon2.verify(
                user.password_hash,
                password
            );


        // -------------------------------------------------
        // INVALID PASSWORD
        // -------------------------------------------------

        if (!passwordValid) {

            const maxAttempts =
                Number(
                    process.env.MAX_LOGIN_ATTEMPTS || 5
                );


            const lockMinutes =
                Number(
                    process.env.LOGIN_LOCK_MINUTES || 15
                );


            const currentAttempts =
                Number(
                    user.failed_login_attempts || 0
                );


            const newAttempts =
                currentAttempts + 1;


            // ---------------------------------------------
            // MAXIMUM ATTEMPTS REACHED
            // ---------------------------------------------

            if (
                newAttempts >=
                maxAttempts
            ) {

                // -----------------------------------------
                // LOCK ACCOUNT
                // -----------------------------------------

                await pool.execute(

                    `
                    UPDATE users

                    SET
                        failed_login_attempts = ?,

                        locked_until =
                            DATE_ADD(
                                NOW(),
                                INTERVAL ? MINUTE
                            ),

                        account_status = 'LOCKED'

                    WHERE user_id = ?
                    `,

                    [
                        newAttempts,
                        lockMinutes,
                        user.user_id
                    ]

                );


                // -----------------------------------------
                // LOG FAILED LOGIN
                // -----------------------------------------

                await logSecurityEvent({

                    userId:
                        user.user_id,

                    eventType:
                        "LOGIN_FAILED",

                    req,

                    metadata: {

                        reason:
                            "INVALID_PASSWORD",

                        failedAttempts:
                            newAttempts,

                        remainingAttempts:
                            0

                    }

                });


                // -----------------------------------------
                // LOG ACCOUNT LOCKED
                // -----------------------------------------

                await logSecurityEvent({

                    userId:
                        user.user_id,

                    eventType:
                        "ACCOUNT_LOCKED",

                    req,

                    metadata: {

                        reason:
                            "MAX_LOGIN_ATTEMPTS_EXCEEDED",

                        failedAttempts:
                            newAttempts,

                        lockMinutes:
                            lockMinutes

                    }

                });


                // -----------------------------------------
                // RETURN LOCK RESPONSE
                // -----------------------------------------

                return res.status(429).json({

                    success:
                        false,

                    message:
                        `Too many failed login attempts. Account locked for ${lockMinutes} minutes.`,

                    retryAfter:
                        lockMinutes

                });
            }


            // ---------------------------------------------
            // INCREMENT FAILED ATTEMPTS
            // ---------------------------------------------

            await pool.execute(

                `
                UPDATE users

                SET
                    failed_login_attempts = ?

                WHERE user_id = ?
                `,

                [
                    newAttempts,
                    user.user_id
                ]

            );


            // ---------------------------------------------
            // LOG FAILED LOGIN
            // ---------------------------------------------

            await logSecurityEvent({

                userId:
                    user.user_id,

                eventType:
                    "LOGIN_FAILED",

                req,

                metadata: {

                    reason:
                        "INVALID_PASSWORD",

                    failedAttempts:
                        newAttempts,

                    remainingAttempts:
                        maxAttempts -
                        newAttempts

                }

            });


            const remainingAttempts =
                maxAttempts -
                newAttempts;


            // ---------------------------------------------
            // RETURN INVALID PASSWORD
            // ---------------------------------------------

            return res.status(401).json({

                success:
                    false,

                message:
                    "Invalid email or password.",

                remainingAttempts

            });
        }


        // -------------------------------------------------
        // SUCCESSFUL LOGIN
        // -------------------------------------------------

        await pool.execute(

            `
            UPDATE users

            SET
                failed_login_attempts = 0,
                locked_until = NULL,
                account_status = 'ACTIVE',
                last_login_at = NOW()

            WHERE user_id = ?
            `,

            [
                user.user_id
            ]

        );


        // -------------------------------------------------
        // CREATE SECURE SESSION
        // -------------------------------------------------

        const session =
            await createSession(
                user.user_id,
                req
            );


        // -------------------------------------------------
        // LOG LOGIN SUCCESS
        // -------------------------------------------------

        await logSecurityEvent({

            userId:
                user.user_id,

            eventType:
                "LOGIN_SUCCESS",

            req,

            metadata: {

                sessionId:
                    session.sessionId

            }

        });


        // -------------------------------------------------
        // COOKIE CONFIGURATION
        // -------------------------------------------------

        const cookieName =
            process.env.SESSION_COOKIE_NAME ||
            "securevault_session";


        const secure =
            process.env.SESSION_COOKIE_SECURE ===
            "true";


        const sameSite =
            process.env.SESSION_COOKIE_SAME_SITE ||
            "lax";


        // -------------------------------------------------
        // SEND HTTP-ONLY COOKIE
        // -------------------------------------------------

        res.cookie(

            cookieName,

            session.sessionToken,

            {

                httpOnly: true,

                secure,

                sameSite,

                expires:
                    session.expiresAt,

                path: "/"

            }

        );


        // -------------------------------------------------
        // LOGIN RESPONSE
        // -------------------------------------------------

        return res.status(200).json({

            success:
                true,

            message:
                "Login successful.",

            data: {

                userId:
                    user.user_id,

                email:
                    user.email,

                sessionExpiresAt:
                    session.expiresAt

            }

        });

    } catch (error) {

        next(error);

    }
}

// =====================================================
// LOGOUT
// =====================================================

async function logout(
    req,
    res,
    next
) {

    try {

        const cookieName =
            process.env.SESSION_COOKIE_NAME ||
            "securevault_session";


        const sessionToken =
            req.cookies[cookieName];


        if (sessionToken) {

            await revokeSession(
                sessionToken
            );

        }


        // -------------------------------------------------
        // LOG LOGOUT SECURITY EVENT
        // -------------------------------------------------

        if (req.user) {

            await logSecurityEvent({

                userId:
                    req.user.userId,

                eventType:
                    "LOGOUT",

                req,

                metadata: {
                    method: "USER_LOGOUT"
                }

            });

        }


        res.clearCookie(

            cookieName,

            {

                httpOnly: true,

                secure:
                    process.env.SESSION_COOKIE_SECURE ===
                    "true",

                sameSite:
                    process.env.SESSION_COOKIE_SAME_SITE ||
                    "lax",

                path: "/"

            }

        );


        return res.status(200).json({

            success:
                true,

            message:
                "Logout successful."

        });

    } catch (error) {

        next(error);

    }
}


// =====================================================
// LOGOUT FROM ALL DEVICES
// =====================================================

async function logoutAll(
    req,
    res,
    next
) {

    try {

        await revokeAllUserSessions(
            req.user.userId
        );


        // -------------------------------------------------
        // LOG LOGOUT ALL SECURITY EVENT
        // -------------------------------------------------

        await logSecurityEvent({

            userId:
                req.user.userId,

            eventType:
                "LOGOUT_ALL",

            req,

            metadata: {
                method: "USER_LOGOUT_ALL_DEVICES"
            }

        });


        const cookieName =
            process.env.SESSION_COOKIE_NAME ||
            "securevault_session";


        res.clearCookie(

            cookieName,

            {

                httpOnly: true,

                secure:
                    process.env.SESSION_COOKIE_SECURE ===
                    "true",

                sameSite:
                    process.env.SESSION_COOKIE_SAME_SITE ||
                    "lax",

                path: "/"

            }

        );


        return res.status(200).json({

            success:
                true,

            message:
                "Logged out from all devices."

        });

    } catch (error) {

        next(error);

    }
}


// =====================================================
// GET CURRENT USER
// =====================================================

async function getCurrentUser(
    req,
    res
) {

    return res.status(200).json({

        success:
            true,

        data: {

            userId:
                req.user.userId,

            email:
                req.user.email

        }

    });
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    register,

    verifyRegistrationOTP,

    resendRegistrationOTP,

    login,

    logout,

    logoutAll,

    getCurrentUser

};