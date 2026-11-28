
const notificationService = require("../services/notificationService");

function getUserId(req) {
    return req.user?.userId;
}

function handleError(res, error) {
    if (error.message === "INVALID_CATEGORY") {
        return res.status(400).json({
            success: false,
            message: "Invalid notification category."
        });
    }

    console.error("Notification Controller Error:", error);

    return res.status(500).json({
        success: false,
        message: "Unable to process notification request."
    });
}

async function getNotifications(req, res) {
    try {
        const result = await notificationService.syncSecurityNotifications(
            getUserId(req)
        );

        const data = await notificationService.listNotifications(
            getUserId(req),
            {
                page: req.query.page,
                limit: req.query.limit,
                category: req.query.category,
                unreadOnly: req.query.unreadOnly
            }
        );

        return res.status(200).json({
            success: true,
            message: "Notifications retrieved successfully.",
            data,
            syncedCount: result.createdCount
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function getUnreadCount(req, res) {
    try {
        await notificationService.syncSecurityNotifications(
            getUserId(req)
        );

        const unreadCount = await notificationService.getUnreadCount(
            getUserId(req)
        );

        return res.status(200).json({
            success: true,
            data: { unreadCount }
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function markAsRead(req, res) {
    try {
        const notificationId = Number(req.params.notificationId);

        if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification ID."
            });
        }

        const updated = await notificationService.markNotificationRead(
            getUserId(req),
            notificationId
        );

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: "Notification not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification marked as read."
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function markAllAsRead(req, res) {
    try {
        const updatedCount =
            await notificationService.markAllNotificationsRead(
                getUserId(req)
            );

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read.",
            data: { updatedCount }
        });
    } catch (error) {
        return handleError(res, error);
    }
}

async function removeNotification(req, res) {
    try {
        const notificationId = Number(req.params.notificationId);

        if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification ID."
            });
        }

        const deleted = await notificationService.deleteNotification(
            getUserId(req),
            notificationId
        );

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Notification not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification deleted successfully."
        });
    } catch (error) {
        return handleError(res, error);
    }
}

module.exports = {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    removeNotification
};
