
const {
    createFileShare,
    revokeFileShare,
    getUserFileShares,
    getShareActivity
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

const {
    sendShareInvitationEmail
} = require("../services/emailService");


/*
|--------------------------------------------------------------------------
| BUILD SHARE URL
|--------------------------------------------------------------------------
*/

function buildShareUrl(shareToken) {
    const frontendUrl = String(
        process.env.FRONTEND_URL || ""
    ).trim();

    if (!frontendUrl) {
        throw new Error("FRONTEND_URL_NOT_CONFIGURED");
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(frontendUrl);
    } catch {
        throw new Error("INVALID_FRONTEND_URL");
    }

    if (
        !["http:", "https:"].includes(parsedUrl.protocol) ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.search ||
        parsedUrl.hash
    ) {
        throw new Error("INVALID_FRONTEND_URL");
    }

    const baseUrl = frontendUrl.replace(/\/+$/, "");

    return `${baseUrl}/share/${encodeURIComponent(shareToken)}`;
}


/*
|--------------------------------------------------------------------------
| CREATE AND SEND FILE SHARE INVITATION
|--------------------------------------------------------------------------
| POST /api/shares
|--------------------------------------------------------------------------
*/

async function createShare(req, res, next) {
    try {
        const userId = req.user.userId;

        const fileId = Number(req.body.fileId);

        const recipientEmail =
            req.body.recipientEmail === undefined ||
            req.body.recipientEmail === null
                ? ""
                : String(req.body.recipientEmail)
                    .trim()
                    .toLowerCase();

        const rawExpiresAt = req.body.expiresAt;

        const expiresAt =
            rawExpiresAt === undefined ||
            rawExpiresAt === null ||
            rawExpiresAt === ""
                ? null
                : rawExpiresAt;

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

        const maxOpens =
            req.body.maxOpens === undefined ||
            req.body.maxOpens === null ||
            req.body.maxOpens === ""
                ? null
                : Number(req.body.maxOpens);

        const permissionType =
            req.body.permissionType === undefined
                ? ""
                : String(req.body.permissionType)
                    .trim()
                    .toUpperCase();

        const watermarkEnabled =
            req.body.watermarkEnabled === undefined
                ? false
                : req.body.watermarkEnabled;


        // ---------------------------------------------------------------
        // FILE ID VALIDATION
        // ---------------------------------------------------------------

        if (
            !Number.isSafeInteger(fileId) ||
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

        if (
            recipientEmail.length === 0 ||
            recipientEmail.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                recipientEmail
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "A valid recipientEmail is required to send the invitation."
            });
        }


        // ---------------------------------------------------------------
        // PERMISSION VALIDATION
        // ---------------------------------------------------------------

        if (
            !["VIEW", "DOWNLOAD"].includes(permissionType)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "permissionType must be VIEW or DOWNLOAD."
            });
        }


        // ---------------------------------------------------------------
        // WATERMARK VALIDATION
        // ---------------------------------------------------------------

        if (typeof watermarkEnabled !== "boolean") {
            return res.status(400).json({
                success: false,
                message:
                    "watermarkEnabled must be true or false."
            });
        }


        // ---------------------------------------------------------------
        // EXPIRATION VALIDATION
        // ---------------------------------------------------------------

        if (
            expiresAt !== null &&
            expiresInMinutes !== null
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Provide either expiresAt or expiresInMinutes, not both."
            });
        }

        if (expiresAt !== null) {
            const expiryTimestamp =
                new Date(expiresAt).getTime();

            if (
                !Number.isFinite(expiryTimestamp) ||
                expiryTimestamp <= Date.now()
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "expiresAt must be a valid future date and time."
                });
            }
        }

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
        // OPEN LIMIT VALIDATION
        // ---------------------------------------------------------------

        if (maxOpens !== null) {
            if (
                !Number.isInteger(maxOpens) ||
                maxOpens < 1 ||
                maxOpens > 10000
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "maxOpens must be between 1 and 10000."
                });
            }
        }


        // ---------------------------------------------------------------
        // VALIDATE FRONTEND URL BEFORE CREATING SHARE
        // ---------------------------------------------------------------

        try {
            buildShareUrl("validation-token");
        } catch (error) {
            if (
                error.message === "FRONTEND_URL_NOT_CONFIGURED" ||
                error.message === "INVALID_FRONTEND_URL"
            ) {
                return res.status(500).json({
                    success: false,
                    message:
                        "Share invitation URL is not configured correctly."
                });
            }

            throw error;
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
        // CREATE SHARE
        // ---------------------------------------------------------------

        const share = await createFileShare({
            fileId,
            ownerUserId: userId,
            recipientEmail,
            expiresAt,
            expiresInMinutes,
            maxDownloads,
            maxOpens,
            permissionType,
            watermarkEnabled
        });


        // ---------------------------------------------------------------
        // SEND EMAIL INVITATION
        // ---------------------------------------------------------------

        const shareUrl = buildShareUrl(
            share.shareToken
        );

        try {
            await sendShareInvitationEmail({
                email: recipientEmail,
                fileName: file.original_name,
                permissionType: share.permissionType,
                expiresAt: share.expiresAt
                    ? new Date(
                        share.expiresAt
                    ).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short"
                    })
                    : "No expiry",
                shareUrl
            });

        } catch (emailError) {

            console.error(
                "Share invitation email failed:",
                emailError.message
            );

            // Revoke the share if invitation email fails.
            let revoked = false;

            try {
                revoked = await revokeFileShare(
                    userId,
                    share.shareId
                );
            } catch (revokeError) {
                console.error(
                    "Failed to revoke share after email failure:",
                    revokeError.message
                );
            }

            return res.status(502).json({
                success: false,
                message: revoked
                    ? "Invitation email could not be sent. The share has been revoked."
                    : "Invitation email could not be sent. Please check the share status before trying again.",
                data: {
                    shareId: share.shareId,
                    revoked
                }
            });
        }


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
                    maxDownloads: share.maxDownloads,
                    maxOpens: share.maxOpens,
                    permissionType: share.permissionType,
                    watermarkEnabled: share.watermarkEnabled,
                    invitationSent: true,
                    method: "EMAIL_INVITATION"
                }
            });

        } catch (auditError) {
            console.error(
                "FILE_SHARED audit failed:",
                auditError.message
            );
        }


        // ---------------------------------------------------------------
        // SUCCESS RESPONSE
        // ---------------------------------------------------------------

        return res.status(201).json({
            success: true,
            message:
                "Secure share invitation sent successfully.",
            data: {
                shareId: share.shareId,
                fileId,
                fileName: file.original_name,
                recipientEmail,

                expiresAt: share.expiresAt,

                permissionType: share.permissionType,
                watermarkEnabled: share.watermarkEnabled,

                maxDownloads: share.maxDownloads,
                downloadCount: share.downloadCount,

                maxOpens: share.maxOpens,
                openCount: share.openCount,
                remainingOpens: share.remainingOpens,

                invitationSent: true,
                revoked: false
            }
        });

    } catch (error) {

        if (error.message === "VAULT_LOCKED") {
            return res.status(423).json({
                success: false,
                message: "Vault is locked."
            });
        }

        const validationErrors = new Set([
            "INVALID_FILE_ID",
            "INVALID_OWNER_USER_ID",
            "INVALID_PERMISSION_TYPE",
            "INVALID_WATERMARK_SETTING",
            "INVALID_RECIPIENT_EMAIL",
            "INVALID_EXPIRES_IN_MINUTES",
            "INVALID_EXPIRES_AT",
            "INVALID_MAX_DOWNLOADS",
            "INVALID_MAX_OPENS",
            "USE_EITHER_EXPIRES_AT_OR_EXPIRES_IN_MINUTES"
        ]);

        if (validationErrors.has(error.message)) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        next(error);
    }
}


