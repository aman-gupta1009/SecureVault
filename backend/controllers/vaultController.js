
const { pool } = require("../config/database");

const {
    saveEncryptedFile,
    readDecryptedFile,
    deleteUserFile
} = require("../services/vaultService");

const { verifyUserPassword } = require("../services/authService");
const { getUserFiles } = require("../services/fileManagementService");

const {
    unlockVault,
    lockVault,
    getVaultLockStatus,
    requireUnlockedVault
} = require("../services/vaultLockService");

const { logSecurityEvent } = require("../services/securityEventService");


// =====================================================
// PREVIEW MIME CONFIGURATION
// =====================================================

// Only these types can be rendered by the frontend.
// Unknown and active-content formats are delivered as
// application/octet-stream instead.
const SAFE_PREVIEW_TYPES = new Set([
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",

    // Documents
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",

    // Spreadsheets
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",

    // Presentations
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    // Text
    "text/plain",
    "text/markdown",
    "application/json",
    "application/xml",
    "text/xml",

    // Audio
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/webm",

    // Video
    "video/mp4",
    "video/webm",
    "video/ogg"
]);

const EXTENSION_MIME_TYPES = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",

    pdf: "application/pdf",

    doc: "application/msword",

    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    csv: "text/csv",

    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    xml: "application/xml",

    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",

    mp4: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg"
};

function getPreviewMimeType(file) {
    const originalName = String(file.original_name || "");
    const extension = originalName.includes(".")
        ? originalName.split(".").pop().toLowerCase()
        : "";

    const extensionMime = EXTENSION_MIME_TYPES[extension];
    const storedMime = String(file.mime_type || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

    // Prefer a recognized extension when the stored MIME
    // is missing or generic.
    if (
        extensionMime &&
        (
            !storedMime ||
            storedMime === "application/octet-stream"
        )
    ) {
        return extensionMime;
    }

    if (SAFE_PREVIEW_TYPES.has(storedMime)) {
        return storedMime;
    }

    if (extensionMime && SAFE_PREVIEW_TYPES.has(extensionMime)) {
        return extensionMime;
    }

    return "application/octet-stream";
}

function safeDownloadName(value) {
    return String(value || "file")
        .replace(/[\r\n"]/g, "_")
        .replace(/[\\/]/g, "_");
}

async function logFileIntegrityFailure(req, fileId, reason) {
    try {
        await logSecurityEvent({
            userId: req.user.userId,
            eventType: "FILE_INTEGRITY_FAILED",
            req,
            metadata: {
                fileId,
                reason
            }
        });
    } catch (auditError) {
        console.error(
            "FILE_INTEGRITY_FAILED audit failed:",
            auditError.message
        );
    }
}

function handleReadFileError(error, req, res, fileId) {
    if (error.message === "FILE_NOT_FOUND") {
        return res.status(404).json({
            success: false,
            message: "File not found."
        });
    }

    if (error.message === "FILE_INTEGRITY_CHECK_FAILED") {
        logFileIntegrityFailure(
            req,
            fileId,
            "PLAINTEXT_HASH_MISMATCH"
        );

        return res.status(409).json({
            success: false,
            message:
                "File integrity verification failed. The stored file may have been modified or corrupted."
        });
    }

    if (
        error.message ===
        "Unsupported state or unable to authenticate data"
    ) {
        logFileIntegrityFailure(
            req,
            fileId,
            "AES_GCM_AUTHENTICATION_FAILED"
        );

        return res.status(409).json({
            success: false,
            message:
                "File integrity verification failed. The stored file may have been modified or corrupted."
        });
    }

    return null;
}


// =====================================================
// UPLOAD FILES
// =====================================================

async function uploadFiles(req, res, next) {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No files were uploaded."
            });
        }

        const uploadedFiles = [];

        for (const file of req.files) {
            const result = await saveEncryptedFile(
                req.user.userId,
                file
            );

            uploadedFiles.push(result);

            try {
                await logSecurityEvent({
                    userId: req.user.userId,
                    eventType: "FILE_UPLOADED",
                    req,
                    metadata: {
                        fileId: result.fileId,
                        originalName: result.originalName,
                        fileSize: result.fileSize,
                        keyVersion: result.keyVersion
                    }
                });
            } catch (auditError) {
                console.error(
                    "FILE_UPLOADED audit failed:",
                    auditError.message
                );
            }
        }

        return res.status(201).json({
            success: true,
            message: "File(s) encrypted and uploaded successfully.",
            data: {
                files: uploadedFiles
            }
        });
    } catch (error) {
        next(error);
    }
}


// =====================================================
// LIST FILES
// =====================================================

