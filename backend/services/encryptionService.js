const crypto = require("crypto");


// =====================================================
// CONFIGURATION
// =====================================================

const ALGORITHM = "aes-256-gcm";

const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;


// =====================================================
// VALIDATE KEY
// =====================================================

function validateKey(key) {

    if (!Buffer.isBuffer(key)) {

        throw new Error(
            "Encryption key must be a Buffer."
        );
    }


    if (key.length !== KEY_LENGTH) {

        throw new Error(
            "Encryption key must be exactly 32 bytes."
        );
    }
}


// =====================================================
// VALIDATE MASTER KEY HEX
// =====================================================

function validateMasterKeyHex(keyHex) {

    if (!keyHex) {

        throw new Error(
            "Master key is not configured."
        );
    }


    if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {

        throw new Error(
            "Master key must be exactly 64 hexadecimal characters."
        );
    }
}


// =====================================================
// GET ACTIVE KEY VERSION
// =====================================================

function getActiveKeyVersion() {

    const version =
        Number(
            process.env.VAULT_ACTIVE_KEY_VERSION || 1
        );


    if (!Number.isInteger(version) || version < 1) {

        throw new Error(
            "VAULT_ACTIVE_KEY_VERSION must be a positive integer."
        );
    }


    return version;
}


// =====================================================
// GET MASTER KEY BY VERSION
// =====================================================

function getMasterKey(version = getActiveKeyVersion()) {

    const keyVersion =
        Number(version);


    if (
        !Number.isInteger(keyVersion) ||
        keyVersion < 1
    ) {

        throw new Error(
            "Invalid master key version."
        );
    }


    const envName =
        `VAULT_MASTER_KEY_V${keyVersion}`;


    const keyHex =
        process.env[envName];


    validateMasterKeyHex(
        keyHex
    );


    return Buffer.from(
        keyHex,
        "hex"
    );
}


// =====================================================
// GENERATE MASTER KEY
// =====================================================

function generateMasterKey() {

    return crypto
        .randomBytes(KEY_LENGTH)
        .toString("hex");
}


// =====================================================
// ENCRYPT DATA
// =====================================================

function encryptData(
    plaintext,
    key
) {

    validateKey(key);


    if (!Buffer.isBuffer(plaintext)) {

        plaintext =
            Buffer.from(plaintext);
    }


    const iv =
        crypto.randomBytes(
            IV_LENGTH
        );


    const cipher =
        crypto.createCipheriv(
            ALGORITHM,
            key,
            iv
        );


    const encrypted =
        Buffer.concat([
            cipher.update(plaintext),
            cipher.final()
        ]);


    const authTag =
        cipher.getAuthTag();


    if (
        authTag.length !==
        AUTH_TAG_LENGTH
    ) {

        throw new Error(
            "Invalid authentication tag length."
        );
    }


    return {

        encrypted,

        iv:
            iv.toString("base64"),

        authTag:
            authTag.toString("base64")

    };
}


// =====================================================
// DECRYPT DATA
// =====================================================

function decryptData(
    encrypted,
    key,
    iv,
    authTag
) {

    validateKey(key);


    if (!Buffer.isBuffer(encrypted)) {

        encrypted =
            Buffer.from(encrypted);
    }


    const ivBuffer =
        Buffer.from(
            iv,
            "base64"
        );


    const authTagBuffer =
        Buffer.from(
            authTag,
            "base64"
        );


    if (
        ivBuffer.length !==
        IV_LENGTH
    ) {

        throw new Error(
            "Invalid IV length."
        );
    }


    if (
        authTagBuffer.length !==
        AUTH_TAG_LENGTH
    ) {

        throw new Error(
            "Invalid authentication tag length."
        );
    }


    const decipher =
        crypto.createDecipheriv(
            ALGORITHM,
            key,
            ivBuffer
        );


    decipher.setAuthTag(
        authTagBuffer
    );


    return Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);
}


// =====================================================
// ENCRYPT FILE KEY
// =====================================================

function encryptFileKey(
    fileKey,
    version = getActiveKeyVersion()
) {

    validateKey(fileKey);


    const masterKey =
        getMasterKey(
            version
        );


    const encrypted =
        encryptData(
            fileKey,
            masterKey
        );


    return {

        ...encrypted,

        keyVersion:
            Number(version)

    };
}


// =====================================================
// DECRYPT FILE KEY
// =====================================================

function decryptFileKey(
    encryptedKey,
    iv,
    authTag,
    version
) {

    const masterKey =
        getMasterKey(
            version
        );


    return decryptData(
        encryptedKey,
        masterKey,
        iv,
        authTag
    );
}


// =====================================================
// RE-WRAP FILE KEY
// =====================================================
//
// This is the important rotation operation.
//
// File contents are NOT decrypted.
// File contents are NOT re-encrypted.
//
// Only the DEK is:
//
// Old Master Key
//       ↓
// decrypt DEK
//       ↓
// File DEK
//       ↓
// encrypt DEK
//       ↓
// New Master Key
//
// =====================================================

function rewrapFileKey(
    encryptedKey,
    iv,
    authTag,
    oldVersion,
    newVersion
) {

    const fileKey =
        decryptFileKey(
            encryptedKey,
            iv,
            authTag,
            oldVersion
        );


    const result =
        encryptFileKey(
            fileKey,
            newVersion
        );


    // Clear the plaintext DEK
    // from this Buffer after re-wrapping.
    fileKey.fill(0);


    return result;
}


// =====================================================
// GENERATE FILE KEY
// =====================================================

function generateFileKey() {

    return crypto.randomBytes(
        KEY_LENGTH
    );
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    encryptData,

    decryptData,

    encryptFileKey,

    decryptFileKey,

    rewrapFileKey,

    generateFileKey,

    getMasterKey,

    getActiveKeyVersion,

    generateMasterKey

};