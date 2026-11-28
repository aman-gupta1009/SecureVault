
const crypto = require("crypto");

const {
    validateShareAccess,
    getShareByToken
} = require("../services/fileShareService");

const {
    requestShareAccessOTP,
    verifyShareAccessOTP,
    validateShareRecipientSession
} = require("../services/shareRecipientAuthService");

const {
    getUserFile,
    readDecryptedFile
} = require("../services/vaultService");

const {
    applyWatermark
} = require("../services/fileWatermarkService");

const {
    logSecurityEvent
} = require("../services/securityEventService");

const {
    pool
} = require("../config/database");


/*
|--------------------------------------------------------------------------
| CONSTANTS
|--------------------------------------------------------------------------
*/

const SHARE_TOKEN_REGEX = /^[a-fA-F0-9]{64}$/;

const PREVIEW_MIME_TYPES = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/bmp",
    "text/plain"
]);


/*
|--------------------------------------------------------------------------
| COMMON HELPERS
|--------------------------------------------------------------------------
*/

function getShareToken(req) {
    return String(
        req.params.shareToken || ""
    ).trim();
}


function isValidShareToken(token) {
    return SHARE_TOKEN_REGEX.test(token);
}


function getRecipientSessionToken(req) {
    const authorization = String(
        req.headers.authorization || ""
    ).trim();

    const match = authorization.match(
        /^Bearer\s+([a-fA-F0-9]{64})$/i
    );

    return match ? match[1] : null;
}


function normalizeMimeType(mimeType) {
    return String(
        mimeType || "application/octet-stream"
    )
        .split(";")[0]
        .trim()
        .toLowerCase();
}
function isWatermarkEnabled(value) {
    return value === true ||
        value === 1 ||
        value === "1";
}

function getWatermarkContext(recipientSession, req) {
    return {
        recipientEmail: recipientSession.recipient_email,
        serverTimestamp: new Date().toISOString(),
        ipAddress: req.ip || null
    };
}

function getShareWatermarkEnabled(share, recipientSession) {
    return isWatermarkEnabled(
        recipientSession.watermark_enabled ??
        share.watermark_enabled
    );
}


