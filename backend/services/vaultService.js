const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { pool } = require("../config/database");

const {
    encryptData,
    decryptData,
    encryptFileKey,
    decryptFileKey,
    generateFileKey,
    getActiveKeyVersion
} = require("./encryptionService");


// =====================================================
// STORAGE CONFIGURATION
// =====================================================

const ENCRYPTED_STORAGE_PATH = path.join(
    __dirname,
    "..",
    "storage",
    "encrypted"
);


// =====================================================
// ENSURE STORAGE DIRECTORY
// =====================================================

async function ensureStorageDirectory() {

    await fs.mkdir(
        ENCRYPTED_STORAGE_PATH,
        {
            recursive: true
        }
    );
}


// =====================================================
// CALCULATE SHA-256 FILE HASH
// =====================================================

function calculateFileHash(buffer) {

    if (!Buffer.isBuffer(buffer)) {

        throw new Error(
            "INVALID_FILE_BUFFER"
        );
    }

    return crypto
        .createHash("sha256")
        .update(buffer)
        .digest("hex");
}


// =====================================================
// SAVE ENCRYPTED FILE
// =====================================================

async function saveEncryptedFile(
    userId,
    file
) {

    if (!file || !file.buffer) {

        throw new Error(
            "FILE_DATA_REQUIRED"
        );
    }


    await ensureStorageDirectory();


    // -------------------------------------------------
    // Calculate SHA-256 BEFORE encryption
    // -------------------------------------------------

    const fileHash =
        calculateFileHash(
            file.buffer
        );


    // -------------------------------------------------
    // Generate unique stored filename
    // -------------------------------------------------

    const storedName =
        crypto.randomUUID() + ".vault";


    const storagePath =
        path.join(
            ENCRYPTED_STORAGE_PATH,
            storedName
        );


    // -------------------------------------------------
    // Get active master-key version
    // -------------------------------------------------

    const keyVersion =
        getActiveKeyVersion();


    // -------------------------------------------------
    // Generate unique file encryption key
    // -------------------------------------------------

    const fileKey =
        generateFileKey();


    // -------------------------------------------------
    // Encrypt file using DEK
    // -------------------------------------------------

    const encryptedFile =
        encryptData(
            file.buffer,
            fileKey
        );


    // -------------------------------------------------
    // Encrypt DEK using active master key
    // -------------------------------------------------

    const encryptedDEK =
        encryptFileKey(
            fileKey,
            keyVersion
        );


    // -------------------------------------------------
    // Clear DEK from memory after wrapping
    // -------------------------------------------------

    fileKey.fill(0);


    // -------------------------------------------------
    // Write encrypted file
    // -------------------------------------------------

    await fs.writeFile(
        storagePath,
        encryptedFile.encrypted
    );


    try {

        // -------------------------------------------------
        // Save metadata
        // -------------------------------------------------

        const [
            result
        ] = await pool.execute(

            `
            INSERT INTO vault_files
            (
                user_id,
                original_name,
                stored_name,
                mime_type,
                file_size,
                file_hash,
                encryption_version,
                key_version,
                encrypted_dek,
                file_iv,
                file_auth_tag,
                storage_path
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?
            )
            `,

            [

                userId,

                file.originalname,

                storedName,

                file.mimetype || null,

                file.size,

                fileHash,

                "v1",

                keyVersion,

                JSON.stringify({

                    encrypted:
                        encryptedDEK.encrypted.toString(
                            "base64"
                        ),

                    iv:
                        encryptedDEK.iv,

                    authTag:
                        encryptedDEK.authTag

                }),

                encryptedFile.iv,

                encryptedFile.authTag,

                storagePath

            ]

        );


        return {

            fileId:
                result.insertId,

            originalName:
                file.originalname,

            storedName,

            mimeType:
                file.mimetype || null,

            fileSize:
                file.size,

            keyVersion,

            fileHash

        };

    } catch (error) {

        // -------------------------------------------------
        // Remove encrypted file if DB insertion fails
        // -------------------------------------------------

        try {

            await fs.unlink(
                storagePath
            );

        } catch (_) {

            // Ignore cleanup error
        }


        throw error;
    }
}


// =====================================================
// GET USER FILES
// =====================================================

async function getUserFiles(
    userId
) {

    const [
        rows
    ] = await pool.execute(

        `
        SELECT
            file_id,
            original_name,
            mime_type,
            file_size,
            file_hash,
            encryption_version,
            key_version,
            created_at,
            updated_at
        FROM vault_files
        WHERE user_id = ?
        ORDER BY created_at DESC
        `,

        [userId]

    );


    return rows;
}


