
const { pool } = require("../config/database");

const {
    rewrapFileKey,
    getMasterKey
} = require("./encryptionService");

const {
    logSecurityEvent
} = require("./securityEventService");

async function rotateAllFileKeys(newKeyVersion) {
    const targetVersion = Number(newKeyVersion);

    if (
        !Number.isSafeInteger(targetVersion) ||
        targetVersion < 1
    ) {
        throw new Error("INVALID_TARGET_KEY_VERSION");
    }

    // Confirm that the target master key exists.
    // Always clear the temporary key buffer.
    const targetMasterKey = getMasterKey(targetVersion);

    try {
        // getMasterKey validates that the configured key exists.
    } finally {
        targetMasterKey.fill(0);
    }

    const [files] = await pool.execute(`
        SELECT
            file_id,
            user_id,
            key_version,
            encrypted_dek
        FROM vault_files
        ORDER BY file_id ASC
    `);

    let rotatedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
        const currentVersion = Number(file.key_version);

        if (
            !Number.isSafeInteger(currentVersion) ||
            currentVersion < 1
        ) {
            throw new Error(
                `INVALID_CURRENT_KEY_VERSION_FILE_${file.file_id}`
            );
        }

        if (currentVersion === targetVersion) {
            skippedCount++;
            continue;
        }

        let encryptedKey;
        let rotatedDEK;

        try {
            const encryptedDEK =
                typeof file.encrypted_dek === "string"
                    ? JSON.parse(file.encrypted_dek)
                    : file.encrypted_dek;

            if (
                !encryptedDEK ||
                typeof encryptedDEK.encrypted !== "string" ||
                typeof encryptedDEK.iv !== "string" ||
                typeof encryptedDEK.authTag !== "string"
            ) {
                throw new Error("INVALID_ENCRYPTED_DEK");
            }

            encryptedKey = Buffer.from(
                encryptedDEK.encrypted,
                "base64"
            );

            // Reject malformed or non-canonical Base64.
            if (
                encryptedKey.length !== 32 ||
                encryptedKey.toString("base64") !==
                    encryptedDEK.encrypted
            ) {
                throw new Error("INVALID_ENCRYPTED_DEK");
            }

            rotatedDEK = rewrapFileKey(
                encryptedKey,
                encryptedDEK.iv,
                encryptedDEK.authTag,
                currentVersion,
                targetVersion
            );

            const newEncryptedDEK = JSON.stringify({
                encrypted: rotatedDEK.encrypted.toString("base64"),
                iv: rotatedDEK.iv,
                authTag: rotatedDEK.authTag
            });

            const [result] = await pool.execute(
                `
                UPDATE vault_files
                SET
                    encrypted_dek = ?,
                    key_version = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE file_id = ?
                  AND key_version = ?
                `,
                [
                    newEncryptedDEK,
                    targetVersion,
                    file.file_id,
                    currentVersion
                ]
            );

            if (result.affectedRows !== 1) {
                throw new Error(
                    `KEY_ROTATION_CONFLICT_FILE_${file.file_id}`
                );
            }

            rotatedCount++;

            try {
                await logSecurityEvent({
                    userId: file.user_id,
                    eventType: "KEY_ROTATION",
                    req: null,
                    metadata: {
                        fileId: file.file_id,
                        oldKeyVersion: currentVersion,
                        newKeyVersion: targetVersion,
                        method: "DEK_REWRAP"
                    }
                });
            } catch (auditError) {
                // Rotation has already succeeded in the DB.
                // Do not misreport it as a failed rotation.
                console.error(
                    `KEY_ROTATION_AUDIT_FAILED file=${file.file_id}:`,
                    auditError.message
                );
            }
        } catch (error) {
            // Stop on the first error. Files already rotated
            // remain at the target version; a later run skips them.
            throw error;
        } finally {
            if (Buffer.isBuffer(encryptedKey)) {
                encryptedKey.fill(0);
            }

            if (
                rotatedDEK &&
                Buffer.isBuffer(rotatedDEK.encrypted)
            ) {
                rotatedDEK.encrypted.fill(0);
            }
        }
    }

    return {
        totalFiles: files.length,
        rotated: rotatedCount,
        skipped: skippedCount,
        targetKeyVersion: targetVersion
    };
}

module.exports = {
    rotateAllFileKeys
};
