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

const ENCRYPTED_STORAGE_PATH = path.resolve(
    __dirname,
    "..",
    "storage",
    "encrypted"
);

const STORED_NAME_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.vault$/i;

async function ensureStorageDirectory() {
    await fs.mkdir(ENCRYPTED_STORAGE_PATH, {
        recursive: true
    });
}

function calculateFileHash(buffer) {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error("INVALID_FILE_BUFFER");
    }

    return crypto
        .createHash("sha256")
        .update(buffer)
        .digest("hex");
}

/**
 * Resolve only the expected file inside encrypted storage.
 * Reject database paths that point anywhere else.
 */
async function resolveStoredFilePath(file, options = {}) {
    const { allowMissing = false } = options;

    if (
        !file ||
        typeof file.stored_name !== "string" ||
        !STORED_NAME_PATTERN.test(file.stored_name) ||
        typeof file.storage_path !== "string"
    ) {
        throw new Error("INVALID_STORAGE_PATH");
    }

    const rootPath = await fs.realpath(ENCRYPTED_STORAGE_PATH);
    const expectedPath = path.resolve(rootPath, file.stored_name);
    const databasePath = path.resolve(file.storage_path);

    // The database path must exactly match the expected stored filename.
    if (
        path.relative(rootPath, expectedPath).startsWith("..") ||
        path.isAbsolute(path.relative(rootPath, expectedPath)) ||
        databasePath !== expectedPath
    ) {
        throw new Error("INVALID_STORAGE_PATH");
    }

    let actualPath;

    try {
        actualPath = await fs.realpath(expectedPath);
    } catch (error) {
        if (allowMissing && error.code === "ENOENT") {
            return expectedPath;
        }

        if (error.code === "ENOENT") {
            throw new Error("STORED_FILE_MISSING");
        }

        throw error;
    }

    const relativeActualPath = path.relative(rootPath, actualPath);

    if (
        relativeActualPath === "" ||
        relativeActualPath.startsWith("..") ||
        path.isAbsolute(relativeActualPath)
    ) {
        throw new Error("INVALID_STORAGE_PATH");
    }

    const stat = await fs.stat(actualPath);

    if (!stat.isFile()) {
        throw new Error("INVALID_STORAGE_PATH");
    }

    return actualPath;
}

async function saveEncryptedFile(userId, file) {
    if (
        !file ||
        !Buffer.isBuffer(file.buffer) ||
        typeof file.originalname !== "string"
    ) {
        throw new Error("FILE_DATA_REQUIRED");
    }

    await ensureStorageDirectory();

    const fileHash = calculateFileHash(file.buffer);
    const storedName = `${crypto.randomUUID()}.vault`;
    const storagePath = path.join(
        ENCRYPTED_STORAGE_PATH,
        storedName
    );

    const keyVersion = getActiveKeyVersion();
    const fileKey = generateFileKey();

    let encryptedFileWritten = false;

    try {
        const encryptedFile = encryptData(
            file.buffer,
            fileKey
        );

        const encryptedDEK = encryptFileKey(
            fileKey,
            keyVersion
        );

        await fs.writeFile(
            storagePath,
            encryptedFile.encrypted,
            { flag: "wx", mode: 0o600 }
        );

        encryptedFileWritten = true;

        const encryptedDEKJSON = JSON.stringify({
            encrypted: encryptedDEK.encrypted.toString("base64"),
            iv: encryptedDEK.iv,
            authTag: encryptedDEK.authTag
        });

        const [result] = await pool.execute(
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                encryptedDEKJSON,
                encryptedFile.iv,
                encryptedFile.authTag,
                storagePath
            ]
        );

        return {
            fileId: result.insertId,
            originalName: file.originalname,
            storedName,
            mimeType: file.mimetype || null,
            fileSize: file.size,
            keyVersion,
            fileHash
        };
    } catch (error) {
        if (encryptedFileWritten) {
            try {
                await fs.unlink(storagePath);
            } catch (cleanupError) {
                console.error(
                    "Encrypted-file cleanup failed:",
                    cleanupError.message
                );
            }
        }

        throw error;
    } finally {
        fileKey.fill(0);
    }
}

