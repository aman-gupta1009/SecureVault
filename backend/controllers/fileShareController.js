const {
    createFileShare,
    revokeFileShare,
    getUserFileShares
} = require("../services/fileShareService");

const {
    getUserFile
} = require("../services/vaultService");

const {
    requireUnlockedVault
} = require("../services/vaultLockService");

const {
    logSecurityEvent
} = require("../services/securityEventService");


/*
|--------------------------------------------------------------------------
| CREATE FILE SHARE
|--------------------------------------------------------------------------
| POST /api/shares
|
| Body:
| {
|   "fileId": 5,
|   "recipientEmail": "user@example.com",
|   "expiresInMinutes": 60,
|   "maxDownloads": 5
| }
|
|--------------------------------------------------------------------------
*/

async function createShare(req, res, next) {
    try {
        const userId = req.user.userId;

        const fileId = Number(req.body.fileId);

        const recipientEmail =
            req.body.recipientEmail === undefined ||
            req.body.recipientEmail === null ||
            req.body.recipientEmail === ""
                ? null
                : String(req.body.recipientEmail).trim();

        const expiresInMinutes =
            req.body.expiresInMinutes === undefined ||
            req.body.expiresInMinutes === null ||
            req.body.expiresInMinutes === ""
                ? null
                : Number(req.body.expiresInMinutes);

        const maxDownloads =
            req.body.maxDownloads === undefined ||
            req.body.maxDownloads === null ||
            req.body.maxDownloads === ""
                ? null
                : Number(req.body.maxDownloads);


        // ---------------------------------------------------------------
        // FILE ID VALIDATION
        // ---------------------------------------------------------------

        if (
            !Number.isInteger(fileId) ||
            fileId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "fileId must be a positive integer."
            });
        }


        // ---------------------------------------------------------------
        // RECIPIENT EMAIL VALIDATION
        // ---------------------------------------------------------------

        if (recipientEmail !== null) {
            if (
                recipientEmail.length === 0 ||
                recipientEmail.length > 255 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    recipientEmail
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid recipientEmail."
                });
            }
        }


        // ---------------------------------------------------------------
        // EXPIRATION VALIDATION
        // ---------------------------------------------------------------

        if (expiresInMinutes !== null) {
            if (
                !Number.isInteger(expiresInMinutes) ||
                expiresInMinutes < 1 ||
                expiresInMinutes > 10080
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "expiresInMinutes must be between 1 and 10080."
                });
            }
        }


        // ---------------------------------------------------------------
        // DOWNLOAD LIMIT VALIDATION
        // ---------------------------------------------------------------

        if (maxDownloads !== null) {
            if (
                !Number.isInteger(maxDownloads) ||
                maxDownloads < 1 ||
                maxDownloads > 10000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "maxDownloads must be between 1 and 10000."
                });
            }
        }


        // ---------------------------------------------------------------
        // VAULT MUST BE UNLOCKED
        // ---------------------------------------------------------------

        await requireUnlockedVault(
            userId,
            req
        );


        // ---------------------------------------------------------------
        // VERIFY FILE OWNERSHIP
        // ---------------------------------------------------------------

        const file = await getUserFile(
            userId,
            fileId
        );

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "File not found."
            });
        }


        // ---------------------------------------------------------------
        // CALCULATE EXPIRATION
        // ---------------------------------------------------------------

        


        // ---------------------------------------------------------------
        // CREATE SHARE
        // ---------------------------------------------------------------

        const share =
    await createFileShare({
        fileId,
        ownerUserId: userId,
        recipientEmail,
        expiresInMinutes,
        maxDownloads
    });


        // ---------------------------------------------------------------
        // SECURITY AUDIT
        // ---------------------------------------------------------------

        try {
            await logSecurityEvent({
                userId,
                eventType: "FILE_SHARED",
                req,
                metadata: {
                    shareId: share.shareId,
                    fileId,
                    recipientEmail,
                    expiresAt: share.expiresAt,
                    maxDownloads,
                    method: "USER_SHARE"
                }
            });
        } catch (auditError) {
            console.error(
                "FILE_SHARED audit failed:",
                auditError.message
            );
        }


        // ---------------------------------------------------------------
        // RESPONSE
        // ---------------------------------------------------------------

        return res.status(201).json({
            success: true,
            message: "File share created successfully.",
            data: {
                shareId: share.shareId,
                fileId,
                fileName: file.original_name,
                shareToken: share.shareToken,
                recipientEmail,
                expiresAt: share.expiresAt,
                maxDownloads,
                downloadCount: 0,
                revoked: false
            }
        });

    } catch (error) {

        if (
            error.message ===
            "VAULT_LOCKED"
        ) {
            return res.status(423).json({
                success: false,
                message: "Vault is locked."
            });
        }

        next(error);
    }
}


async function revokeShare(req, res, next) {
    try {
        const userId = req.user.userId;
        const shareId = Number(req.params.shareId);

        if (
            !Number.isInteger(shareId) ||
            shareId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "shareId must be a positive integer."
            });
        }

        const revoked =
            await revokeFileShare(
                userId,
                shareId
            );

        if (!revoked) {
            return res.status(404).json({
                success: false,
                message: "Share not found or already revoked."
            });
        }

        try {
            await logSecurityEvent({
                userId,
                eventType: "SHARE_REVOKED",
                req,
                metadata: {
                    shareId,
                    method: "USER_SHARE_REVOKE"
                }
            });
        } catch (auditError) {
            console.error(
                "SHARE_REVOKED audit failed:",
                auditError.message
            );
        }

        return res.status(200).json({
            success: true,
            message: "File share revoked successfully.",
            data: {
                shareId,
                revoked: true
            }
        });

    } catch (error) {
        next(error);
    }
}

async function listShares(req, res, next) {
    try {
        const page =
            req.query.page === undefined
                ? 1
                : Number(req.query.page);

        const limit =
            req.query.limit === undefined
                ? 20
                : Number(req.query.limit);

        const status =
            req.query.status === undefined
                ? "ALL"
                : String(req.query.status)
                    .trim()
                    .toUpperCase();

        if (
            !Number.isInteger(page) ||
            page < 1
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Page must be a positive integer."
            });
        }

        if (
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 100
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Limit must be between 1 and 100."
            });
        }

        const allowedStatuses = new Set([
            "ALL",
            "ACTIVE",
            "EXPIRED",
            "REVOKED",
            "LIMIT_REACHED"
        ]);

        if (!allowedStatuses.has(status)) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid status. Allowed values are ALL, ACTIVE, EXPIRED, REVOKED, LIMIT_REACHED."
            });
        }

        const result =
            await getUserFileShares(
                req.user.userId,
                {
                    page,
                    limit,
                    status
                }
            );

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {

        if (error.message === "INVALID_PAGE") {
            return res.status(400).json({
                success: false,
                message:
                    "Page must be a positive integer."
            });
        }

        if (error.message === "INVALID_LIMIT") {
            return res.status(400).json({
                success: false,
                message:
                    "Limit must be between 1 and 100."
            });
        }

        if (
            error.message ===
            "INVALID_SHARE_STATUS"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid share status."
            });
        }

        next(error);
    }
}


module.exports = {
    createShare,
    revokeShare,
    listShares
};