
const {
    requireUnlockedVault
} = require("../services/vaultLockService");


// =====================================================
// REQUIRE UNLOCKED VAULT
// =====================================================

async function vaultLockMiddleware(
    req,
    res,
    next
) {

    try {

        await requireUnlockedVault(
            req.user.userId , req
        );


        next();

    } catch (error) {

        if (
            error.message ===
            "VAULT_LOCKED"
        ) {

            return res.status(423).json({

                success: false,

                message:
                    "Vault is locked. Please unlock your vault first."

            });
        }


        next(error);
    }
}


// =====================================================
// EXPORT
// =====================================================

module.exports =
    vaultLockMiddleware;

