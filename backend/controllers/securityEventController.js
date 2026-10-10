const {
    getUserSecurityEvents
} = require("../services/securityTimelineService");

async function getSecurityEvents(req, res, next) {
    try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);

        const eventType = req.query.eventType
            ? String(req.query.eventType).trim()
            : null;

        if (!Number.isInteger(page) || page < 1) {
            return res.status(400).json({
                success: false,
                message: "Page must be a positive integer."
            });
        }

        if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
            return res.status(400).json({
                success: false,
                message: "Limit must be between 1 and 100."
            });
        }

        const result = await getUserSecurityEvents(
            req.user.userId,
            {
                page,
                limit,
                eventType
            }
        );

        return res.status(200).json({
            success: true,
            message: "Security activity retrieved successfully.",
            data: result
        });

    } catch (error) {
        next(error);
    }
}

module.exports = {
    getSecurityEvents
};