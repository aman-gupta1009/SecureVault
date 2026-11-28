
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { constants } = require("fs");
const { pool } = require("../config/database");

const ENCRYPTED_STORAGE_DIR = path.resolve(
    __dirname, "..", "storage", "encrypted"
);

const BACKUP_ROOT_DIR = path.resolve(
    __dirname, "..", "storage", "backups"
);

const MANIFEST_FILE = "manifest.json";

function sha256(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
}

function getBackupHmacKey() {
    const key = process.env.BACKUP_MANIFEST_HMAC_KEY;

    if (typeof key !== "string" || !/^[a-f0-9]{64}$/i.test(key)) {
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
    return sha256(
        Buffer.from(JSON.stringify(manifest), "utf8")
    );
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
        const error = new Error(
            "Backup directory is outside storage."
        );
        error.code = "BACKUP_INVALID_PATH";
        throw error;
    }

    const manifestPath = path.join(
        realBackupPath,
        MANIFEST_FILE
    );

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
        const error = new Error(
            "Unsupported or invalid backup manifest."
        );
        error.code = "BACKUP_MANIFEST_INVALID";
        throw error;
    }

    const storedHmac = manifest.hmac;
    const manifestWithoutHmac = { ...manifest };
    delete manifestWithoutHmac.hmac;

    if (!verifyManifestHmac(manifestWithoutHmac, storedHmac)) {
        const error = new Error(
            "Backup manifest authentication failed."
        );
        error.code = "BACKUP_INTEGRITY_FAILED";
        throw error;
    }

    const manifestHash = calculateManifestHash(manifest);

    if (!safeHashEquals(backup.backup_hash, manifestHash)) {
        const error = new Error(
            "Backup manifest integrity check failed."
        );
        error.code = "BACKUP_INTEGRITY_FAILED";
        throw error;
    }

    if (Number(backup.file_count) !== manifest.files.length) {
        const error = new Error(
            "Backup file count does not match manifest."
        );
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
            typeof entry.encryptedSha256 !== "string" ||
            !/^[a-f0-9]{64}$/i.test(entry.encryptedSha256)
        ) {
            const error = new Error(
                "Invalid file entry in manifest."
            );
            error.code = "BACKUP_MANIFEST_INVALID";
            throw error;
        }

        const filePath = path.resolve(
            realBackupPath,
            entry.backupFileName
        );

        if (!isInsideDirectory(realBackupPath, filePath)) {
            const error = new Error(
                "Invalid file path in manifest."
            );
            error.code = "BACKUP_INVALID_PATH";
            throw error;
        }

        const realFilePath = await fs.realpath(filePath);

        if (!isInsideDirectory(realBackupPath, realFilePath)) {
            const error = new Error(
                "Backup file is outside its directory."
            );
            error.code = "BACKUP_INVALID_PATH";
            throw error;
        }

        const stat = await fs.stat(realFilePath);

        if (!stat.isFile() || stat.size !== entry.encryptedSize) {
            const error = new Error(
                "Backup file size verification failed."
            );
            error.code = "BACKUP_INTEGRITY_FAILED";
            throw error;
        }

        const encryptedData = await fs.readFile(realFilePath);

        if (
            !safeHashEquals(
                entry.encryptedSha256,
                sha256(encryptedData)
            )
        ) {
            const error = new Error(
                "Encrypted file integrity check failed."
            );
            error.code = "BACKUP_INTEGRITY_FAILED";
            throw error;
        }

        calculatedTotalSize += stat.size;
    }

    if (calculatedTotalSize !== Number(backup.total_size)) {
        const error = new Error(
            "Backup total size does not match manifest."
        );
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

    // Validate configuration before creating backup files.
    getBackupHmacKey();

    await fs.mkdir(backupPath, { recursive: false });

    try {
        const realBackupRoot = await fs.realpath(BACKUP_ROOT_DIR);
        const realBackupPath = await fs.realpath(backupPath);

        if (
            !isInsideDirectory(realBackupRoot, realBackupPath) ||
            path.basename(realBackupPath) !== backupName
        ) {
            const error = new Error(
                "Backup directory failed path validation."
            );
            error.code = "BACKUP_INVALID_PATH";
            throw error;
        }

        const realEncryptedRoot = await fs.realpath(
            ENCRYPTED_STORAGE_DIR
        );

        const manifest = {
            version: 2,
            createdAt: new Date().toISOString(),
            files: []
        };

        let totalSize = 0;

        for (const file of vaultFiles) {
            if (!validateVaultFileName(file.stored_name)) {
                const error = new Error(
                    `Invalid stored file name for vault file ${file.file_id}.`
                );
                error.code = "VAULT_FILE_INVALID";
                throw error;
            }

            const sourcePath = path.resolve(file.storage_path);

            if (!isInsideDirectory(realEncryptedRoot, sourcePath)) {
                const error = new Error(
                    `Vault file path is outside encrypted storage: ${file.stored_name}`
                );
                error.code = "VAULT_FILE_INVALID_PATH";
                throw error;
            }

            const realSourcePath = await fs.realpath(sourcePath);

            if (
                !isInsideDirectory(realEncryptedRoot, realSourcePath) ||
                path.basename(realSourcePath) !== file.stored_name
            ) {
                const error = new Error(
                    `Unsafe vault file path: ${file.stored_name}`
                );
                error.code = "VAULT_FILE_INVALID_PATH";
                throw error;
            }

            const sourceStat = await fs.stat(realSourcePath);

            if (!sourceStat.isFile()) {
                const error = new Error(
                    `Vault storage entry is not a regular file: ${file.stored_name}`
                );
                error.code = "VAULT_FILE_INVALID";
                throw error;
            }

            const encryptedData = await fs.readFile(realSourcePath);
            const encryptedSha256 = sha256(encryptedData);

            const destinationPath = path.join(
                realBackupPath,
                file.stored_name
            );

            await fs.copyFile(
                realSourcePath,
                destinationPath,
                constants.COPYFILE_EXCL
            );

            const copiedData = await fs.readFile(destinationPath);

            if (
                copiedData.length !== encryptedData.length ||
                !safeHashEquals(
                    encryptedSha256,
                    sha256(copiedData)
                )
            ) {
                const error = new Error(
                    `Backup copy verification failed: ${file.stored_name}`
                );
                error.code = "BACKUP_INTEGRITY_FAILED";
                throw error;
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

            encryptedData.fill(0);
            copiedData.fill(0);
        }

        const manifestHmac = calculateManifestHmac(manifest);
        manifest.hmac = manifestHmac;

        await fs.writeFile(
            path.join(realBackupPath, MANIFEST_FILE),
            JSON.stringify(manifest, null, 2),
            {
                flag: "wx",
                encoding: "utf8"
            }
        );

        const backupHash = calculateManifestHash(manifest);

        // Validate the completed backup before registering it in MySQL.
        const temporaryBackupRecord = {
            backup_name: backupName,
            backup_path: realBackupPath,
            backup_hash: backupHash,
            file_count: manifest.files.length,
            total_size: totalSize
        };

        await readAndVerifyBackup(temporaryBackupRecord);

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
                realBackupPath,
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
        try {
            await fs.rm(backupPath, {
                recursive: true,
                force: false
            });
        } catch (cleanupError) {
            console.error(
                "BACKUP CREATION CLEANUP ERROR:",
                {
                    backupName,
                    backupPath,
                    originalError: error.message,
                    cleanupError: cleanupError.message
                }
            );

            error.cleanupRequired = true;
            error.backupName = backupName;
            error.message =
                `${error.message} ` +
                `Cleanup also failed; inspect backup directory ${backupName}.`;
        }

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
        SELECT
            backup_id,
            user_id,
            backup_name,
            backup_path,
            file_count,
            total_size,
            backup_hash,
            status
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
        SELECT
            backup_id,
            user_id,
            backup_name,
            backup_path,
            file_count,
            total_size,
            backup_hash,
            status
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

    let commitAttempted = false;
    let rollbackSucceeded = false;

    let restoredCount = 0;
    let skippedCount = 0;

    try {
        await connection.beginTransaction();

        // Serialize restores of the same backup.
        const [lockedBackups] = await connection.execute(
            `
            SELECT backup_id
            FROM backups
            WHERE backup_id = ? AND user_id = ?
              AND status = 'COMPLETED'
            FOR UPDATE
            `,
            [backupId, userId]
        );

        if (lockedBackups.length === 0) {
            const error = new Error("Backup is no longer available.");
            error.code = "BACKUP_NOT_FOUND";
            throw error;
        }

        const realEncryptedRoot = await fs.realpath(
            ENCRYPTED_STORAGE_DIR
        );

        for (const entry of manifest.files) {
            const metadata = entry.metadata;

            if (
                !metadata ||
                typeof metadata.originalFileId !== "string" ||
                !/^[1-9]\d{0,19}$/.test(metadata.originalFileId) ||
                typeof metadata.originalName !== "string" ||
                metadata.originalName.trim().length === 0 ||
                metadata.originalName.length > 255 ||
                !Number.isSafeInteger(metadata.fileSize) ||
                metadata.fileSize < 0 ||
                !Number.isSafeInteger(metadata.keyVersion) ||
                metadata.keyVersion < 1 ||
                typeof metadata.encryptedDek !== "string" ||
                typeof metadata.fileIv !== "string" ||
                typeof metadata.fileAuthTag !== "string" ||
                metadata.encryptionVersion !== "v1" ||
                typeof metadata.fileHash !== "string" ||
                !/^[a-f0-9]{64}$/i.test(metadata.fileHash) ||
                !(
                    metadata.mimeType === null ||
                    typeof metadata.mimeType === "string"
                )
            ) {
                const error = new Error(
                    "Invalid vault metadata in backup manifest."
                );
                error.code = "BACKUP_METADATA_INVALID";
                throw error;
            }

            let encryptedDEK;

            try {
                encryptedDEK = JSON.parse(metadata.encryptedDek);
            } catch {
                const error = new Error(
                    "Invalid encrypted DEK metadata."
                );
                error.code = "BACKUP_METADATA_INVALID";
                throw error;
            }

            function isCanonicalBase64(value, expectedLength) {
                if (
                    typeof value !== "string" ||
                    value.length === 0
                ) {
                    return false;
                }

                const decoded = Buffer.from(value, "base64");

                try {
                    return (
                        decoded.length === expectedLength &&
                        decoded.toString("base64") === value
                    );
                } finally {
                    decoded.fill(0);
                }
            }

            if (
                !encryptedDEK ||
                typeof encryptedDEK.encrypted !== "string" ||
                !isCanonicalBase64(encryptedDEK.encrypted, 32) ||
                !isCanonicalBase64(encryptedDEK.iv, 12) ||
                !isCanonicalBase64(encryptedDEK.authTag, 16)
            ) {
                const error = new Error(
                    "Invalid encrypted DEK metadata."
                );
                error.code = "BACKUP_METADATA_INVALID";
                throw error;
            }

            const encryptedDEKBytes = Buffer.from(
                encryptedDEK.encrypted,
                "base64"
            );

            try {
                if (
                    encryptedDEKBytes.length !== 32 ||
                    encryptedDEKBytes.toString("base64") !==
                        encryptedDEK.encrypted
                ) {
                    const error = new Error(
                        "Invalid encrypted DEK encoding."
                    );
                    error.code = "BACKUP_METADATA_INVALID";
                    throw error;
                }
            } finally {
                encryptedDEKBytes.fill(0);
            }

            const backupFilePath = path.join(
                backupPath,
                entry.backupFileName
            );

            const encryptedData = await fs.readFile(backupFilePath);

            if (
                !safeHashEquals(
                    entry.encryptedSha256,
                    sha256(encryptedData)
                )
            ) {
                const error = new Error(
                    "Encrypted file integrity check failed."
                );
                error.code = "BACKUP_INTEGRITY_FAILED";
                throw error;
            }

            // Check whether this backup item has already been tracked.
            const [trackedItems] = await connection.execute(
                `
                SELECT restored_file_id
                FROM backup_restore_items
                WHERE user_id = ?
                  AND backup_id = ?
                  AND original_file_id = ?
                LIMIT 1
                FOR UPDATE
                `,
                [userId, backupId, metadata.originalFileId]
            );

            if (
                trackedItems.length > 0 &&
                trackedItems[0].restored_file_id !== null
            ) {
                // A foreign key ensures the referenced vault row exists.
                // Do not create another copy.
                skippedCount += 1;
                continue;
            }

            // Find an exact metadata match. This also helps recognize
            // files restored before the tracking table was introduced.
            const [candidates] = await connection.execute(
                `
                SELECT
                    file_id,
                    storage_path
                FROM vault_files
                WHERE user_id = ?
                  AND original_name = ?
                  AND mime_type <=> ?
                  AND file_size = ?
                  AND file_hash = ?
                  AND encryption_version = ?
                  AND key_version = ?
                  AND encrypted_dek = ?
                  AND file_iv = ?
                  AND file_auth_tag = ?
                `,
                [
                    userId,
                    metadata.originalName,
                    metadata.mimeType,
                    metadata.fileSize,
                    metadata.fileHash,
                    metadata.encryptionVersion,
                    metadata.keyVersion,
                    metadata.encryptedDek,
                    metadata.fileIv,
                    metadata.fileAuthTag
                ]
            );

            let matchingFileId = null;

            // Metadata alone is not enough. Confirm the existing stored
            // ciphertext has exactly the same hash as the backup file.
            for (const candidate of candidates) {
                try {
                    const realCandidatePath = await fs.realpath(
                        candidate.storage_path
                    );

                    if (
                        !isInsideDirectory(
                            realEncryptedRoot,
                            realCandidatePath
                        )
                    ) {
                        continue;
                    }

                    const existingEncryptedData = await fs.readFile(
                        realCandidatePath
                    );

                    try {
                        if (
                            safeHashEquals(
                                entry.encryptedSha256,
                                sha256(existingEncryptedData)
                            )
                        ) {
                            matchingFileId = candidate.file_id;
                            break;
                        }
                    } finally {
                        existingEncryptedData.fill(0);
                    }
                } catch (candidateError) {
                    // Missing or unreadable candidates are not treated
                    // as a verified match. A new copy may be restored.
                    if (
                        candidateError.code !== "ENOENT" &&
                        candidateError.code !== "ENOTDIR"
                    ) {
                        console.warn(
                            "Could not verify an existing vault file:",
                            candidateError.message
                        );
                    }
                }
            }

            if (matchingFileId !== null) {
                // Link the existing exact file to this backup item.
                if (trackedItems.length > 0) {
                    await connection.execute(
                        `
                        UPDATE backup_restore_items
                        SET restored_file_id = ?
                        WHERE user_id = ?
                          AND backup_id = ?
                          AND original_file_id = ?
                        `,
                        [
                            matchingFileId,
                            userId,
                            backupId,
                            metadata.originalFileId
                        ]
                    );
                } else {
                    await connection.execute(
                        `
                        INSERT INTO backup_restore_items
                        (
                            user_id,
                            backup_id,
                            original_file_id,
                            restored_file_id
                        )
                        VALUES (?, ?, ?, ?)
                        `,
                        [
                            userId,
                            backupId,
                            metadata.originalFileId,
                            matchingFileId
                        ]
                    );
                }

                skippedCount += 1;
                continue;
            }

            // No exact existing copy was found; create a new vault file.
            const storedName = `${crypto.randomUUID()}.vault`;
            const destinationPath = path.join(
                realEncryptedRoot,
                storedName
            );

            if (
                !isInsideDirectory(
                    realEncryptedRoot,
                    destinationPath
                )
            ) {
                throw new Error("Unsafe restore destination.");
            }

            await fs.writeFile(
                destinationPath,
                encryptedData,
                { flag: "wx" }
            );

            createdPaths.push(destinationPath);

            const [insertResult] = await connection.execute(
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
                    metadata.mimeType,
                    metadata.fileSize,
                    metadata.fileHash,
                    metadata.encryptionVersion,
                    metadata.keyVersion,
                    metadata.encryptedDek,
                    metadata.fileIv,
                    metadata.fileAuthTag,
                    destinationPath
                ]
            );

            const restoredFileId = insertResult.insertId;

            if (trackedItems.length > 0) {
                await connection.execute(
                    `
                    UPDATE backup_restore_items
                    SET restored_file_id = ?
                    WHERE user_id = ?
                      AND backup_id = ?
                      AND original_file_id = ?
                    `,
                    [
                        restoredFileId,
                        userId,
                        backupId,
                        metadata.originalFileId
                    ]
                );
            } else {
                await connection.execute(
                    `
                    INSERT INTO backup_restore_items
                    (
                        user_id,
                        backup_id,
                        original_file_id,
                        restored_file_id
                    )
                    VALUES (?, ?, ?, ?)
                    `,
                    [
                        userId,
                        backupId,
                        metadata.originalFileId,
                        restoredFileId
                    ]
                );
            }

            restoredCount += 1;
        }

        commitAttempted = true;
        await connection.commit();

        return {
            backupId,
            restoredCount,
            skippedCount,
            integrity: "VERIFIED",
            message:
                restoredCount === 0
                    ? "No new files restored; matching files were already present."
                    : "Backup restored successfully."
        };

    } catch (error) {


    // If commit was attempted, the database outcome may be uncertain.
    // Preserve created files to avoid breaking successfully committed records.
    if (!commitAttempted) {
        try {
            await connection.rollback();
            rollbackSucceeded = true;
        } catch (rollbackError) {
            console.error(
                "RESTORE ROLLBACK ERROR:",
                rollbackError
            );
        }
    }

    // Delete newly created files only after a confirmed rollback.
    if (!commitAttempted && rollbackSucceeded) {
        for (const filePath of createdPaths) {
            try {
                await fs.rm(filePath, { force: true });
            } catch (cleanupError) {
                console.error(
                    "RESTORE FILE CLEANUP ERROR:",
                    cleanupError
                );
                error.cleanupRequired = true;
            }
        }
    } else {
        error.code = "BACKUP_RESTORE_RECOVERY_REQUIRED";

        console.error(
            "RESTORE RECOVERY REQUIRED: encrypted files were preserved because the transaction outcome is uncertain.",
            {
                backupId,
                createdPaths,
                originalError: error.message
            }
        );
    }

    throw error;
}
        finally {
        connection.release();
    }
}



async function deleteBackup(userId, backupId) {
    const connection = await pool.getConnection();

    let backupPath = null;
    let quarantinePath = null;
    let transactionStarted = false;
    let directoryQuarantined = false;
    let transactionCommitted = false;

    try {
        await connection.beginTransaction();
        transactionStarted = true;

        // Lock the backup row to prevent concurrent deletion.
        const [rows] = await connection.execute(
            `
            SELECT
                backup_id,
                backup_name,
                backup_path,
                status
            FROM backups
            WHERE backup_id = ?
              AND user_id = ?
            LIMIT 1
            FOR UPDATE
            `,
            [backupId, userId]
        );

        if (rows.length === 0 || rows[0].status !== "COMPLETED") {
            const error = new Error("Backup not found.");
            error.code = "BACKUP_NOT_FOUND";
            throw error;
        }

        const backup = rows[0];
        backupPath = path.resolve(backup.backup_path);

        // Validate the configured backup directory and backup name.
        if (
            !isInsideDirectory(BACKUP_ROOT_DIR, backupPath) ||
            path.basename(backupPath) !== backup.backup_name ||
            !/^backup-[a-f0-9]{32}$/i.test(backup.backup_name)
        ) {
            const error = new Error("Invalid backup directory.");
            error.code = "BACKUP_INVALID_PATH";
            throw error;
        }

        const realBackupRoot = await fs.realpath(BACKUP_ROOT_DIR);
        const realBackupPath = await fs.realpath(backupPath);

        if (
            !isInsideDirectory(realBackupRoot, realBackupPath) ||
            path.basename(realBackupPath) !== backup.backup_name
        ) {
            const error = new Error(
                "Backup directory is outside storage."
            );
            error.code = "BACKUP_INVALID_PATH";
            throw error;
        }

        const stat = await fs.stat(realBackupPath);

        if (!stat.isDirectory()) {
            const error = new Error(
                "Backup path is not a directory."
            );
            error.code = "BACKUP_INVALID_PATH";
            throw error;
        }

        // Move the directory to a temporary location first.
        // This allows recovery if the database update fails.
        quarantinePath = path.join(
            realBackupRoot,
            `.deleting-${backup.backup_id}-${crypto.randomBytes(12).toString("hex")}`
        );

        await fs.rename(realBackupPath, quarantinePath);
        directoryQuarantined = true;

        const [result] = await connection.execute(
            `
            UPDATE backups
            SET status = 'DELETED',
                updated_at = CURRENT_TIMESTAMP
            WHERE backup_id = ?
              AND user_id = ?
              AND status = 'COMPLETED'
            `,
            [backupId, userId]
        );

        if (result.affectedRows !== 1) {
            const error = new Error(
                "Backup status could not be updated."
            );
            error.code = "BACKUP_STATUS_UPDATE_FAILED";
            throw error;
        }

        await connection.commit();
        transactionCommitted = true;
        transactionStarted = false;
    } catch (error) {
        if (transactionStarted) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "BACKUP DELETE DATABASE ROLLBACK ERROR:",
                    rollbackError
                );
            }
        }

        // Restore the original directory if the DB transaction
        // did not commit.
        if (directoryQuarantined && !transactionCommitted) {
            try {
                await fs.rename(quarantinePath, backupPath);
                directoryQuarantined = false;
            } catch (recoveryError) {
                console.error(
                    "BACKUP DELETE FILE RECOVERY ERROR:",
                    recoveryError
                );

                error.code = "BACKUP_DELETE_RECOVERY_REQUIRED";
                error.message =
                    "Backup deletion could not be completed safely. " +
                    "The temporary backup directory may require recovery.";
            }
        }

        throw error;
    } finally {
        connection.release();
    }

    // The database now marks the backup as DELETED.
    // Cleanup failure must not make the operation appear uncommitted.
    if (directoryQuarantined && transactionCommitted) {
        try {
            await fs.rm(quarantinePath, {
                recursive: true,
                force: false
            });
        } catch (cleanupError) {
            console.error(
                "BACKUP DELETE CLEANUP ERROR:",
                cleanupError
            );

            const error = new Error(
                "Backup is marked DELETED, but temporary directory " +
                "cleanup failed. Manual storage cleanup may be required."
            );
            error.code = "BACKUP_FILES_CLEANUP_FAILED";
            throw error;
        }
    }

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
