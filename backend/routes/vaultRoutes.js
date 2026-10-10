const express = require("express");

const router = express.Router();


// =====================================================
// MIDDLEWARE
// =====================================================

const authMiddleware =
    require("../middleware/authMiddleware");

const vaultLockMiddleware =
    require("../middleware/vaultLockMiddleware");

const upload =
    require("../middleware/uploadMiddleware");




// =====================================================
// CONTROLLER
// =====================================================




const {
    uploadFiles,
    listFiles,
    downloadFile,
    deleteFile,
    getLockStatus,
    unlock,
    lock
} = require("../controllers/vaultController");


// =====================================================
// VAULT LOCK STATUS
// =====================================================

router.get(
    "/status",
    authMiddleware,
    getLockStatus
);


// =====================================================
// UNLOCK VAULT
// =====================================================

router.post(
    "/unlock",
    authMiddleware,
    unlock
);


// =====================================================
// LOCK VAULT
// =====================================================

router.post(
    "/lock",
    authMiddleware,
    lock
);


// =====================================================
// MULTIPLE FILE UPLOAD
// =====================================================

router.post(
    "/upload",
    authMiddleware,
    vaultLockMiddleware,
    upload.array("files", 10),
    uploadFiles
);


// =====================================================
// LIST FILES
// =====================================================

router.get(
    "/files",
    authMiddleware,
    vaultLockMiddleware,
    listFiles
);


// =====================================================
// DOWNLOAD
// =====================================================

router.get(
    "/files/:fileId/download",
    authMiddleware,
    vaultLockMiddleware,
    downloadFile
);


// =====================================================
// DELETE
// =====================================================

router.delete(
    "/files/:fileId",
    authMiddleware,
    vaultLockMiddleware,
    deleteFile
);


module.exports = router;