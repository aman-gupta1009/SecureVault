
const express = require("express");
const router = express.Router();

// Existing authentication controller
const {
    register,
    verifyRegistrationOTP,
    resendRegistrationOTP,
    login,
    logout,
    logoutAll,
    getCurrentUser
} = require("../controllers/authController");

// Password recovery controller
const {
    requestPasswordRecovery,
    verifyPasswordRecoveryOTP,
    resetPassword
} = require("../controllers/passwordRecoveryController");

// Authentication middleware
const authMiddleware = require("../middleware/authMiddleware");

// Registration
router.post("/register", register);
router.post("/verify-otp", verifyRegistrationOTP);
router.post("/resend-otp", resendRegistrationOTP);

// Login and session management
router.post("/login", login);
router.get("/me", authMiddleware, getCurrentUser);
router.post("/logout", authMiddleware, logout);
router.post("/logout-all", authMiddleware, logoutAll);

// Password recovery
router.post("/forgot-password", requestPasswordRecovery);
router.post("/verify-reset-otp", verifyPasswordRecoveryOTP);
router.post("/reset-password", resetPassword);

module.exports = router;

