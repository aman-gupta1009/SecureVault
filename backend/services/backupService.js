
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { pool } = require("../config/database");

const ENCRYPTED_STORAGE_DIR = path.resolve(
    __dirname,
    "..",
    "storage",
    "encrypted"
);

const BACKUP_ROOT_DIR = path.resolve(
    __dirname,
    "..",
    "storage",
    "backups"
);

const MANIFEST_FILE = "manifest.json";

function sha256(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
}

function getBackupHmacKey() {
    const key = process.env.BACKUP_MANIFEST_HMAC_KEY;

    if (
        typeof key !== "string" ||
        !/^[a-f0-9]{64}$/i.test(key)
    ) {
        throw new Error(
            "BACKUP_MANIFEST_HMAC_KEY is missing or invalid."
        );
    }

    return Buffer.from(key, "hex");
}

function calculateManifestHmac(manifest) {
    return crypto
        .createHmac("sha256", getBackupHmacKey())
        .update(JSON.stringify(manifest), "utf8")
        .digest("hex");
}

function verifyManifestHmac(manifest, expectedHmac) {
    if (
        typeof expectedHmac !== "string" ||
        !/^[a-f0-9]{64}$/i.test(expectedHmac)
    ) {
        return false;
    }

    const actualHmac = calculateManifestHmac(manifest);

    return crypto.timingSafeEqual(
        Buffer.from(expectedHmac, "hex"),
        Buffer.from(actualHmac, "hex")
    );
}
function safeHashEquals(expected, actual) {
    if (
        typeof expected !== "string" ||
        typeof actual !== "string" ||
        !/^[a-f0-9]{64}$/i.test(expected) ||
        !/^[a-f0-9]{64}$/i.test(actual)
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(actual, "hex")
    );
}

function isInsideDirectory(parent, candidate) {
    const relative = path.relative(parent, candidate);

    return (
        relative !== "" &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative)
    );
}

function validateVaultFileName(name) {
    return (
        typeof name === "string" &&
        name.length > 0 &&
        path.basename(name) === name &&
        name.endsWith(".vault")
    );
}

async function ensureDirectories() {
    await fs.mkdir(ENCRYPTED_STORAGE_DIR, { recursive: true });
    await fs.mkdir(BACKUP_ROOT_DIR, { recursive: true });
}

function calculateManifestHash(manifest) {
    // The manifest hash is calculated from the parsed JSON data,
    // not from its whitespace or indentation.
    return sha256(Buffer.from(JSON.stringify(manifest), "utf8"));
}

