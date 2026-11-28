
const express = require("express");

const router = express.Router();

const authMiddleware =
    require("../middleware/authMiddleware");

const {
    createShare,
    revokeShare,
    listShares,
    getShareActivity
} = require("../controllers/fileShareController");

// List owner's shares
router.get(
    "/",
    authMiddleware,
    listShares
);

// Create a new share
router.post(
    "/",
    authMiddleware,
    createShare
);

// Get activity for one owned share
router.get(
    "/:shareId/activity",
    authMiddleware,
    getShareActivity
);

// Revoke a share
router.delete(
    "/:shareId",
    authMiddleware,
    revokeShare
);

module.exports = router;
