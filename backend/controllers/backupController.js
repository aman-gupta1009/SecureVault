
const {
    createBackup,
    listBackups,
    verifyBackup,
    restoreBackup,
    deleteBackup
} = require("../services/backupService");

function handleBackupError(res, error, operation) {
    console.error(`${operation} ERROR:`, error);

    if (error.code === "BACKUP_NOT_FOUND") {
        return res.status(404).json({
            success: false,
            message: "Backup not found."
        });
    }

    if (
        error.code === "BACKUP_INTEGRITY_FAILED" ||
        error.code === "BACKUP_MANIFEST_INVALID" ||
        error.code === "BACKUP_INVALID_PATH"
    ) {
        return res.status(409).json({
            success: false,
            message: "Backup verification failed. Restore was not completed."
        });
    }

    return res.status(500).json({
        success: false,
        message: `${operation} failed.`
    });
}

function getValidBackupId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function createBackupController(req, res) {
    try {
        const result = await createBackup(req.user.userId);

        return res.status(201).json({
            success: true,
            message: "Backup created successfully.",
            data: result
        });
    } catch (error) {
        return handleBackupError(res, error, "CREATE BACKUP");
    }
}

async function listBackupsController(req, res) {
    try {
        const backups = await listBackups(req.user.userId);

        return res.status(200).json({
            success: true,
            data: backups
        });
    } catch (error) {
        return handleBackupError(res, error, "LIST BACKUPS");
    }
}

async function verifyBackupController(req, res) {
    try {
        const backupId = getValidBackupId(req.params.backupId);

        if (!backupId) {
            return res.status(400).json({
                success: false,
                message: "Invalid backup ID."
            });
        }

        const result = await verifyBackup(req.user.userId, backupId);

        return res.status(200).json({
            success: true,
            message: "Backup integrity verified.",
            data: result
        });
    } catch (error) {
        return handleBackupError(res, error, "VERIFY BACKUP");
    }
}

async function restoreBackupController(req, res) {
    try {
        const backupId = getValidBackupId(req.params.backupId);

        if (!backupId) {
            return res.status(400).json({
                success: false,
                message: "Invalid backup ID."
            });
        }

        const result = await restoreBackup(req.user.userId, backupId);

        return res.status(200).json({
            success: true,
            message: "Backup restored successfully.",
            data: result
        });
    } catch (error) {
        return handleBackupError(res, error, "RESTORE BACKUP");
    }
}

async function deleteBackupController(req, res) {
    try {
        const backupId = getValidBackupId(req.params.backupId);

        if (!backupId) {
            return res.status(400).json({
                success: false,
                message: "Invalid backup ID."
            });
        }

        const result = await deleteBackup(req.user.userId, backupId);

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        return handleBackupError(res, error, "DELETE BACKUP");
    }
}

module.exports = {
    createBackupController,
    listBackupsController,
    verifyBackupController,
    restoreBackupController,
    deleteBackupController
};