async function getUserFiles(userId) {
    const [rows] = await pool.execute(
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

async function getUserFile(userId, fileId) {
    const [rows] = await pool.execute(
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
        [fileId, userId]
    );

    return rows.length ? rows[0] : null;
}

async function readDecryptedFile(userId, fileId) {
    const file = await getUserFile(userId, fileId);

    if (!file) {
        throw new Error("FILE_NOT_FOUND");
    }

    const safePath = await resolveStoredFilePath(file);
    const encryptedFile = await fs.readFile(safePath);

    let encryptedDEK;

    try {
        encryptedDEK =
            typeof file.encrypted_dek === "string"
                ? JSON.parse(file.encrypted_dek)
                : file.encrypted_dek;
    } catch {
        throw new Error("INVALID_ENCRYPTED_FILE_KEY");
    }

    if (
        !encryptedDEK ||
        typeof encryptedDEK.encrypted !== "string" ||
        typeof encryptedDEK.iv !== "string" ||
        typeof encryptedDEK.authTag !== "string"
    ) {
        throw new Error("INVALID_ENCRYPTED_FILE_KEY");
    }

        if (
        !encryptedDEK ||
        typeof encryptedDEK.encrypted !== "string" ||
        typeof encryptedDEK.iv !== "string" ||
        typeof encryptedDEK.authTag !== "string"
    ) {
        throw new Error("INVALID_ENCRYPTED_FILE_KEY");
    }

    // Validate canonical Base64 before decoding the encrypted DEK.
    const encryptedValue = encryptedDEK.encrypted;

    if (
        encryptedValue.length === 0 ||
        encryptedValue.length % 4 !== 0 ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            encryptedValue
        )
    ) {
        throw new Error("INVALID_ENCRYPTED_FILE_KEY");
    }

    const encryptedKey = Buffer.from(
        encryptedValue,
        "base64"
    );

    if (
        encryptedKey.length !== 32 ||
        encryptedKey.toString("base64") !== encryptedValue
    ) {
        encryptedKey.fill(0);
        throw new Error("INVALID_ENCRYPTED_FILE_KEY");
    }

    let fileKey;

    try {
        fileKey = decryptFileKey(
            encryptedKey,
            encryptedDEK.iv,
            encryptedDEK.authTag,
            file.key_version
        );

        const decryptedFile = decryptData(
            encryptedFile,
            fileKey,
            file.file_iv,
            file.file_auth_tag
        );

        if (file.file_hash) {
            const calculatedHash = calculateFileHash(decryptedFile);
            const storedHash = String(file.file_hash).toLowerCase();

            if (!/^[a-f0-9]{64}$/.test(storedHash)) {
                throw new Error("FILE_INTEGRITY_CHECK_FAILED");
            }

            const calculatedBuffer = Buffer.from(calculatedHash, "hex");
            const storedBuffer = Buffer.from(storedHash, "hex");

            if (!crypto.timingSafeEqual(calculatedBuffer, storedBuffer)) {
                throw new Error("FILE_INTEGRITY_CHECK_FAILED");
            }
        }

        return {
            file,
            data: decryptedFile
        };
    } finally {
        if (fileKey) {
            fileKey.fill(0);
        }

        encryptedKey.fill(0);
    }
}

async function deleteUserFile(userId, fileId) {
    const file = await getUserFile(userId, fileId);

    if (!file) {
        throw new Error("FILE_NOT_FOUND");
    }

    // Validate the path before modifying either storage or the database.
    const safePath = await resolveStoredFilePath(file, {
        allowMissing: true
    });

    // Remove the metadata first. This also lets database foreign-key
    // rules handle related records consistently.
    const [result] = await pool.execute(
        `
        DELETE FROM vault_files
        WHERE file_id = ?
          AND user_id = ?
        `,
        [fileId, userId]
    );

    if (result.affectedRows === 0) {
        throw new Error("FILE_NOT_FOUND");
    }

    // A failed unlink leaves an orphaned encrypted file, not a database
    // record that points to a file that has already been removed.
    try {
        await fs.unlink(safePath);
    } catch (error) {
        if (error.code !== "ENOENT") {
            console.error(
                "Encrypted-file deletion failed:",
                error.message
            );

            throw new Error("ENCRYPTED_FILE_CLEANUP_FAILED");
        }
    }

    return true;
}

module.exports = {
    saveEncryptedFile,
    getUserFiles,
    getUserFile,
    readDecryptedFile,
    deleteUserFile
};