function encodeFileName(fileName) {
    const originalName = String(
        fileName || "shared-file"
    );

    const fallbackName = originalName
        .replace(/[^\x20-\x7E]/g, "_")
        .replace(/["\\]/g, "_")
        .replace(/[\r\n]/g, "_");

    return (
        `filename="${fallbackName}"; ` +
        `filename*=UTF-8''${encodeURIComponent(originalName)}`
    );
}


function sendError(res, status, message) {
    return res.status(status).json({
        success: false,
        message
    });
}


function isShareUnavailableError(error) {
    return [
        "SHARE_EXPIRED",
        "SHARE_REVOKED",
        "SHARE_NOT_FOUND"
    ].includes(error.message);
}


/*
|--------------------------------------------------------------------------
| SECURITY AUDIT
|--------------------------------------------------------------------------
*/

async function logShareEvent({
    userId,
    eventType,
    req,
    metadata = {}
}) {
    try {
        await logSecurityEvent({
            userId,
            eventType,
            req,
            metadata
        });
    } catch (auditError) {
        console.error(
            `${eventType} audit failed:`,
            auditError.message
        );
    }
}


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
        eventType = "SHARE_DOWNLOAD_LIMIT_REACHED";
    }

    if (!eventType) {
        return;
    }

    try {
        const share = await getShareByToken(
            shareToken
        );

        if (!share) {
            return;
        }

        await logShareEvent({
            userId: share.owner_user_id,
            eventType,
            req,
            metadata: {
                shareId: share.share_id,
                fileId: share.file_id,
                method,
                downloadCount: Number(
                    share.download_count
                ),
                maxDownloads:
                    share.max_downloads === null
                        ? null
                        : Number(share.max_downloads),
                expiresAt: share.expires_at
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
| REGISTER RECIPIENT SHARE OPEN
|--------------------------------------------------------------------------
|
| One open is counted per verified recipient session.
| Multiple previews in the same session do not consume
| additional opens.
|
| Transactions and row locks prevent concurrent requests
| from exceeding max_opens.
|
|--------------------------------------------------------------------------
*/

async function registerShareOpen(
    share,
    sessionToken,
    req
) {
    const connection = await pool.getConnection();

    const sessionTokenHash = crypto
        .createHash("sha256")
        .update(sessionToken, "utf8")
        .digest("hex");

    try {
        await connection.beginTransaction();

        // Lock the share row first.
        const [shareRows] = await connection.execute(
            `
            SELECT
                share_id,
                owner_user_id,
                file_id,
                max_opens,
                open_count,
                revoked,
                expires_at
            FROM file_shares
            WHERE share_id = ?
            FOR UPDATE
            `,
            [share.share_id]
        );

        if (shareRows.length === 0) {
            throw new Error("SHARE_NOT_FOUND");
        }

        const currentShare = shareRows[0];

        if (Number(currentShare.revoked) === 1) {
            throw new Error("SHARE_REVOKED");
        }

        if (
            currentShare.expires_at &&
            new Date(currentShare.expires_at).getTime() <= Date.now()
        ) {
            throw new Error("SHARE_EXPIRED");
        }

        // Lock the verified recipient session.
        const [sessionRows] = await connection.execute(
            `
            SELECT
                session_id,
                share_id,
                recipient_email,
                opened_at,
                revoked,
                expires_at
            FROM share_access_sessions
            WHERE share_id = ?
              AND session_token_hash = ?
            LIMIT 1
            FOR UPDATE
            `,
            [
                share.share_id,
                sessionTokenHash
            ]
        );

        if (sessionRows.length === 0) {
            throw new Error("SHARE_SESSION_INVALID");
        }

        const session = sessionRows[0];

        if (Number(session.revoked) === 1) {
            throw new Error("SHARE_SESSION_INVALID");
        }

        if (
            !session.expires_at ||
            new Date(session.expires_at).getTime() <= Date.now()
        ) {
            throw new Error("SHARE_SESSION_INVALID");
        }

        // An already-opened session remains usable.
        if (session.opened_at !== null) {
            await connection.commit();

            return {
                alreadyOpened: true,
                openCount: Number(currentShare.open_count),
                maxOpens:
                    currentShare.max_opens === null
                        ? null
                        : Number(currentShare.max_opens)
            };
        }

        // Enforce max opens only for a new session.
        if (
            currentShare.max_opens !== null &&
            Number(currentShare.open_count) >=
                Number(currentShare.max_opens)
        ) {
            throw new Error("SHARE_OPEN_LIMIT_REACHED");
        }

        // Mark the recipient session as opened.
        await connection.execute(
            `
            UPDATE share_access_sessions
            SET opened_at = CURRENT_TIMESTAMP
            WHERE session_id = ?
              AND opened_at IS NULL
            `,
            [session.session_id]
        );

        // Increment open counter exactly once.
        await connection.execute(
            `
            UPDATE file_shares
            SET
                open_count = open_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE share_id = ?
            `,
            [share.share_id]
        );

        // Record OPENED activity.
        await connection.execute(
            `
            INSERT INTO share_access_events
            (
                share_id,
                recipient_email,
                event_type,
                ip_address,
                user_agent
            )
            VALUES (?, ?, 'OPENED', ?, ?)
            `,
            [
                share.share_id,
                session.recipient_email || share.recipient_email,
                req.ip || null,
                String(
                    req.headers["user-agent"] || ""
                ).slice(0, 500) || null
            ]
        );

        await connection.commit();

        return {
            alreadyOpened: false,
            openCount: Number(currentShare.open_count) + 1,
            maxOpens:
                currentShare.max_opens === null
                    ? null
                    : Number(currentShare.max_opens)
        };

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}


/*
|--------------------------------------------------------------------------
| RECORD SHARE ACTIVITY
|--------------------------------------------------------------------------
*/

async function recordShareActivity({
    share,
    recipientEmail,
    eventType,
    req
}) {
    try {
        await pool.execute(
            `
            INSERT INTO share_access_events
            (
                share_id,
                recipient_email,
                event_type,
                ip_address,
                user_agent
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                share.share_id,
                recipientEmail || share.recipient_email,
                eventType,
                req.ip || null,
                String(
                    req.headers["user-agent"] || ""
                ).slice(0, 500) || null
            ]
        );

    } catch (error) {
        console.error(
            `Share activity logging failed (${eventType}):`,
            error.message
        );
    }
}


/*
|--------------------------------------------------------------------------
| AUTHORIZE RECIPIENT SHARE ACCESS
|--------------------------------------------------------------------------
|
| Validates the share and recipient session.
| Registers the opening exactly once per session.
|
|--------------------------------------------------------------------------
*/

async function getAuthorizedShare(
    shareToken,
    req
) {
    const sessionToken = getRecipientSessionToken(req);

    if (!sessionToken) {
        throw new Error("SHARE_SESSION_REQUIRED");
    }

    const share = await validateShareAccess(
        shareToken
    );

    const recipientSession =
        await validateShareRecipientSession(
            shareToken,
            sessionToken
        );

    if (!recipientSession) {
        throw new Error("SHARE_SESSION_INVALID");
    }

    const openResult = await registerShareOpen(
        share,
        sessionToken,
        req
    );

    // Refresh the in-memory values because validateShareAccess
    // may have returned the share before the counter increment.
    share.open_count = openResult.openCount;

    if (openResult.maxOpens !== null) {
        share.max_opens = openResult.maxOpens;
    }

    return {
        share,
        recipientSession
    };
}


/*
|--------------------------------------------------------------------------
| REQUEST RECIPIENT EMAIL OTP
|--------------------------------------------------------------------------
| POST /api/shares/access/:shareToken/request-otp
|--------------------------------------------------------------------------
*/

async function requestRecipientOTP(
    req,
    res,
    next
) {
    const shareToken = getShareToken(req);

    try {
        if (!isValidShareToken(shareToken)) {
            return sendError(
                res,
                400,
                "Invalid share token."
            );
        }

        const email = String(
            req.body?.email || ""
        ).trim().toLowerCase();

        if (
            !email ||
            email.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return sendError(
                res,
                400,
                "Please enter a valid email address."
            );
        }

        await requestShareAccessOTP(
            shareToken,
            email
        );

        return res.status(200).json({
            success: true,
            message:
                "If the share details are valid, an OTP has been sent to the supplied email address."
        });

    } catch (error) {
        if (isShareUnavailableError(error)) {
            if (error.message === "SHARE_EXPIRED") {
                await logShareValidationFailure({
                    shareToken,
                    error,
                    req,
                    method: "RECIPIENT_OTP_REQUEST"
                });
            }

            return sendError(
                res,
                error.message === "SHARE_NOT_FOUND"
                    ? 404
                    : 410,
                error.message === "SHARE_NOT_FOUND"
                    ? "Share not found."
                    : "This share is no longer available."
            );
        }

        if (
            error.message === "OTP_RESEND_COOLDOWN" ||
            error.message === "OTP_COOLDOWN"
        ) {
            return sendError(
                res,
                429,
                "Please wait before requesting another OTP."
            );
        }

        if (
            error.message === "RECIPIENT_EMAIL_NOT_ALLOWED" ||
            error.message === "INVALID_RECIPIENT_EMAIL"
        ) {
            return res.status(200).json({
                success: true,
                message:
                    "If the share details are valid, an OTP has been sent to the supplied email address."
            });
        }

        next(error);
    }
}


/*
|--------------------------------------------------------------------------
| VERIFY RECIPIENT EMAIL OTP
|--------------------------------------------------------------------------
| POST /api/shares/access/:shareToken/verify-otp
|--------------------------------------------------------------------------
*/

async function verifyRecipientOTP(
    req,
    res,
    next
) {
    const shareToken = getShareToken(req);

    try {
        if (!isValidShareToken(shareToken)) {
            return sendError(
                res,
                400,
                "Invalid share token."
            );
        }

        const email = String(
            req.body?.email || ""
        ).trim().toLowerCase();

        const otp = String(
            req.body?.otp || ""
        ).trim();

        if (
            !email ||
            email.length > 255 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return sendError(
                res,
                400,
                "Please enter a valid email address."
            );
        }

        if (!/^\d{6}$/.test(otp)) {
            return sendError(
                res,
                400,
                "Please enter the six-digit OTP."
            );
        }

        const result = await verifyShareAccessOTP(
            shareToken,
            email,
            otp
        );

        return res.status(200).json({
            success: true,
            message: "Email verification successful.",
            data: {
                sessionToken: result.sessionToken,
                recipientEmail: result.recipientEmail,
                expiresAt: result.expiresAt
            }
        });

    } catch (error) {
        if (isShareUnavailableError(error)) {
            return sendError(
                res,
                error.message === "SHARE_NOT_FOUND"
                    ? 404
                    : 410,
                "This share is no longer available."
            );
        }

        if (
            [
                "INVALID_OTP",
                "INVALID_OTP_FORMAT",
                "OTP_EXPIRED",
                "OTP_NOT_FOUND_OR_ALREADY_USED"
            ].includes(error.message)
        ) {
            return sendError(
                res,
                400,
                "The OTP is invalid or has expired."
            );
        }

        if (
            error.message === "OTP_MAX_ATTEMPTS_REACHED"
        ) {
            return sendError(
                res,
                429,
                "Maximum OTP attempts reached. Request a new OTP."
            );
        }

        if (
            error.message === "RECIPIENT_EMAIL_NOT_ALLOWED"
        ) {
            return sendError(
                res,
                403,
                "Recipient email does not match this share."
            );
        }

        next(error);
    }
}


/*
|--------------------------------------------------------------------------
| GET SHARED FILE INFORMATION
|--------------------------------------------------------------------------
| GET /api/shares/access/:shareToken
|
| Requires a verified recipient session.
|--------------------------------------------------------------------------
*/

async function getSharedFileInfo(
    req,
    res,
    next
) {
    const shareToken = getShareToken(req);

    try {
        if (!isValidShareToken(shareToken)) {
            return sendError(
                res,
                400,
                "Invalid share token."
            );
        }

        const {
            share,
            recipientSession
        } = await getAuthorizedShare(
            shareToken,
            req
        );

        const file = await getUserFile(
            share.owner_user_id,
            share.file_id
        );

        if (!file) {
            return sendError(
                res,
                404,
                "Shared file not found."
            );
        }

        const permissionType = String(
            recipientSession.permission_type ||
            share.permission_type ||
            "DOWNLOAD"
        ).toUpperCase();

        const watermarkEnabled = getShareWatermarkEnabled(
    share,
    recipientSession
);
        const maxOpens =
            share.max_opens === null
                ? null
                : Number(share.max_opens);

        const openCount = Number(
            share.open_count
        );

        const remainingDownloads =
            share.max_downloads === null
                ? null
                : Math.max(
                    0,
                    Number(share.max_downloads) -
                    Number(share.download_count)
                );

        const watermark = watermarkEnabled
            ? {
                recipientEmail:
                    recipientSession.recipient_email,

                serverTimestamp:
                    new Date().toISOString(),

                ipAddress:
                    req.ip || null
            }
            : null;

        return res.status(200).json({
            success: true,
            data: {
                shareId: share.share_id,
                fileId: file.file_id,
                fileName: file.original_name,
                mimeType: file.mime_type,
                fileSize: file.file_size,
                expiresAt: share.expires_at,

                permissionType,

                watermarkEnabled,
                watermark,

                maxOpens,
                openCount,

                remainingOpens:
                    maxOpens === null
                        ? null
                        : Math.max(
                            0,
                            maxOpens - openCount
                        ),

                maxDownloads:
                    permissionType === "VIEW"
                        ? null
                        : share.max_downloads,

                downloadCount:
                    Number(share.download_count),

                remainingDownloads:
                    permissionType === "VIEW"
                        ? null
                        : remainingDownloads
            }
        });

    } catch (error) {
        if (
            [
                "SHARE_SESSION_REQUIRED",
                "SHARE_SESSION_INVALID",
                "RECIPIENT_SESSION_REQUIRED",
                "INVALID_RECIPIENT_SESSION",
                "RECIPIENT_SESSION_REVOKED",
                "RECIPIENT_SESSION_EXPIRED"
            ].includes(error.message)
        ) {
            return sendError(
                res,
                401,
                "Email verification is required to access this share."
            );
        }

        if (
            error.message === "SHARE_OPEN_LIMIT_REACHED"
        ) {
            return sendError(
                res,
                410,
                "This share has reached its maximum open limit."
            );
        }

        if (error.message === "SHARE_EXPIRED") {
            await logShareValidationFailure({
                shareToken,
                error,
                req,
                method: "RECIPIENT_SHARE_INFO"
            });

            return sendError(
                res,
                410,
                "This share has expired."
            );
        }

        if (error.message === "SHARE_REVOKED") {
            return sendError(
                res,
                410,
                "This share has been revoked."
            );
        }

        if (error.message === "SHARE_NOT_FOUND") {
            return sendError(
                res,
                404,
                "Share not found."
            );
        }

        if (error.message === "FILE_NOT_FOUND") {
            return sendError(
                res,
                404,
                "Shared file not found."
            );
        }

        next(error);
    }
}


/*
|--------------------------------------------------------------------------
| PREVIEW SHARED FILE
|--------------------------------------------------------------------------
| GET /api/shares/access/:shareToken/preview
|
| VIEW and DOWNLOAD recipients may preview supported file types.
| Preview does not increment download_count.
|--------------------------------------------------------------------------
*/

async function previewSharedFile(
    req,
    res,
    next
) {
    const shareToken = getShareToken(req);

    try {
        if (!isValidShareToken(shareToken)) {
            return sendError(
                res,
                400,
                "Invalid share token."
            );
        }

        const {
            share,
            recipientSession
        } = await getAuthorizedShare(
            shareToken,
            req
        );

        const file = await getUserFile(
            share.owner_user_id,
            share.file_id
        );

        if (!file) {
            return sendError(
                res,
                404,
                "Shared file not found."
            );
        }

        const mimeType = normalizeMimeType(
            file.mime_type
        );

        if (!PREVIEW_MIME_TYPES.has(mimeType)) {
            return sendError(
                res,
                415,
                "Preview is not supported for this file type."
            );
        }

        const result = await readDecryptedFile(
            share.owner_user_id,
            share.file_id
        );

       const watermarkEnabled = getShareWatermarkEnabled(
    share,
    recipientSession
);

let responseData = result.data;

if (watermarkEnabled) {
    const watermarkResult = await applyWatermark({
        data: result.data,
        mimeType,
        ...getWatermarkContext(recipientSession, req)
    });

    responseData = watermarkResult.data;
}

        const permissionType = String(
            recipientSession.permission_type ||
            share.permission_type ||
            "DOWNLOAD"
        ).toUpperCase();


        await logShareEvent({
            userId: share.owner_user_id,
            eventType: "SHARE_ACCESSED",
            req,
            metadata: {
                shareId: share.share_id,
                fileId: share.file_id,
                method: "PUBLIC_SHARE_PREVIEW",
                permissionType,
                watermarkEnabled
            }
        });

        await recordShareActivity({
            share,
            recipientEmail: recipientSession.recipient_email,
            eventType: "VIEWED",
            req
        });

        res.setHeader(
            "Content-Type",
            mimeType
        );

        res.setHeader(
            "Content-Disposition",
            `inline; ${encodeFileName(file.original_name)}`
        );

        res.setHeader(
            "X-Content-Type-Options",
            "nosniff"
        );

        res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, proxy-revalidate"
        );

        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        res.setHeader(
            "Content-Length",
            responseData.length
        );

        res.setHeader(
            "Content-Security-Policy",
            "default-src 'none'; sandbox"
        );

        res.setHeader(
            "X-Frame-Options",
            "DENY"
        );

        res.setHeader(
            "Cross-Origin-Resource-Policy",
            "same-origin"
        );

        res.setHeader(
            "Referrer-Policy",
            "no-referrer"
        );

        return res.status(200).send(
            responseData
        );

    } catch (error) {
        if (
            [
                "SHARE_SESSION_REQUIRED",
                "SHARE_SESSION_INVALID",
                "RECIPIENT_SESSION_REQUIRED",
                "INVALID_RECIPIENT_SESSION",
                "RECIPIENT_SESSION_REVOKED",
                "RECIPIENT_SESSION_EXPIRED"
            ].includes(error.message)
        ) {
            return sendError(
                res,
                401,
                "Email verification is required to preview this file."
            );
        }

        if (
            error.message === "SHARE_OPEN_LIMIT_REACHED"
        ) {
            return sendError(
                res,
                410,
                "This share has reached its maximum open limit."
            );
        }

        if (error.message === "SHARE_EXPIRED") {
            await logShareValidationFailure({
                shareToken,
                error,
                req,
                method: "PUBLIC_SHARE_PREVIEW"
            });

            return sendError(
                res,
                410,
                "This share has expired."
            );
        }

        if (error.message === "SHARE_REVOKED") {
            return sendError(
                res,
                410,
                "This share has been revoked."
            );
        }

        if (error.message === "SHARE_NOT_FOUND") {
            return sendError(
                res,
                404,
                "Share not found."
            );
        }

        if (error.message === "FILE_NOT_FOUND") {
            return sendError(
                res,
                404,
                "Shared file not found."
            );
        }

        if (
            error.message === "FILE_INTEGRITY_CHECK_FAILED" ||
            error.message ===
                "Unsupported state or unable to authenticate data"
        ) {
            return sendError(
                res,
                409,
                "File integrity verification failed."
            );
        }
            if (error.message === "WATERMARK_UNSUPPORTED_FILE_TYPE") {
    return sendError(
        res,
        415,
        "Watermark is not supported for this file format. The file was not delivered."
    );
}

if (
    error.message === "WATERMARK_PROCESSING_FAILED" ||
    error.message === "WATERMARK_INVALID_INPUT"
) {
    return sendError(
        res,
        500,
        "Watermark processing failed. The file was not delivered."
    );
}

        next(error);
    }
}


/*
|--------------------------------------------------------------------------
| DOWNLOAD SHARED FILE
|--------------------------------------------------------------------------
| GET /api/shares/access/:shareToken/download
|
| Only DOWNLOAD permission can download the original file.
|--------------------------------------------------------------------------
*/

async function downloadSharedFile(
    req,
    res,
    next
) {
    const shareToken = getShareToken(req);

    try {
        if (!isValidShareToken(shareToken)) {
            return sendError(
                res,
                400,
                "Invalid share token."
            );
        }

        const {
            share,
            recipientSession
        } = await getAuthorizedShare(
            shareToken,
            req
        );

        const permissionType = String(
            recipientSession.permission_type ||
            share.permission_type ||
            "DOWNLOAD"
        ).toUpperCase();

        if (permissionType !== "DOWNLOAD") {
            return sendError(
                res,
                403,
                "This share allows preview only. Download is disabled."
            );
        }

        await validateShareAccess(
            shareToken,
            {
                requireDownloadPermission: true,
                enforceDownloadLimit: true
            }
        );

        const file = await getUserFile(
            share.owner_user_id,
            share.file_id
        );

        if (!file) {
            return sendError(
                res,
                404,
                "Shared file not found."
            );
        }

        const result = await readDecryptedFile(
            share.owner_user_id,
            share.file_id
        );

        const watermarkEnabled = getShareWatermarkEnabled(
    share,
    recipientSession
);

let responseData = result.data;

if (watermarkEnabled) {
    const watermarkResult = await applyWatermark({
        data: result.data,
        mimeType: normalizeMimeType(file.mime_type),
        ...getWatermarkContext(recipientSession, req)
    });

    responseData = watermarkResult.data;
}

        // Atomic update prevents concurrent requests
        // from exceeding max_downloads.
        const [updateResult] = await pool.execute(
            `
            UPDATE file_shares
            SET
                download_count = download_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE share_id = ?
              AND revoked = 0
              AND (
                  expires_at IS NULL
                  OR expires_at > NOW()
              )
              AND (
                  max_downloads IS NULL
                  OR download_count < max_downloads
              )
              AND permission_type = 'DOWNLOAD'
            `,
            [share.share_id]
        );

        if (updateResult.affectedRows !== 1) {
            const latestShare = await getShareByToken(
                shareToken
            );

            if (
                latestShare &&
                latestShare.expires_at &&
                new Date(latestShare.expires_at).getTime() <= Date.now()
            ) {
                return sendError(
                    res,
                    410,
                    "This share has expired."
                );
            }

            if (
                latestShare &&
                Number(latestShare.revoked) === 1
            ) {
                return sendError(
                    res,
                    410,
                    "This share has been revoked."
                );
            }

            if (
                latestShare &&
                latestShare.max_downloads !== null &&
                Number(latestShare.download_count) >=
                    Number(latestShare.max_downloads)
            ) {
                return sendError(
                    res,
                    410,
                    "This share has reached its download limit."
                );
            }

            return sendError(
                res,
                410,
                "This share is no longer available."
            );
        }

        await logShareEvent({
            userId: share.owner_user_id,
            eventType: "SHARE_ACCESSED",
            req,
            metadata: {
                shareId: share.share_id,
                fileId: share.file_id,
                method: "PUBLIC_SHARE_DOWNLOAD",
                permissionType: "DOWNLOAD",
                watermarkEnabled
            }
        });

        await recordShareActivity({
            share,
            recipientEmail: recipientSession.recipient_email,
            eventType: "DOWNLOADED",
            req
        });

        res.setHeader(
            "Content-Type",
            file.mime_type || "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; ${encodeFileName(file.original_name)}`
        );

        res.setHeader(
            "X-Content-Type-Options",
            "nosniff"
        );

        res.setHeader(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, proxy-revalidate"
        );

        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

       res.setHeader(
    "Content-Length",
    responseData.length
);

        res.setHeader(
            "Referrer-Policy",
            "no-referrer"
        );

        return res.status(200).send(result.data);

    } catch (error) {
        if (
            [
                "SHARE_SESSION_REQUIRED",
                "SHARE_SESSION_INVALID",
                "RECIPIENT_SESSION_REQUIRED",
                "INVALID_RECIPIENT_SESSION",
                "RECIPIENT_SESSION_REVOKED",
                "RECIPIENT_SESSION_EXPIRED"
            ].includes(error.message)
        ) {
            return sendError(
                res,
                401,
                "Email verification is required to download this file."
            );
        }

        if (
            error.message === "SHARE_OPEN_LIMIT_REACHED"
        ) {
            return sendError(
                res,
                410,
                "This share has reached its maximum open limit."
            );
        }

        if (
            error.message === "SHARE_DOWNLOAD_NOT_ALLOWED"
        ) {
            return sendError(
                res,
                403,
                "This share does not allow downloads."
            );
        }

        if (error.message === "SHARE_EXPIRED") {
            await logShareValidationFailure({
                shareToken,
                error,
                req,
                method: "PUBLIC_SHARE_DOWNLOAD"
            });

            return sendError(
                res,
                410,
                "This share has expired."
            );
        }

        if (
            error.message === "SHARE_DOWNLOAD_LIMIT_REACHED"
        ) {
            await logShareValidationFailure({
                shareToken,
                error,
                req,
                method: "PUBLIC_SHARE_DOWNLOAD"
            });

            return sendError(
                res,
                410,
                "This share has reached its download limit."
            );
        }

        if (error.message === "SHARE_REVOKED") {
            return sendError(
                res,
                410,
                "This share has been revoked."
            );
        }

        if (error.message === "SHARE_NOT_FOUND") {
            return sendError(
                res,
                404,
                "Share not found."
            );
        }

        if (error.message === "FILE_NOT_FOUND") {
            return sendError(
                res,
                404,
                "Shared file not found."
            );
        }

        if (
            error.message === "FILE_INTEGRITY_CHECK_FAILED" ||
            error.message ===
                "Unsupported state or unable to authenticate data"
        ) {
            return sendError(
                res,
                409,
                "File integrity verification failed."
            );
        }

            if (error.message === "WATERMARK_UNSUPPORTED_FILE_TYPE") {
    return sendError(
        res,
        415,
        "Watermark is not supported for this file format. The file was not delivered."
    );
}

if (
    error.message === "WATERMARK_PROCESSING_FAILED" ||
    error.message === "WATERMARK_INVALID_INPUT"
) {
    return sendError(
        res,
        500,
        "Watermark processing failed. The file was not delivered."
    );
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
    requestRecipientOTP,
    verifyRecipientOTP,
    getSharedFileInfo,
    previewSharedFile,
    downloadSharedFile
};
