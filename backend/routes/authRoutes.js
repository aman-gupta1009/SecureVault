
const express = require("express");
const router = express.Router();

// Authentication controller.
const {
    register,
    verifyRegistrationOTP,
    resendRegistrationOTP,
    login,
    logout,
    logoutAll,
    getCurrentUser
} = require("../controllers/authController");

// Password recovery controller.
const {
    requestPasswordRecovery,
    verifyPasswordRecoveryOTP,
    resetPassword
} = require("../controllers/passwordRecoveryController");

// Authentication middleware.
const authMiddleware = require("../middleware/authMiddleware");

// Dedicated authentication rate limiters.
const {
    loginRateLimiter,
    registrationRateLimiter,
    otpVerificationRateLimiter,
    otpResendRateLimiter,
    passwordRecoveryRateLimiter,
    passwordRecoveryVerificationRateLimiter,
    passwordResetRateLimiter
} = require("../middleware/authRateLimiters");

// Registration.
router.post(
    "/register",
    registrationRateLimiter,
    register
);

router.post(
    "/verify-otp",
    otpVerificationRateLimiter,
    verifyRegistrationOTP
);

router.post(
    "/resend-otp",
    otpResendRateLimiter,
    resendRegistrationOTP
);

// Login.
router.post(
    "/login",
    loginRateLimiter,
    login
);

// Authenticated user and session management.
router.get(
    "/me",
    authMiddleware,
    getCurrentUser
);

router.post(
    "/logout",
    authMiddleware,
    logout
);

router.post(
    "/logout-all",
    authMiddleware,
    logoutAll
);

// Password recovery.
router.post(
    "/forgot-password",
    passwordRecoveryRateLimiter,
    requestPasswordRecovery
);

router.post(
    "/verify-reset-otp",
    passwordRecoveryVerificationRateLimiter,
    verifyPasswordRecoveryOTP
);

router.post(
    "/reset-password",
    passwordResetRateLimiter,
    resetPassword
);

module.exports = router;
