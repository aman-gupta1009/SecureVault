const {
    getSecurityAlerts
} = require("../services/securityAlertService");

async function getAlerts(req, res, next) {
    try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);

        const severity = req.query.severity
            ? String(req.query.severity).trim().toUpperCase()
            : null;

        const result = await getSecurityAlerts(
            req.user.userId,
            {
                page,
                limit,
                severity
            }
        );

        return res.status(200).json({
            success: true,
            message: "Security alerts retrieved successfully.",
            data: result
        });

    } catch (error) {
        if (error.message === "INVALID_PAGE") {
            return res.status(400).json({
                success: false,
                message: "Page must be a positive integer."
            });
        }

        if (error.message === "INVALID_LIMIT") {
            return res.status(400).json({
                success: false,
                message: "Limit must be between 1 and 100."
            });
        }

        if (error.message === "INVALID_SEVERITY") {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid severity. Use CRITICAL, HIGH, MEDIUM, or INFO."
            });
        }

        next(error);
    }
}

module.exports = {
    getAlerts
};