require("dotenv").config();

const crypto = require("crypto");

const { pool } = require("../config/database");
const { readDecryptedFile } = require("../services/vaultService");


// ============================================================
// CALCULATE SHA-256 HASH
// ============================================================
function calculateFileHash(buffer) {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error("INVALID_FILE_BUFFER");
    }

    return crypto
        .createHash("sha256")
        .update(buffer)
        .digest("hex");
}


// ============================================================
// BACKFILL FILE HASHES
// ============================================================
async function backfillFileHashes() {
    console.log("==============================================");
    console.log(" SecureVault - File Hash Backfill");
    console.log("==============================================");
    console.log("");


    // --------------------------------------------------------
    // Get all vault files
    // --------------------------------------------------------
    const [files] = await pool.execute(`
        SELECT
            file_id,
            user_id,
            original_name,
            file_hash,
            key_version
        FROM vault_files
        ORDER BY file_id ASC
    `);


    if (files.length === 0) {
        console.log("No vault files found.");
        return;
    }


    console.log(`Total files found : ${files.length}`);
    console.log("");


    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;


    // --------------------------------------------------------
    // Process each file
    // --------------------------------------------------------
    for (const file of files) {

        console.log("----------------------------------------------");
        console.log(`File ID       : ${file.file_id}`);
        console.log(`Original Name : ${file.original_name}`);
        console.log(`Key Version   : V${file.key_version}`);


        try {

            // ------------------------------------------------
            // If hash already exists, don't recalculate it.
            // ------------------------------------------------
            if (file.file_hash) {

                console.log("Status        : HASH ALREADY EXISTS");
                console.log("");

                skipped++;
                processed++;

                continue;
            }


            // ------------------------------------------------
            // Decrypt the file using the existing vault
            // encryption architecture.
            // ------------------------------------------------
            const result = await readDecryptedFile(
                file.user_id,
                file.file_id
            );


            if (!result || !Buffer.isBuffer(result.data)) {
                throw new Error("INVALID_DECRYPTED_FILE_DATA");
            }


            // ------------------------------------------------
            // Calculate SHA-256 of ORIGINAL PLAINTEXT
            // ------------------------------------------------
            const fileHash = calculateFileHash(
                result.data
            );


            // ------------------------------------------------
            // Store hash in database
            // ------------------------------------------------
            const [updateResult] = await pool.execute(`
                UPDATE vault_files
                SET
                    file_hash = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE file_id = ?
                AND user_id = ?
                AND file_hash IS NULL
            `, [
                fileHash,
                file.file_id,
                file.user_id
            ]);


            if (updateResult.affectedRows !== 1) {
                throw new Error(
                    "FILE_HASH_UPDATE_CONFLICT"
                );
            }


            // ------------------------------------------------
            // Clear plaintext buffer from memory
            // ------------------------------------------------
            result.data.fill(0);


            console.log("Status        : HASH CREATED");
            console.log("SHA-256       :", fileHash);
            console.log("");


            updated++;
            processed++;

        } catch (error) {

            console.error(
                `ERROR         : ${error.message}`
            );

            console.log("");

            failed++;
            processed++;
        }
    }


    // ========================================================
    // SUMMARY
    // ========================================================
    console.log("==============================================");
    console.log(" Backfill Completed");
    console.log("==============================================");

    console.log(`Total files    : ${files.length}`);
    console.log(`Processed      : ${processed}`);
    console.log(`Updated        : ${updated}`);
    console.log(`Skipped        : ${skipped}`);
    console.log(`Failed         : ${failed}`);

    console.log("==============================================");
}


// ============================================================
// MAIN
// ============================================================
async function main() {

    try {

        await backfillFileHashes();

        console.log("");
        console.log("Backfill script finished successfully.");

    } catch (error) {

        console.error("");
        console.error(
            "BACKFILL FAILED:",
            error.message
        );

        process.exitCode = 1;

    } finally {

        await pool.end();
    }
}


main();