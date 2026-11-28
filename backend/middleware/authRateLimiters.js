
const rateLimit = require("express-rate-limit");

function createAuthRateLimiter({ windowMs, limit, message }) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: {
            success: false,
            message
        },
        handler: (req, res, next, options) => {
            res.status(options.statusCode).json(options.message);
        }
    });
}

// Login: 10 requests per 15 minutes per IP.
const loginRateLimiter = createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: "Too many login attempts. Please try again after 15 minutes."
});

// Registration: 10 requests per 15 minutes per IP.
const registrationRateLimiter = createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: "Too many registration requests. Please try again later."
});

// Registration OTP verification.
const otpVerificationRateLimiter = createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: "Too many OTP verification attempts. Please try again later."
});

// Registration OTP resend.
const otpResendRateLimiter = createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: "Too many OTP resend requests. Please try again later."
});

// Password recovery request.
const passwordRecoveryRateLimiter = createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: "Too many password recovery requests. Please try again later."
});

// Password recovery OTP verification.
const passwordRecoveryVerificationRateLimiter = createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: "Too many password recovery OTP attempts. Please try again later."
});

// Password reset.
const passwordResetRateLimiter = createAuthRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: "Too many password reset requests. Please try again later."
});

module.exports = {
    loginRateLimiter,
    registrationRateLimiter,
    otpVerificationRateLimiter,
    otpResendRateLimiter,
    passwordRecoveryRateLimiter,
    passwordRecoveryVerificationRateLimiter,
    passwordResetRateLimiter
};
