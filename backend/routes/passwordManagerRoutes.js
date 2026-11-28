
const express = require("express");

const authMiddleware = require("../middleware/authMiddleware");
const vaultLockMiddleware = require("../middleware/vaultLockMiddleware");

const passwordManagerController = require(
    "../controllers/passwordManagerController"
);

const router = express.Router();

// Every Password Manager operation requires:
// 1. A valid login session
// 2. An unlocked SecureVault
router.use(authMiddleware);
router.use(vaultLockMiddleware);

router.get(
    "/",
    passwordManagerController.listCredentials
);

router.post(
    "/",
    passwordManagerController.createCredential
);

router.post(
    "/:credentialId/reveal",
    passwordManagerController.revealCredential
);

router.put(
    "/:credentialId",
    passwordManagerController.updateCredentialPassword
);

router.delete(
    "/:credentialId",
    passwordManagerController.deleteCredential
);

module.exports = router;
