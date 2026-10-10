const {
    saveEncryptedFile,
    readDecryptedFile,
    deleteUserFile
} = require("../services/vaultService");

const {
    verifyUserPassword
} = require("../services/authService");

const {
    getUserFiles
} = require("../services/fileManagementService");

const {
    unlockVault,
    lockVault,
    getVaultLockStatus,
    requireUnlockedVault
} = require("../services/vaultLockService");

const {
    logSecurityEvent
} = require("../services/securityEventService");


// =====================================================
// UPLOAD FILES
// =====================================================

async function uploadFiles(req, res, next) {
    try {
        await requireUnlockedVault(
            req.user.userId,
            req
        );

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
            message: "File(s) uploaded successfully.",
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
        await requireUnlockedVault(
            req.user.userId,
            req
        );

        // -------------------------------------------------
        // IMPORTANT:
        // Do not use Number(req.query.page || 1)
        // because 0 is falsy in JavaScript.
        // -------------------------------------------------

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
            ? String(req.query.sortBy)
                .trim()
                .toLowerCase()
            : "date";

        const sortOrder = req.query.sortOrder
            ? String(req.query.sortOrder)
                .trim()
                .toLowerCase()
            : "desc";


        // -------------------------------------------------
        // PAGE VALIDATION
        // -------------------------------------------------

        if (
            !Number.isInteger(page) ||
            page < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Page must be a positive integer."
            });
        }


        // -------------------------------------------------
        // LIMIT VALIDATION
        // -------------------------------------------------

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


        // -------------------------------------------------
        // SEARCH VALIDATION
        // -------------------------------------------------

        if (search.length > 255) {
            return res.status(400).json({
                success: false,
                message: "Search query must not exceed 255 characters."
            });
        }


        // -------------------------------------------------
        // MIME TYPE VALIDATION
        // -------------------------------------------------

        if (mimeType.length > 100) {
            return res.status(400).json({
                success: false,
                message: "MIME type must not exceed 100 characters."
            });
        }


        // -------------------------------------------------
        // SORT BY VALIDATION
        // -------------------------------------------------

        const allowedSortFields = new Set([
            "name",
            "size",
            "date"
        ]);

        if (!allowedSortFields.has(sortBy)) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid sortBy. Use name, size, or date."
            });
        }


        // -------------------------------------------------
        // SORT ORDER VALIDATION
        // -------------------------------------------------

        const allowedSortOrders = new Set([
            "asc",
            "desc"
        ]);

        if (!allowedSortOrders.has(sortOrder)) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid sortOrder. Use asc or desc."
            });
        }


        // -------------------------------------------------
        // GET FILES
        // -------------------------------------------------

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
        await requireUnlockedVault(
            req.user.userId,
            req
        );

        if (
            !Number.isInteger(fileId) ||
            fileId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        const result = await readDecryptedFile(
            req.user.userId,
            fileId
        );

        const {
            file,
            data
        } = result;


        // -------------------------------------------------
        // RESPONSE HEADERS
        // -------------------------------------------------

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
            "Content-Length",
            data.length
        );


        // -------------------------------------------------
        // SECURITY AUDIT
        // -------------------------------------------------

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

        // -------------------------------------------------
        // FILE NOT FOUND
        // -------------------------------------------------

        if (
            error.message === "FILE_NOT_FOUND"
        ) {
            return res.status(404).json({
                success: false,
                message: "File not found."
            });
        }


        // -------------------------------------------------
        // PLAINTEXT HASH INTEGRITY FAILURE
        // -------------------------------------------------

        if (
            error.message ===
            "FILE_INTEGRITY_CHECK_FAILED"
        ) {
            try {
                await logSecurityEvent({
                    userId: req.user.userId,
                    eventType: "FILE_INTEGRITY_FAILED",
                    req,
                    metadata: {
                        fileId,
                        reason:
                            "PLAINTEXT_HASH_MISMATCH"
                    }
                });
            } catch (auditError) {
                console.error(
                    "FILE_INTEGRITY_FAILED audit failed:",
                    auditError.message
                );
            }

            return res.status(409).json({
                success: false,
                message:
                    "File integrity verification failed. The stored file may have been modified or corrupted."
            });
        }


        // -------------------------------------------------
        // AES-GCM AUTHENTICATION FAILURE
        // -------------------------------------------------

        if (
            error.message ===
            "Unsupported state or unable to authenticate data"
        ) {
            try {
                await logSecurityEvent({
                    userId: req.user.userId,
                    eventType: "FILE_INTEGRITY_FAILED",
                    req,
                    metadata: {
                        fileId,
                        reason:
                            "AES_GCM_AUTHENTICATION_FAILED"
                    }
                });
            } catch (auditError) {
                console.error(
                    "FILE_INTEGRITY_FAILED audit failed:",
                    auditError.message
                );
            }

            return res.status(409).json({
                success: false,
                message:
                    "File integrity verification failed. The stored file may have been modified or corrupted."
            });
        }

        next(error);
    }
}


// =====================================================
// DELETE FILE
// =====================================================

async function deleteFile(req, res, next) {
    const fileId = Number(req.params.fileId);

    try {
        await requireUnlockedVault(
            req.user.userId,
            req
        );

        if (
            !Number.isInteger(fileId) ||
            fileId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid file ID."
            });
        }

        await deleteUserFile(
            req.user.userId,
            fileId
        );


        // -------------------------------------------------
        // SECURITY AUDIT
        // -------------------------------------------------

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

        if (
            error.message === "FILE_NOT_FOUND"
        ) {
            return res.status(404).json({
                success: false,
                message: "File not found."
            });
        }

        next(error);
    }
}


// =====================================================
// GET VAULT LOCK STATUS
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
// UNLOCK VAULT
// =====================================================

async function unlock(req, res, next) {

    try {

        // -------------------------------------------------
        // REQUIRE PASSWORD
        // -------------------------------------------------

        const password =
            req.body?.password;

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
        // VERIFY USER PASSWORD
        // -------------------------------------------------

        try {

            await verifyUserPassword(
                req.user.userId,
                password
            );

        } catch (error) {

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

            throw error;
        }


        // -------------------------------------------------
        // PASSWORD VERIFIED
        // -------------------------------------------------

        const result =
            await unlockVault(
                req.user.userId,
                req
            );


        // -------------------------------------------------
        // SECURITY AUDIT
        // -------------------------------------------------

        try {

            await logSecurityEvent({

                userId:
                    req.user.userId,

                eventType:
                    "VAULT_UNLOCKED",

                req,

                metadata: {

                    method:
                        "USER_UNLOCK"

                }

            });

        } catch (auditError) {

            console.error(
                "VAULT_UNLOCKED audit failed:",
                auditError.message
            );

        }


        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "Vault unlocked successfully.",

            data:
                result

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
    deleteFile,
    getLockStatus,
    unlock,
    lock
};