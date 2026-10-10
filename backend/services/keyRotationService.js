const { pool } = require("../config/database");

const {
    rewrapFileKey,
    getMasterKey
} = require("./encryptionService");

const {
    logSecurityEvent
} = require("./securityEventService");


// =====================================================
// ROTATE ALL FILE DEKs
// =====================================================
//
// IMPORTANT:
//
// This function does NOT re-encrypt file contents.
//
// It only changes:
//
//     encrypted DEK V1
//             ↓
//     encrypted DEK V2
//
// The actual .vault file remains untouched.
//
// =====================================================

async function rotateAllFileKeys(
    newKeyVersion
) {

    const targetVersion =
        Number(newKeyVersion);


    if (
        !Number.isInteger(targetVersion) ||
        targetVersion < 1
    ) {

        throw new Error(
            "INVALID_TARGET_KEY_VERSION"
        );
    }


    // -------------------------------------------------
    // Confirm target master key exists
    // -------------------------------------------------

    getMasterKey(
        targetVersion
    );


    // -------------------------------------------------
    // Read all files
    // -------------------------------------------------

    const [
        files
    ] = await pool.execute(

        `
        SELECT
            file_id,
            user_id,
            key_version,
            encrypted_dek
        FROM vault_files
        ORDER BY file_id ASC
        `
    );


    let rotatedCount = 0;

    let skippedCount = 0;


    // -------------------------------------------------
    // Process each file
    // -------------------------------------------------

    for (const file of files) {

        const currentVersion =
            Number(
                file.key_version
            );


        // ---------------------------------------------
        // Already using target version
        // ---------------------------------------------

        if (
            currentVersion ===
            targetVersion
        ) {

            skippedCount++;

            continue;
        }


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
                `INVALID_ENCRYPTED_DEK_FILE_${file.file_id}`
            );
        }


        const encryptedKey =
            Buffer.from(
                encryptedDEK.encrypted,
                "base64"
            );


        // ---------------------------------------------
        // Re-wrap DEK
        // ---------------------------------------------

        const rotatedDEK =
            rewrapFileKey(

                encryptedKey,

                encryptedDEK.iv,

                encryptedDEK.authTag,

                currentVersion,

                targetVersion

            );


        const newEncryptedDEK =
            JSON.stringify({

                encrypted:
                    rotatedDEK.encrypted.toString(
                        "base64"
                    ),

                iv:
                    rotatedDEK.iv,

                authTag:
                    rotatedDEK.authTag

            });


        // ---------------------------------------------
        // Update DB
        //
        // The WHERE condition prevents accidentally
        // changing a file that was modified by another
        // process between read and update.
        // ---------------------------------------------

        const [
            result
        ] = await pool.execute(

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


        if (
            result.affectedRows !==
            1
        ) {

            throw new Error(
                `KEY_ROTATION_CONFLICT_FILE_${file.file_id}`
            );
        }


        rotatedCount++;


        // ---------------------------------------------
        // Security audit
        // ---------------------------------------------

        try {

            await logSecurityEvent({

                userId:
                    file.user_id,

                eventType:
                    "KEY_ROTATION",

                req:
                    null,

                metadata: {

                    fileId:
                        file.file_id,

                    oldKeyVersion:
                        currentVersion,

                    newKeyVersion:
                        targetVersion,

                    method:
                        "DEK_REWRAP"

                }

            });

        } catch (auditError) {

            console.error(
                `KEY_ROTATION_AUDIT_FAILED file=${file.file_id}:`,
                auditError.message
            );
        }
    }


    return {

        totalFiles:
            files.length,

        rotated:
            rotatedCount,

        skipped:
            skippedCount,

        targetKeyVersion:
            targetVersion

    };
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    rotateAllFileKeys

};