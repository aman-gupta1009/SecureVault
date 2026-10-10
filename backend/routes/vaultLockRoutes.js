
const express = require("express");

const router = express.Router();


// =====================================================
// MIDDLEWARE
// =====================================================

const authMiddleware =
    require("../middleware/authMiddleware");


// =====================================================
// CONTROLLERS
// =====================================================

const {
    getLockStatus,
    lockVaultController,
    unlockVaultController
} = require("../controllers/vaultLockController");


// =====================================================
// GET VAULT LOCK STATUS
// =====================================================

router.get(
    "/status",
    authMiddleware,
    getLockStatus
);


// =====================================================
// LOCK VAULT
// =====================================================

router.post(
    "/lock",
    authMiddleware,
    lockVaultController
);


// =====================================================
// UNLOCK VAULT
// =====================================================

router.post(
    "/unlock",
    authMiddleware,
    unlockVaultController
);


module.exports = router;

