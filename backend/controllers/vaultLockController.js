const {
    getVaultLockStatus,
    lockVault,
    unlockVault
} = require("../services/vaultLockService");

const {
    verifyUserPassword
} = require("../services/authService");


// =====================================================
// GET VAULT LOCK STATUS
// =====================================================

async function getLockStatus(
    req,
    res,
    next
) {

    try {

        const status =
            await getVaultLockStatus(
                req.user.userId
            );


        return res.status(200).json({

            success: true,

            data: status

        });

    } catch (error) {

        next(error);

    }
}


// =====================================================
// LOCK VAULT
// =====================================================

async function lockVaultController(
    req,
    res,
    next
) {

    try {

        const status =
            await lockVault(
                req.user.userId
            );


        return res.status(200).json({

            success: true,

            message:
                "Vault locked successfully.",

            data: status

        });

    } catch (error) {

        next(error);

    }
}


// =====================================================
// UNLOCK VAULT
// =====================================================

async function unlockVaultController(
    req,
    res,
    next
) {

    try {

        // -------------------------------------------------
        // Read password from request body
        // -------------------------------------------------

        const {
            password
        } = req.body || {};


        // -------------------------------------------------
        // Password required
        // -------------------------------------------------

        if (
            typeof password !== "string" ||
            password.length === 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Password is required."

            });
        }


        // -------------------------------------------------
        // Verify authenticated user's password
        // -------------------------------------------------

        await verifyUserPassword(
            req.user.userId,
            password
        );


        // -------------------------------------------------
        // Unlock vault only after password verification
        // -------------------------------------------------

        const status =
            await unlockVault(
                req.user.userId
            );


        return res.status(200).json({

            success: true,

            message:
                "Vault unlocked successfully.",

            data: status

        });

    } catch (error) {

        // -------------------------------------------------
        // Invalid password
        // -------------------------------------------------

        if (
            error.message ===
            "INVALID_PASSWORD"
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid password."

            });
        }


        // -------------------------------------------------
        // User not found
        // -------------------------------------------------

        if (
            error.message ===
            "USER_NOT_FOUND"
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });
        }


        next(error);

    }
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    getLockStatus,

    lockVaultController,

    unlockVaultController

};