/*
|--------------------------------------------------------------------------
| REVOKE FILE SHARE
|--------------------------------------------------------------------------
| DELETE /api/shares/:shareId
|--------------------------------------------------------------------------
*/

async function revokeShare(req, res, next) {
    try {
        const userId = req.user.userId;
        const shareId = Number(req.params.shareId);

        if (
            !Number.isSafeInteger(shareId) ||
            shareId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "shareId must be a positive integer."
            });
        }

        const revoked = await revokeFileShare(
            userId,
            shareId
        );

        if (!revoked) {
            return res.status(404).json({
                success: false,
                message:
                    "Share not found or already revoked."
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


/*
|--------------------------------------------------------------------------
| LIST USER FILE SHARES
|--------------------------------------------------------------------------
| GET /api/shares
|--------------------------------------------------------------------------
*/

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

        const result = await getUserFileShares(
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

        if (
            error.message === "INVALID_PAGE" ||
            error.message === "INVALID_LIMIT" ||
            error.message === "INVALID_SHARE_STATUS"
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        next(error);
    }
}


/*
|--------------------------------------------------------------------------
| GET SHARE ACTIVITY
|--------------------------------------------------------------------------
| GET /api/shares/:shareId/activity
|--------------------------------------------------------------------------
*/

async function getShareActivityController(req, res, next) {
    try {
        const userId = req.user.userId;
        const shareId = Number(req.params.shareId);

        const page =
            req.query.page === undefined
                ? 1
                : Number(req.query.page);

        const limit =
            req.query.limit === undefined
                ? 20
                : Number(req.query.limit);

        const eventType =
            req.query.eventType === undefined ||
            req.query.eventType === ""
                ? null
                : String(req.query.eventType)
                    .trim()
                    .toUpperCase();

        if (
            !Number.isSafeInteger(shareId) ||
            shareId < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "shareId must be a positive integer."
            });
        }

        if (!Number.isInteger(page) || page < 1) {
            return res.status(400).json({
                success: false,
                message: "Page must be a positive integer."
            });
        }

        if (
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > 100
        ) {
            return res.status(400).json({
                success: false,
                message: "Limit must be between 1 and 100."
            });
        }

        if (
            eventType !== null &&
            !["OPENED", "VIEWED", "DOWNLOADED"].includes(eventType)
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid eventType. Allowed values are OPENED, VIEWED, DOWNLOADED."
            });
        }

        const result = await getShareActivity(
            userId,
            shareId,
            {
                page,
                limit,
                eventType
            }
        );

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {

        if (error.message === "SHARE_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Share not found."
            });
        }

        if (
            error.message === "INVALID_SHARE_ID" ||
            error.message === "INVALID_PAGE" ||
            error.message === "INVALID_LIMIT" ||
            error.message === "INVALID_ACTIVITY_TYPE"
        ) {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        next(error);
    }
}


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
    createShare,
    revokeShare,
    listShares,
    getShareActivity: getShareActivityController
};
