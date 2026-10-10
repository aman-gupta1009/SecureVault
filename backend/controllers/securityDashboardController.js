const {
    getSecurityDashboard
} = require("../services/securityDashboardService");

async function getDashboard(req, res, next) {
    try {
        const dashboard = await getSecurityDashboard(
            req.user.userId
        );

        return res.status(200).json({
            success: true,
            message: "Security dashboard retrieved successfully.",
            data: dashboard
        });

    } catch (error) {
        next(error);
    }
}

module.exports = {
    getDashboard
};