const {
    validateShareAccess,
    getShareByToken
} = require("../services/fileShareService");

const {
    getUserFile,
    readDecryptedFile
} = require("../services/vaultService");

const {
    logSecurityEvent
} = require("../services/securityEventService");


/*
|--------------------------------------------------------------------------
| LOG PUBLIC SHARE VALIDATION FAILURE
|--------------------------------------------------------------------------
|
| Used for:
|
| - SHARE_EXPIRED
| - SHARE_DOWNLOAD_LIMIT_REACHED
|
| Important:
| The validateShareAccess() service throws these errors before returning
| the share object. Therefore we look up the share again using the
| SHA-256-hashed token through getShareByToken().
|
| Audit failures must NEVER break the public share response.
|
|--------------------------------------------------------------------------
*/

async function logShareValidationFailure({
    shareToken,
    error,
    req,
    method
}) {
    let eventType = null;

    if (error.message === "SHARE_EXPIRED") {
        eventType = "SHARE_EXPIRED";
    }

    if (
        error.message ===
        "SHARE_DOWNLOAD_LIMIT_REACHED"
    ) {
        eventType =
            "SHARE_DOWNLOAD_LIMIT_REACHED";
    }

    if (!eventType) {
        return;
    }

    try {
        const share =
            await getShareByToken(
                shareToken
            );

        if (!share) {
            return;
        }

        await logSecurityEvent({
            userId: share.owner_user_id,
            eventType,
            req,
            metadata: {
                shareId: share.share_id,
                fileId: share.file_id,
                method,
                downloadCount:
                    Number(
                        share.download_count
                    ),
                maxDownloads:
                    share.max_downloads === null
                        ? null
                        : Number(
                            share.max_downloads
                        ),
                expiresAt:
                    share.expires_at
            }
        });

    } catch (auditError) {
        console.error(
            `${eventType} audit failed:`,
            auditError.message
        );
    }
}


/*
|--------------------------------------------------------------------------
| GET SHARED FILE INFORMATION
|--------------------------------------------------------------------------
| GET /api/shares/access/:shareToken
|
| This endpoint does NOT require authentication.
|
| It validates the share token and returns safe file/share metadata.
|
|--------------------------------------------------------------------------
*/

