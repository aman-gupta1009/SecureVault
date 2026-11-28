
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const vaultLockMiddleware = require("../middleware/vaultLockMiddleware");

const {
    upload,
    validateUploadBatch
} = require("../middleware/uploadMiddleware");

const {
    uploadFiles,
    listFiles,

    viewFile,
    deleteFile,
    restoreFile,
    getLockStatus,
    getFileCount,
    unlock,
    lock
} = require("../controllers/vaultController");

// VAULT LOCK STATUS
router.get(
    "/status",
    authMiddleware,
    getLockStatus
);

// UNLOCK VAULT
router.post(
    "/unlock",
    authMiddleware,
    unlock
);

// LOCK VAULT
router.post(
    "/lock",
    authMiddleware,
    lock
);

// UPLOAD FILES: login required, vault unlock NOT required
router.post(
    "/upload",
    authMiddleware,
    upload.array("files", 10),
    validateUploadBatch,
    uploadFiles
);

// LIST FILES: vault unlock required
router.get(
    "/files",
    authMiddleware,
    vaultLockMiddleware,
    listFiles
);



router.post(
    "/files/:fileId/restore",
    authMiddleware,
    vaultLockMiddleware,
    restoreFile
);

// FILE COUNT: login required, vault unlock NOT required
router.get(
    "/files/count",
    authMiddleware,
    getFileCount
);

// VIEW FILE: login and unlocked vault required
router.get(
    "/files/:fileId/view",
    authMiddleware,
    vaultLockMiddleware,
    viewFile
);
// DELETE FILE: vault unlock required
router.delete(
    "/files/:fileId",
    authMiddleware,
    vaultLockMiddleware,
    deleteFile
);

module.exports = router;
