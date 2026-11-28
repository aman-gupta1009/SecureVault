
const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification
} = require("../controllers/notificationController");

const router = express.Router();

// All notification routes require authentication.
router.use(authMiddleware);

router.get("/unread-count", getUnreadCount);

router.get("/", getNotifications);

router.patch("/read-all", markAllAsRead);

router.patch("/:notificationId/read", markAsRead);

router.delete("/:notificationId", removeNotification);

module.exports = router;
