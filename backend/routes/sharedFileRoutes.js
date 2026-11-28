
const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const {
    requestRecipientOTP,
    verifyRecipientOTP,
    getSharedFileInfo,
    previewSharedFile,
    downloadSharedFile
} = require("../controllers/sharedFileController");


/*
|--------------------------------------------------------------------------
| OTP REQUEST RATE LIMITER
|--------------------------------------------------------------------------
| Maximum 5 OTP requests per IP in 15 minutes.
|--------------------------------------------------------------------------
*/

const requestOTPLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message:
            "Too many OTP requests. Please try again later."
    }
});


/*
|--------------------------------------------------------------------------
| OTP VERIFICATION RATE LIMITER
|--------------------------------------------------------------------------
| Maximum 10 OTP verification attempts per IP in 15 minutes.
|--------------------------------------------------------------------------
*/

const verifyOTPLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message:
            "Too many OTP verification attempts. Please try again later."
    }
});


/*
|--------------------------------------------------------------------------
| PUBLIC SHARE ACCESS ROUTES
|--------------------------------------------------------------------------
|
| Base path:
| /api/shares/access
|
|--------------------------------------------------------------------------
*/


// Request email OTP
router.post(
    "/:shareToken/request-otp",
    requestOTPLimiter,
    requestRecipientOTP
);


// Verify email OTP
router.post(
    "/:shareToken/verify-otp",
    verifyOTPLimiter,
    verifyRecipientOTP
);


// Get shared file information (verified session required)
router.get(
    "/:shareToken",
    getSharedFileInfo
);


// Preview shared file (verified session required)
router.get(
    "/:shareToken/preview",
    previewSharedFile
);


// Download shared file (verified session + DOWNLOAD permission required)
router.get(
    "/:shareToken/download",
    downloadSharedFile
);


module.exports = router;