async function readAndVerifyBackup(backup) {
    const backupPath = path.resolve(backup.backup_path);

    if (
        !isInsideDirectory(BACKUP_ROOT_DIR, backupPath) ||
        path.basename(backupPath) !== backup.backup_name ||
        !backup.backup_name.startsWith("backup-")
    ) {
        const error = new Error("Invalid backup directory.");
        error.code = "BACKUP_INVALID_PATH";
        throw error;
    }

    const realBackupRoot = await fs.realpath(BACKUP_ROOT_DIR);
    const realBackupPath = await fs.realpath(backupPath);

    if (!isInsideDirectory(realBackupRoot, realBackupPath)) {
        const error = new Error("Backup directory is outside storage.");
        error.code = "BACKUP_INVALID_PATH";
        throw error;
    }

    const manifestPath = path.join(realBackupPath, MANIFEST_FILE);
    const manifestText = await fs.readFile(manifestPath, "utf8");

    let manifest;

    try {
        manifest = JSON.parse(manifestText);
    } catch {
        const error = new Error("Backup manifest is invalid JSON.");
        error.code = "BACKUP_MANIFEST_INVALID";
        throw error;
    }

    if (
        !manifest ||
        manifest.version !== 2 ||
        !Array.isArray(manifest.files)
    ) {
        const error = new Error("Unsupported or invalid backup manifest.");
        error.code = "BACKUP_MANIFEST_INVALID";
        throw error;
    }
    const storedHmac = manifest.hmac;
const manifestWithoutHmac = { ...manifest };

delete manifestWithoutHmac.hmac;

if (!verifyManifestHmac(manifestWithoutHmac, storedHmac)) {
    const error = new Error("Backup manifest authentication failed.");
    error.code = "BACKUP_INTEGRITY_FAILED";
    throw error;
}
    const manifestHash = calculateManifestHash(manifest);
    if (!safeHashEquals(backup.backup_hash, manifestHash)) {
        const error = new Error("Backup manifest integrity check failed.");
        error.code = "BACKUP_INTEGRITY_FAILED";
        throw error;
    }

    if (
        Number(backup.file_count) !== manifest.files.length
    ) {
        const error = new Error("Backup file count does not match manifest.");
        error.code = "BACKUP_INTEGRITY_FAILED";
        throw error;
    }

    let calculatedTotalSize = 0;

    for (const entry of manifest.files) {
        if (
            !entry ||
            !validateVaultFileName(entry.backupFileName) ||
            !Number.isSafeInteger(entry.encryptedSize) ||
            entry.encryptedSize < 0 ||
            !entry.metadata ||
            !safeHashEquals(entry.encryptedSha256, entry.encryptedSha256)
        ) {
            const error = new Error("Invalid file entry in manifest.");
            error.code = "BACKUP_MANIFEST_INVALID";
            throw error;
        }

        const filePath = path.resolve(realBackupPath, entry.backupFileName);

        if (!isInsideDirectory(realBackupPath, filePath)) {
            const error = new Error("Invalid file path in manifest.");
            error.code = "BACKUP_INVALID_PATH";
            throw error;
        }

        const realFilePath = await fs.realpath(filePath);

        if (!isInsideDirectory(realBackupPath, realFilePath)) {
            const error = new Error("Backup file is outside its directory.");
            error.code = "BACKUP_INVALID_PATH";
            throw error;
        }

        const stat = await fs.stat(realFilePath);

        if (!stat.isFile() || stat.size !== entry.encryptedSize) {
            const error = new Error("Backup file size verification failed.");
            error.code = "BACKUP_INTEGRITY_FAILED";
            throw error;
        }

        const encryptedData = await fs.readFile(realFilePath);

        if (!safeHashEquals(entry.encryptedSha256, sha256(encryptedData))) {
            const error = new Error("Encrypted file integrity check failed.");
            error.code = "BACKUP_INTEGRITY_FAILED";
            throw error;
        }

        calculatedTotalSize += stat.size;
    }

    if (calculatedTotalSize !== Number(backup.total_size)) {
        const error = new Error("Backup total size does not match manifest.");
        error.code = "BACKUP_INTEGRITY_FAILED";
        throw error;
    }

    return {
        backupPath: realBackupPath,
        manifest
    };
}

