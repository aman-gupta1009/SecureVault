require("dotenv").config();

const {
    rotateAllFileKeys
} = require("../services/keyRotationService");


// =====================================================
// MASTER KEY ROTATION SCRIPT
// =====================================================
//
// Usage:
//
// node scripts/rotateMasterKey.js 2
//
// IMPORTANT:
// - Stop the API server before running.
// - Do NOT delete the old master key.
// - Do NOT change active version until rotation succeeds.
//
// =====================================================

async function main() {

    const targetVersion =
        Number(
            process.argv[2]
        );


    if (
        !Number.isInteger(targetVersion) ||
        targetVersion < 1
    ) {

        console.error(
            "Usage: node scripts/rotateMasterKey.js <targetVersion>"
        );

        process.exit(1);
    }


    const activeVersion =
        Number(
            process.env.VAULT_ACTIVE_KEY_VERSION || 1
        );


    console.log("");
    console.log(
        "=============================================="
    );

    console.log(
        " SecureVault Master Key Rotation"
    );

    console.log(
        "=============================================="
    );

    console.log(
        `Active key version : V${activeVersion}`
    );

    console.log(
        `Target key version : V${targetVersion}`
    );

    console.log("");


    

    if (
        targetVersion <
        activeVersion
    ) {

        console.error(
            "ERROR: Downgrading master-key version is not allowed."
        );

        process.exit(1);
    }


    try {

        console.log(
            "Checking target master key..."
        );


        const result =
            await rotateAllFileKeys(
                targetVersion
            );


        console.log("");
        console.log(
            "=============================================="
        );

        console.log(
            " Rotation completed successfully"
        );

        console.log(
            "=============================================="
        );

        console.log(
            `Total files : ${result.totalFiles}`
        );

        console.log(
            `Rotated     : ${result.rotated}`
        );

        console.log(
            `Skipped     : ${result.skipped}`
        );

        console.log(
            `New version : V${result.targetKeyVersion}`
        );

        console.log("");


        console.log(
            "IMPORTANT:"
        );

        console.log(
            "The old master key is still required"
        );

        console.log(
            "until every old file is confirmed migrated."
        );

        console.log("");


        process.exit(0);

    } catch (error) {

        console.error("");
        console.error(
            "=============================================="
        );

        console.error(
            " Rotation FAILED"
        );

        console.error(
            "=============================================="
        );

        console.error(
            error.message
        );

        console.error("");


        process.exit(1);
    }
}


main();