async function getSharedFileInfo(
    req,
    res,
    next
) {
    const shareToken =
        String(
            req.params.shareToken || ""
        ).trim();

    try {


        /*
        |--------------------------------------------------------------------------
        | TOKEN FORMAT VALIDATION
        |--------------------------------------------------------------------------
        */

        if (
            !shareToken ||
            !/^[a-fA-F0-9]{64}$/.test(
                shareToken
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid share token."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | VALIDATE SHARE
        |--------------------------------------------------------------------------
        */

        const share =
            await validateShareAccess(
                shareToken
            );


        /*
        |--------------------------------------------------------------------------
        | GET FILE
        |--------------------------------------------------------------------------
        */

        const file =
            await getUserFile(
                share.owner_user_id,
                share.file_id
            );


        if (!file) {
            return res.status(404).json({
                success: false,
                message:
                    "Shared file not found."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | SUCCESS
        |--------------------------------------------------------------------------
        */

        return res.status(200).json({
            success: true,
            data: {
                shareId:
                    share.share_id,

                fileId:
                    file.file_id,

                fileName:
                    file.original_name,

                mimeType:
                    file.mime_type,

                fileSize:
                    file.file_size,

                expiresAt:
                    share.expires_at,

                maxDownloads:
                    share.max_downloads,

                downloadCount:
                    share.download_count,

                remainingDownloads:
                    share.max_downloads === null
                        ? null
                        : Math.max(
                            0,
                            Number(
                                share.max_downloads
                            ) -
                            Number(
                                share.download_count
                            )
                        )
            }
        });

    } catch (error) {

        /*
        |--------------------------------------------------------------------------
        | EXPIRED SHARE AUDIT
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "SHARE_EXPIRED"
        ) {

            await logShareValidationFailure({
                shareToken,
                error,
                req,
                method:
                    "PUBLIC_SHARE_ACCESS"
            });

            return res.status(410).json({
                success: false,
                message:
                    "This share has expired."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | DOWNLOAD LIMIT AUDIT
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "SHARE_DOWNLOAD_LIMIT_REACHED"
        ) {

            await logShareValidationFailure({
                shareToken,
                error,
                req,
                method:
                    "PUBLIC_SHARE_ACCESS"
            });

            return res.status(410).json({
                success: false,
                message:
                    "This share has reached its download limit."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | REVOKED SHARE
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "SHARE_REVOKED"
        ) {
            return res.status(410).json({
                success: false,
                message:
                    "This share has been revoked."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | SHARE NOT FOUND
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "SHARE_NOT_FOUND"
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Share not found."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | UNKNOWN ERROR
        |--------------------------------------------------------------------------
        */

        next(error);
    }
}


/*
|--------------------------------------------------------------------------
| DOWNLOAD SHARED FILE
|--------------------------------------------------------------------------
| GET /api/shares/access/:shareToken/download
|
| No SecureVault login is required.
|
|--------------------------------------------------------------------------
*/

async function downloadSharedFile(
    req,
    res,
    next
) {
    const shareToken =
        String(
            req.params.shareToken || ""
        ).trim();
    try {

        
        /*
        |--------------------------------------------------------------------------
        | TOKEN FORMAT VALIDATION
        |--------------------------------------------------------------------------
        */

        if (
            !shareToken ||
            !/^[a-fA-F0-9]{64}$/.test(
                shareToken
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid share token."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | VALIDATE SHARE
        |--------------------------------------------------------------------------
        */

        const share =
            await validateShareAccess(
                shareToken
            );


        /*
        |--------------------------------------------------------------------------
        | GET FILE
        |--------------------------------------------------------------------------
        */

        const file =
            await getUserFile(
                share.owner_user_id,
                share.file_id
            );


        if (!file) {
            return res.status(404).json({
                success: false,
                message:
                    "Shared file not found."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | DECRYPT + INTEGRITY VERIFICATION
        |--------------------------------------------------------------------------
        */

        const result =
            await readDecryptedFile(
                share.owner_user_id,
                share.file_id
            );


        /*
        |--------------------------------------------------------------------------
        | INCREMENT DOWNLOAD COUNT
        |--------------------------------------------------------------------------
        |
        | Download count is incremented ONLY after:
        |
        | 1. Share validation
        | 2. File ownership lookup
        | 3. File decryption
        | 4. File integrity verification
        |
        |--------------------------------------------------------------------------
        */

        const {
            pool
        } = require("../config/database");


        const [updateResult] =
            await pool.execute(
                `
                UPDATE file_shares
                SET
                    download_count =
                        download_count + 1,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE share_id = ?
                AND revoked = 0
                AND (
                    max_downloads IS NULL
                    OR download_count < max_downloads
                )
                `,
                [
                    share.share_id
                ]
            );


        /*
        |--------------------------------------------------------------------------
        | RACE-CONDITION / SHARE NO LONGER AVAILABLE
        |--------------------------------------------------------------------------
        */

        if (
            updateResult.affectedRows !== 1
        ) {

            return res.status(410).json({
                success: false,
                message:
                    "This share is no longer available."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | SUCCESSFUL SHARE ACCESS AUDIT
        |--------------------------------------------------------------------------
        */

        try {

            await logSecurityEvent({
                userId:
                    share.owner_user_id,

                eventType:
                    "SHARE_ACCESSED",

                req,

                metadata: {
                    shareId:
                        share.share_id,

                    fileId:
                        share.file_id,

                    method:
                        "PUBLIC_SHARE_DOWNLOAD"
                }
            });

        } catch (auditError) {

            /*
            | Audit logging must not break
            | a successful file download.
            */

            console.error(
                "SHARE_ACCESSED audit failed:",
                auditError.message
            );
        }


        /*
        |--------------------------------------------------------------------------
        | RESPONSE HEADERS
        |--------------------------------------------------------------------------
        */

        res.setHeader(
            "Content-Type",
            file.mime_type ||
            "application/octet-stream"
        );


        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(
                file.original_name
            )}"`
        );

        res.setHeader(
            "Cache-Control",
          "no-store, no-cache, must-revalidate, proxy-revalidate"
        );

        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        res.setHeader(
            "Content-Length",
            result.data.length
        );


        /*
        |--------------------------------------------------------------------------
        | SEND FILE
        |--------------------------------------------------------------------------
        */

        return res.status(200).send(
            result.data
        );

    } catch (error) {

        /*
        |--------------------------------------------------------------------------
        | EXPIRED SHARE AUDIT
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "SHARE_EXPIRED"
        ) {

            await logShareValidationFailure({
                shareToken,
                error,
                req,
                method:
                    "PUBLIC_SHARE_DOWNLOAD"
            });

            return res.status(410).json({
                success: false,
                message:
                    "This share has expired."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | DOWNLOAD LIMIT AUDIT
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "SHARE_DOWNLOAD_LIMIT_REACHED"
        ) {

            await logShareValidationFailure({
                shareToken,
                error,
                req,
                method:
                    "PUBLIC_SHARE_DOWNLOAD"
            });

            return res.status(410).json({
                success: false,
                message:
                    "This share has reached its download limit."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | REVOKED SHARE
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "SHARE_REVOKED"
        ) {

            return res.status(410).json({
                success: false,
                message:
                    "This share has been revoked."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | SHARE NOT FOUND
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "SHARE_NOT_FOUND"
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Share not found."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | FILE NOT FOUND
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "FILE_NOT_FOUND"
        ) {

            return res.status(404).json({
                success: false,
                message:
                    "Shared file not found."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | FILE INTEGRITY FAILURE
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "FILE_INTEGRITY_CHECK_FAILED"
        ) {

            return res.status(409).json({
                success: false,
                message:
                    "File integrity verification failed."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | AES-GCM AUTHENTICATION FAILURE
        |--------------------------------------------------------------------------
        */

        if (
            error.message ===
            "Unsupported state or unable to authenticate data"
        ) {

            return res.status(409).json({
                success: false,
                message:
                    "File integrity verification failed."
            });
        }


        /*
        |--------------------------------------------------------------------------
        | UNKNOWN ERROR
        |--------------------------------------------------------------------------
        */

        next(error);
    }
}


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
    getSharedFileInfo,
    downloadSharedFile
};