async function createBackup(userId) {
    await ensureDirectories();

    const [vaultFiles] = await pool.execute(
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
            storage_path
        FROM vault_files
        WHERE user_id = ?
        ORDER BY file_id ASC
        `,
        [userId]
    );

    const backupIdToken = crypto.randomBytes(16).toString("hex");
    const backupName = `backup-${backupIdToken}`;
    const backupPath = path.join(BACKUP_ROOT_DIR, backupName);

    await fs.mkdir(backupPath, { recursive: false });

    const manifest = {
        version: 2,
        createdAt: new Date().toISOString(),
        files: []
    };

    let totalSize = 0;

    try {
        const realEncryptedRoot = await fs.realpath(ENCRYPTED_STORAGE_DIR);

        for (const file of vaultFiles) {
            if (!validateVaultFileName(file.stored_name)) {
                throw new Error(
                    `Invalid stored file name for vault file ${file.file_id}.`
                );
            }

            const sourcePath = path.resolve(file.storage_path);

            if (!isInsideDirectory(realEncryptedRoot, sourcePath)) {
                throw new Error(
                    `Vault file path is outside encrypted storage: ${file.stored_name}`
                );
            }

            const realSourcePath = await fs.realpath(sourcePath);

            if (
                !isInsideDirectory(realEncryptedRoot, realSourcePath) ||
                path.basename(realSourcePath) !== file.stored_name
            ) {
                throw new Error(
                    `Unsafe vault file path: ${file.stored_name}`
                );
            }

            const stat = await fs.stat(realSourcePath);

            if (!stat.isFile()) {
                throw new Error(`Vault storage entry is not a file.`);
            }

            const encryptedData = await fs.readFile(realSourcePath);
            const encryptedSha256 = sha256(encryptedData);

            const destinationPath = path.join(
                backupPath,
                file.stored_name
            );

            await fs.copyFile(
                realSourcePath,
                destinationPath,
                require("fs").constants.COPYFILE_EXCL
            );

            // Check the copied bytes too, not just the source.
            const copiedData = await fs.readFile(destinationPath);

            if (!safeHashEquals(encryptedSha256, sha256(copiedData))) {
                throw new Error(
                    `Backup copy verification failed: ${file.stored_name}`
                );
            }

            manifest.files.push({
                backupFileName: file.stored_name,
                encryptedSize: copiedData.length,
                encryptedSha256,
                metadata: {
                    originalFileId: String(file.file_id),
                    originalName: file.original_name,
                    mimeType: file.mime_type,
                    fileSize: Number(file.file_size),
                    fileHash: file.file_hash,
                    encryptionVersion: file.encryption_version,
                    keyVersion: Number(file.key_version),
                    encryptedDek: file.encrypted_dek,
                    fileIv: file.file_iv,
                    fileAuthTag: file.file_auth_tag
                }
            });

            totalSize += copiedData.length;
        }

        const manifestHmac = calculateManifestHmac(manifest);

manifest.hmac = manifestHmac;

const manifestText = JSON.stringify(manifest, null, 2);

await fs.writeFile(
    path.join(backupPath, MANIFEST_FILE),
    manifestText,
    { flag: "wx", encoding: "utf8" }
);

const backupHash = calculateManifestHash(manifest);

        await pool.execute(
            `
            INSERT INTO backups
            (
                user_id,
                backup_name,
                backup_path,
                file_count,
                total_size,
                backup_hash,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED')
            `,
            [
                userId,
                backupName,
                backupPath,
                manifest.files.length,
                totalSize,
                backupHash
            ]
        );

        return {
            backupName,
            fileCount: manifest.files.length,
            totalSize,
            backupHash,
            integrity: "VERIFIED"
        };
    } catch (error) {
        await fs.rm(backupPath, { recursive: true, force: true });
        throw error;
    }
}

async function listBackups(userId) {
    const [rows] = await pool.execute(
        `
        SELECT
            backup_id,
            backup_name,
            file_count,
            total_size,
            backup_hash,
            status,
            created_at,
            updated_at
        FROM backups
        WHERE user_id = ?
        ORDER BY backup_id DESC
        `,
        [userId]
    );

    return rows;
}

async function verifyBackup(userId, backupId) {
    const [rows] = await pool.execute(
        `
        SELECT backup_id, user_id, backup_name, backup_path,
               file_count, total_size, backup_hash, status
        FROM backups
        WHERE backup_id = ? AND user_id = ?
        LIMIT 1
        `,
        [backupId, userId]
    );

    if (rows.length === 0 || rows[0].status !== "COMPLETED") {
        const error = new Error("Backup not found.");
        error.code = "BACKUP_NOT_FOUND";
        throw error;
    }

    await readAndVerifyBackup(rows[0]);

    return {
        backupId: rows[0].backup_id,
        fileCount: Number(rows[0].file_count),
        totalSize: Number(rows[0].total_size),
        integrity: "VERIFIED"
    };
}

async function restoreBackup(userId, backupId) {
    await ensureDirectories();

    const [rows] = await pool.execute(
        `
        SELECT backup_id, user_id, backup_name, backup_path,
               file_count, total_size, backup_hash, status
        FROM backups
        WHERE backup_id = ? AND user_id = ?
        LIMIT 1
        `,
        [backupId, userId]
    );

    if (rows.length === 0 || rows[0].status !== "COMPLETED") {
        const error = new Error("Backup not found.");
        error.code = "BACKUP_NOT_FOUND";
        throw error;
    }

    const backup = rows[0];
    const { backupPath, manifest } = await readAndVerifyBackup(backup);

    const connection = await pool.getConnection();
    const createdPaths = [];
    let restoredCount = 0;

    try {
        await connection.beginTransaction();

        const realEncryptedRoot = await fs.realpath(ENCRYPTED_STORAGE_DIR);

        for (const entry of manifest.files) {
            const metadata = entry.metadata;

            if (
                typeof metadata.originalName !== "string" ||
                metadata.originalName.length === 0 ||
                metadata.originalName.length > 255 ||
                !Number.isSafeInteger(metadata.fileSize) ||
                metadata.fileSize < 0 ||
                !Number.isInteger(metadata.keyVersion) ||
                metadata.keyVersion < 1 ||
                typeof metadata.encryptedDek !== "string" ||
                typeof metadata.fileIv !== "string" ||
                typeof metadata.fileAuthTag !== "string" ||
                typeof metadata.encryptionVersion !== "string"
            ) {
                throw new Error("Invalid vault metadata in backup manifest.");
            }

            const backupFilePath = path.join(
                backupPath,
                entry.backupFileName
            );

            const encryptedData = await fs.readFile(backupFilePath);

            // readAndVerifyBackup already verified this hash.
            if (!safeHashEquals(entry.encryptedSha256, sha256(encryptedData))) {
                const error = new Error("Encrypted file integrity check failed.");
                error.code = "BACKUP_INTEGRITY_FAILED";
                throw error;
            }

            // Generate a new name so restored files never overwrite existing ones.
            const storedName = `${crypto.randomUUID()}.vault`;
            const destinationPath = path.join(
                realEncryptedRoot,
                storedName
            );

            if (!isInsideDirectory(realEncryptedRoot, destinationPath)) {
                throw new Error("Unsafe restore destination.");
            }

            await fs.writeFile(destinationPath, encryptedData, { flag: "wx" });
            createdPaths.push(destinationPath);

            await connection.execute(
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
                    metadata.originalName,
                    storedName,
                    metadata.mimeType || null,
                    metadata.fileSize,
                    metadata.fileHash || null,
                    metadata.encryptionVersion,
                    metadata.keyVersion,
                    metadata.encryptedDek,
                    metadata.fileIv,
                    metadata.fileAuthTag,
                    destinationPath
                ]
            );

            restoredCount += 1;
        }

        await connection.commit();

        return {
            backupId,
            restoredCount,
            integrity: "VERIFIED",
            message: "Backup restored successfully."
        };
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error("RESTORE ROLLBACK ERROR:", rollbackError);
        }

        for (const filePath of createdPaths) {
            try {
                await fs.rm(filePath, { force: true });
            } catch (cleanupError) {
                console.error("RESTORE FILE CLEANUP ERROR:", cleanupError);
            }
        }

        throw error;
    } finally {
        connection.release();
    }
}

async function deleteBackup(userId, backupId) {
    const [rows] = await pool.execute(
        `
        SELECT backup_id, backup_name, backup_path
        FROM backups
        WHERE backup_id = ?
          AND user_id = ?
          AND status = 'COMPLETED'
        LIMIT 1
        `,
        [backupId, userId]
    );

    if (rows.length === 0) {
        const error = new Error("Backup not found.");
        error.code = "BACKUP_NOT_FOUND";
        throw error;
    }

    const backup = rows[0];
    const backupPath = path.resolve(backup.backup_path);

    if (
        !isInsideDirectory(BACKUP_ROOT_DIR, backupPath) ||
        path.basename(backupPath) !== backup.backup_name
    ) {
        const error = new Error("Invalid backup directory.");
        error.code = "BACKUP_INVALID_PATH";
        throw error;
    }

    await fs.rm(backupPath, { recursive: true, force: true });

    await pool.execute(
        `
        UPDATE backups
        SET status = 'DELETED',
            updated_at = CURRENT_TIMESTAMP
        WHERE backup_id = ? AND user_id = ?
        `,
        [backupId, userId]
    );

    return {
        backupId,
        message: "Backup deleted successfully."
    };
}

module.exports = {
    createBackup,
    listBackups,
    verifyBackup,
    restoreBackup,
    deleteBackup
};