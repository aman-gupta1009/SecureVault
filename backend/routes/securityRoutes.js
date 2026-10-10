const express = require("express");

const {
    getSecurityEvents
} = require("../controllers/securityEventController");

const {
    getDashboard
} = require("../controllers/securityDashboardController");

const {
    getAlerts
} = require("../controllers/securityAlertController");

const authMiddlewareModule = require("../middleware/authMiddleware");

const requireAuth =
    authMiddlewareModule.requireAuth ||
    authMiddlewareModule.authenticate ||
    authMiddlewareModule.authenticateUser ||
    authMiddlewareModule;

if (typeof requireAuth !== "function") {
    throw new Error(
        "Authentication middleware function could not be resolved from authMiddleware.js"
    );
}

const router = express.Router();

// Security Activity Timeline
router.get(
    "/events",
    requireAuth,
    getSecurityEvents
);

// Security Dashboard
router.get(
    "/dashboard",
    requireAuth,
    getDashboard
);

// Security Alerts
router.get(
    "/alerts",
    requireAuth,
    getAlerts
);

module.exports = router;