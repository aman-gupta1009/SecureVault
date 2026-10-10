require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const securityMiddleware = require("./middleware/securityMiddleware");
const errorMiddleware = require("./middleware/errorMiddleware");

const backupRoutes = require("./routes/backupRoutes");
const {
    startSessionCleanupJob
} = require("./services/sessionService");

const {
    startVaultAutoLockJob
} = require("./services/vaultLockService");

const {
    testDatabaseConnection
} = require("./config/database");

const healthRoutes = require("./routes/healthRoutes");

const authRoutes = require("./routes/authRoutes");
const securityRoutes = require("./routes/securityRoutes");
const vaultRoutes = require("./routes/vaultRoutes");
const shareRoutes = require("./routes/shareRoutes");

const sharedFileRoutes =
    require("./routes/sharedFileRoutes");

const vaultLockRoutes =
    require("./routes/vaultLockRoutes");


const app = express();

const PORT = Number(
    process.env.PORT || 4000
);


// =====================================================
// SECURITY
// =====================================================

app.use(securityMiddleware);


// =====================================================
// CORS
// =====================================================

app.use(
    cors({
        origin:
            process.env.FRONTEND_URL ||
            "http://localhost:5173",

        credentials: true
    })
);


// =====================================================
// BODY PARSERS
// =====================================================

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: false,
        limit: "1mb"
    })
);

app.use(cookieParser());


// =====================================================
// GLOBAL RATE LIMITER
// =====================================================

const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: 300,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many requests. Please try again later."
    }
});

app.use(globalRateLimiter);

// =====================================================
// PUBLIC SHARE ACCESS RATE LIMITER
// =====================================================

const shareAccessRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    limit: 30,

    standardHeaders: "draft-8",

    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many share access requests. Please try again later."
    }
});
// =====================================================
// API ROUTES
// =====================================================

app.use(
    "/api/health",
    healthRoutes
);

app.use(
    "/api/auth",
    authRoutes
);

app.use("/api/security", securityRoutes);

app.use(
    "/api/vault",
    vaultRoutes
);

app.use("/api/shares", shareRoutes);

app.use(
    "/api/shares/access",
    shareAccessRateLimiter,
    sharedFileRoutes
);

app.use("/api/backups", backupRoutes);

app.use(
    "/api/vault-lock",
    vaultLockRoutes
);
// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "Route not found"
    });

});


// =====================================================
// ERROR HANDLER
// =====================================================

app.use(errorMiddleware);



// =====================================================
// START SERVER
// =====================================================

async function startServer() {

    try {

        await testDatabaseConnection();

        startVaultAutoLockJob();

        // -------------------------------------------------
        // Start automatic session cleanup
        // -------------------------------------------------

        startSessionCleanupJob();


        // -------------------------------------------------
        // Start HTTP server
        // -------------------------------------------------

        app.listen(PORT, () => {

            console.log("");

            console.log(
                "===================================="
            );

            console.log(
                "       🔐 SECUREVAULT SERVER"
            );

            console.log(
                "===================================="
            );

            console.log(
                `🚀 Server: http://localhost:${PORT}`
            );

            console.log(
                `❤️ Health: http://localhost:${PORT}/api/health`
            );

            console.log(
                "===================================="
            );

            console.log("");

        });

    } catch (error) {

        console.error(
            "❌ Failed to start SecureVault"
        );

        console.error(
            error.message
        );

        process.exit(1);
    }
}


startServer();

