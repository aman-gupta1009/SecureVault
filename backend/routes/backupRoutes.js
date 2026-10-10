
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const {
    createBackupController,
    listBackupsController,
    verifyBackupController,
    restoreBackupController,
    deleteBackupController
} = require("../controllers/backupController");

router.use(authMiddleware);

router.get("/", listBackupsController);
router.post("/", createBackupController);

router.get("/:backupId/verify", verifyBackupController);
router.post("/:backupId/restore", restoreBackupController);

router.delete("/:backupId", deleteBackupController);

module.exports = router;