const { pool } = require("../config/database");

async function healthCheck(req, res) {
    try {
        await pool.query("SELECT 1");

        res.status(200).json({
            success: true,
            application: "SecureVault",
            status: "healthy",
            database: "connected"
        });

    } catch (error) {

        console.error("Health check failed:", error.message);

        res.status(503).json({
            success: false,
            application: "SecureVault",
            status: "unhealthy",
            database: "disconnected"
        });
    }
}

module.exports = {
    healthCheck
};