async function listFiles(req, res, next) {
    try {
        await requireUnlockedVault(req.user.userId, req);

        const page = req.query.page === undefined
            ? 1
            : Number(req.query.page);

        const limit = req.query.limit === undefined
            ? 20
            : Number(req.query.limit);

        const search = req.query.search
            ? String(req.query.search).trim()
            : "";

        const mimeType = req.query.mimeType
            ? String(req.query.mimeType).trim()
            : "";

        const sortBy = req.query.sortBy
            ? String(req.query.sortBy).trim().toLowerCase()
            : "date";

        const sortOrder = req.query.sortOrder
            ? String(req.query.sortOrder).trim().toLowerCase()
            : "desc";

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

        if (search.length > 255) {
            return res.status(400).json({
                success: false,
                message: "Search query must not exceed 255 characters."
            });
        }

        if (mimeType.length > 100) {
            return res.status(400).json({
                success: false,
                message: "MIME type must not exceed 100 characters."
            });
        }

        const allowedSortFields = new Set([
            "name",
            "size",
            "date"
        ]);

        if (!allowedSortFields.has(sortBy)) {
            return res.status(400).json({
                success: false,
                message: "Invalid sortBy. Use name, size, or date."
            });
        }

        const allowedSortOrders = new Set([
            "asc",
            "desc"
        ]);

        if (!allowedSortOrders.has(sortOrder)) {
            return res.status(400).json({
                success: false,
                message: "Invalid sortOrder. Use asc or desc."
            });
        }

        const result = await getUserFiles(
            req.user.userId,
            {
                page,
                limit,
                search,
                mimeType,
                sortBy,
                sortOrder
            }
        );

        return res.status(200).json({
            success: true,
            message: "Files retrieved successfully.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}


// =====================================================
// DOWNLOAD FILE
// =====================================================

async function downloadFile(req, res, next) {
    const fileId = Number(req.params.fileId);

    try {
        await requireUnlockedVault(req.user.userId, req);

        if (!Number.isInteger(fileId) || fileId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        const { file, data } = await readDecryptedFile(
            req.user.userId,
            fileId
        );

        const safeName = safeDownloadName(file.original_name);

        res.setHeader(
            "Content-Type",
            file.mime_type || "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(safeName)}"`
        );

        res.setHeader("Content-Length", data.length);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, no-store");

        try {
            await logSecurityEvent({
                userId: req.user.userId,
                eventType: "FILE_DOWNLOADED",
                req,
                metadata: {
                    fileId: file.file_id,
                    originalName: file.original_name,
                    fileSize: file.file_size,
                    keyVersion: file.key_version
                }
            });
        } catch (auditError) {
            console.error(
                "FILE_DOWNLOADED audit failed:",
                auditError.message
            );
        }

        return res.send(data);
    } catch (error) {
        const handled = handleReadFileError(
            error,
            req,
            res,
            fileId
        );

        if (handled) return handled;

        next(error);
    }
}


// =====================================================
// VIEW / PREVIEW FILE
// =====================================================

async function viewFile(req, res, next) {
    const fileId = Number(req.params.fileId);

    try {
        await requireUnlockedVault(req.user.userId, req);

        if (!Number.isInteger(fileId) || fileId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        const { file, data } = await readDecryptedFile(
            req.user.userId,
            fileId
        );

        const mimeType = getPreviewMimeType(file);

        // Only recognized, safe preview formats are served
        // with their original MIME type.
        // Unknown formats are served as binary downloads.
        const canPreview = mimeType !== "application/octet-stream";

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Length", data.length);

        res.setHeader(
            "Content-Disposition",
            canPreview ? "inline" : "attachment"
        );

        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, no-store");

        // Apply a sandbox policy to previewable formats except PDF.
        // Chrome's built-in PDF viewer is blocked when the PDF response
        // carries the CSP sandbox directive. The PDF is still served only
        // after authentication, vault-unlock checks, and integrity checks.
        if (mimeType !== "application/pdf") {
            res.setHeader(
                "Content-Security-Policy",
                "default-src 'none'; sandbox"
            );
        }

        res.setHeader("X-Frame-Options", "SAMEORIGIN");

        try {
            await logSecurityEvent({
                userId: req.user.userId,
                eventType: "FILE_VIEWED",
                req,
                metadata: {
                    fileId: file.file_id,
                    originalName: file.original_name,
                    mimeType,
                    previewSupported: canPreview
                }
            });
        } catch (auditError) {
            console.error(
                "FILE_VIEWED audit failed:",
                auditError.message
            );
        }

        return res.send(data);
    } catch (error) {
        const handled = handleReadFileError(
            error,
            req,
            res,
            fileId
        );

        if (handled) return handled;

        next(error);
    }
}


// =====================================================
// RESTORE FILE TO LOCAL SYSTEM
// =====================================================

async function restoreFile(req, res, next) {
    const fileId = Number(req.params.fileId);

    try {
        await requireUnlockedVault(req.user.userId, req);

        if (!Number.isInteger(fileId) || fileId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        const { file, data } = await readDecryptedFile(
            req.user.userId,
            fileId
        );

        const safeName = safeDownloadName(file.original_name);

        res.setHeader(
            "Content-Type",
            file.mime_type || "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${encodeURIComponent(safeName)}"`
        );

        res.setHeader("Content-Length", data.length);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, no-store");

        try {
            await logSecurityEvent({
                userId: req.user.userId,
                eventType: "FILE_RESTORED",
                req,
                metadata: {
                    fileId: file.file_id,
                    originalName: file.original_name
                }
            });
        } catch (auditError) {
            console.error(
                "FILE_RESTORED audit failed:",
                auditError.message
            );
        }

        return res.send(data);
    } catch (error) {
        const handled = handleReadFileError(
            error,
            req,
            res,
            fileId
        );

        if (handled) return handled;

        next(error);
    }
}


// =====================================================
// DELETE FILE
// =====================================================

async function deleteFile(req, res, next) {
    const fileId = Number(req.params.fileId);

    try {
        await requireUnlockedVault(req.user.userId, req);

        if (!Number.isInteger(fileId) || fileId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        await deleteUserFile(
            req.user.userId,
            fileId
        );

        try {
            await logSecurityEvent({
                userId: req.user.userId,
                eventType: "FILE_DELETED",
                req,
                metadata: {
                    fileId
                }
            });
        } catch (auditError) {
            console.error(
                "FILE_DELETED audit failed:",
                auditError.message
            );
        }

        return res.status(200).json({
            success: true,
            message: "File deleted successfully."
        });
    } catch (error) {
        if (error.message === "FILE_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "File not found."
            });
        }

        next(error);
    }
}


// =====================================================
// VAULT LOCK STATUS
// =====================================================

async function getLockStatus(req, res, next) {
    try {
        const status = await getVaultLockStatus(
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
// FILE COUNT
// =====================================================


async function getFileCount(req, res, next) {
    try {
        const [rows] = await pool.execute(
            `
            SELECT
                COUNT(*) AS total,
                COALESCE(SUM(file_size), 0) AS totalStorageBytes
            FROM vault_files
            WHERE user_id = ?
            `,
            [req.user.userId]
        );

        return res.status(200).json({
            success: true,
            data: {
                total: Number(rows[0].total || 0),
                totalStorageBytes: Number(
                    rows[0].totalStorageBytes || 0
                )
            }
        });
    } catch (error) {
        next(error);
    }
}



// =====================================================
// UNLOCK VAULT
// =====================================================

async function unlock(req, res, next) {
    try {
        const password = req.body?.password;

        if (
            typeof password !== "string" ||
            password.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Password is required."
            });
        }

        try {
            await verifyUserPassword(
                req.user.userId,
                password
            );
        } catch (error) {
            if (error.message === "INVALID_PASSWORD") {
                return res.status(401).json({
                    success: false,
                    message: "Invalid password."
                });
            }

            if (error.message === "USER_NOT_FOUND") {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required."
                });
            }

            throw error;
        }

        const result = await unlockVault(
            req.user.userId,
            req
        );

        try {
            await logSecurityEvent({
                userId: req.user.userId,
                eventType: "VAULT_UNLOCKED",
                req,
                metadata: {
                    method: "USER_UNLOCK"
                }
            });
        } catch (auditError) {
            console.error(
                "VAULT_UNLOCKED audit failed:",
                auditError.message
            );
        }

        return res.status(200).json({
            success: true,
            message: "Vault unlocked successfully.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}


// =====================================================
// LOCK VAULT
// =====================================================

async function lock(req, res, next) {
    try {
        const result = await lockVault(
            req.user.userId,
            req
        );

        try {
            await logSecurityEvent({
                userId: req.user.userId,
                eventType: "VAULT_LOCKED",
                req,
                metadata: {
                    method: "USER_LOCK"
                }
            });
        } catch (auditError) {
            console.error(
                "VAULT_LOCKED audit failed:",
                auditError.message
            );
        }

        return res.status(200).json({
            success: true,
            message: "Vault locked successfully.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    uploadFiles,
    listFiles,
    downloadFile,
    viewFile,
    restoreFile,
    deleteFile,
    getLockStatus,
    getFileCount,
    unlock,
    lock
};
