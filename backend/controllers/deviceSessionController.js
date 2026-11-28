
const sessionService = require("../services/sessionService");

async function getSessions(req, res) {
    try {
        const sessions = await sessionService.getUserSessions(
            req.user.userId,
            req.user.sessionId
        );

        return res.status(200).json({
            success: true,
            data: {
                sessions,
                total: sessions.length
            }
        });
    } catch (error) {
        console.error("Get Device Sessions Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve device sessions."
        });
    }
}

async function revokeDeviceSession(req, res) {
    try {
        const sessionId = Number(req.params.sessionId);

        if (!Number.isSafeInteger(sessionId) || sessionId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid session ID."
            });
        }

        const result = await sessionService.revokeUserSession(
            req.user.userId,
            sessionId,
            req.user.sessionId
        );

        if (result.reason === "CURRENT_SESSION") {
            return res.status(400).json({
                success: false,
                message: "You cannot revoke your current session from this action."
            });
        }

        if (!result.revoked) {
            return res.status(404).json({
                success: false,
                message: "Session not found or already revoked."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Device session revoked successfully."
        });
    } catch (error) {
        console.error("Revoke Device Session Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to revoke device session."
        });
    }
}

async function revokeOtherSessions(req, res) {
    try {
        const revokedCount =
            await sessionService.revokeOtherUserSessions(
                req.user.userId,
                req.user.sessionId
            );

        return res.status(200).json({
            success: true,
            message: "Other device sessions have been revoked.",
            data: { revokedCount }
        });
    } catch (error) {
        console.error("Revoke Other Sessions Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to revoke other sessions."
        });
    }
}

module.exports = {
    getSessions,
    revokeDeviceSession,
    revokeOtherSessions
};