// =====================================================
// GET FILE METADATA
// =====================================================

async function getUserFile(
    userId,
    fileId
) {

    const [
        rows
    ] = await pool.execute(

        `
        SELECT
            file_id,
            user_id,
            original_name,
            stored_name,
            mime_type,
            file_size,
            file_hash,
            encryption_version,
            key_version,
            encrypted_dek,
            file_iv,
            file_auth_tag,
            storage_path,
            created_at,
            updated_at
        FROM vault_files
        WHERE file_id = ?
        AND user_id = ?
        LIMIT 1
        `,

        [
            fileId,
            userId
        ]

    );


    if (rows.length === 0) {

        return null;
    }


    return rows[0];
}


// =====================================================
// READ AND DECRYPT FILE
// =====================================================

async function readDecryptedFile(
    userId,
    fileId
) {

    const file =
        await getUserFile(
            userId,
            fileId
        );


    if (!file) {

        const error =
            new Error(
                "FILE_NOT_FOUND"
            );

        throw error;
    }


    // -------------------------------------------------
    // Read encrypted file
    // -------------------------------------------------

    const encryptedFile =
        await fs.readFile(
            file.storage_path
        );


    // -------------------------------------------------
    // Decode encrypted DEK
    // -------------------------------------------------

    const encryptedDEK =
        typeof file.encrypted_dek === "string"
            ? JSON.parse(file.encrypted_dek)
            : file.encrypted_dek;


    if (
        !encryptedDEK ||
        !encryptedDEK.encrypted ||
        !encryptedDEK.iv ||
        !encryptedDEK.authTag
    ) {

        throw new Error(
            "INVALID_ENCRYPTED_FILE_KEY"
        );
    }


    const encryptedKey =
        Buffer.from(
            encryptedDEK.encrypted,
            "base64"
        );


    // -------------------------------------------------
    // Decrypt DEK using its stored key version
    // -------------------------------------------------

    const fileKey =
        decryptFileKey(
            encryptedKey,
            encryptedDEK.iv,
            encryptedDEK.authTag,
            file.key_version
        );


    let decryptedFile;

    try {

        // -------------------------------------------------
        // Decrypt file using DEK
        // -------------------------------------------------

        decryptedFile =
            decryptData(
                encryptedFile,
                fileKey,
                file.file_iv,
                file.file_auth_tag
            );

    } finally {

        // -------------------------------------------------
        // Clear DEK from memory
        // -------------------------------------------------

        fileKey.fill(0);
    }


    // -------------------------------------------------
    // FILE INTEGRITY VERIFICATION
    // -------------------------------------------------

    if (file.file_hash) {

        const calculatedHash =
            calculateFileHash(
                decryptedFile
            );


        const storedHash =
            String(
                file.file_hash
            ).toLowerCase();


        const calculatedHashBuffer =
            Buffer.from(
                calculatedHash,
                "hex"
            );

        const storedHashBuffer =
            Buffer.from(
                storedHash,
                "hex"
            );


        if (
            calculatedHashBuffer.length !==
            storedHashBuffer.length ||
            !crypto.timingSafeEqual(
                calculatedHashBuffer,
                storedHashBuffer
            )
        ) {

            const error =
                new Error(
                    "FILE_INTEGRITY_CHECK_FAILED"
                );

            throw error;
        }

    }


    return {

        file,

        data:
            decryptedFile

    };
}


// =====================================================
// DELETE FILE
// =====================================================

async function deleteUserFile(
    userId,
    fileId
) {

    const file =
        await getUserFile(
            userId,
            fileId
        );


    if (!file) {

        const error =
            new Error(
                "FILE_NOT_FOUND"
            );

        throw error;
    }


    // -------------------------------------------------
    // Delete physical encrypted file
    // -------------------------------------------------

    try {

        await fs.unlink(
            file.storage_path
        );

    } catch (error) {

        if (
            error.code !==
            "ENOENT"
        ) {

            throw error;
        }
    }


    // -------------------------------------------------
    // Delete database record
    // -------------------------------------------------

    await pool.execute(

        `
        DELETE FROM vault_files
        WHERE file_id = ?
        AND user_id = ?
        `,

        [
            fileId,
            userId
        ]

    );


    return true;
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    saveEncryptedFile,

    getUserFiles,

    getUserFile,

    readDecryptedFile,

    deleteUserFile

};