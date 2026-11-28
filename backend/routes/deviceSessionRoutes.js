
const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");

const {
    getSessions,
    revokeDeviceSession,
    revokeOtherSessions
} = require("../controllers/deviceSessionController");

const router = express.Router();

router.use(authMiddleware);

router.get("/", getSessions);

router.delete("/:sessionId", revokeDeviceSession);

router.post("/revoke-others", revokeOtherSessions);

module.exports = router;
