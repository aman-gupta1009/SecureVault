
const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function validateKey(key) {
    if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
        throw new Error("INVALID_ENCRYPTION_KEY");
    }
}

function validateMasterKeyHex(keyHex) {
    if (
        typeof keyHex !== "string" ||
        !/^[0-9a-fA-F]{64}$/.test(keyHex)
    ) {
        throw new Error("INVALID_MASTER_KEY_CONFIGURATION");
    }
}

function getActiveKeyVersion() {
    const rawVersion = process.env.VAULT_ACTIVE_KEY_VERSION || "1";

    if (!/^[1-9]\d*$/.test(rawVersion)) {
        throw new Error("INVALID_ACTIVE_KEY_VERSION");
    }

    const version = Number(rawVersion);

    if (!Number.isSafeInteger(version)) {
        throw new Error("INVALID_ACTIVE_KEY_VERSION");
    }

    return version;
}

function getMasterKey(version = getActiveKeyVersion()) {
    const keyVersion = Number(version);

    if (
        !Number.isSafeInteger(keyVersion) ||
        keyVersion < 1
    ) {
        throw new Error("INVALID_MASTER_KEY_VERSION");
    }

    const keyHex = process.env[`VAULT_MASTER_KEY_V${keyVersion}`];

    validateMasterKeyHex(keyHex);

    const key = Buffer.from(keyHex, "hex");

    if (key.length !== KEY_LENGTH) {
        key.fill(0);
        throw new Error("INVALID_MASTER_KEY_CONFIGURATION");
    }

    return key;
}

function generateMasterKey() {
    return crypto.randomBytes(KEY_LENGTH).toString("hex");
}

function encryptData(plaintext, key) {
    validateKey(key);

    if (
        !Buffer.isBuffer(plaintext) &&
        typeof plaintext !== "string"
    ) {
        throw new Error("INVALID_PLAINTEXT");
    }

    const input = Buffer.isBuffer(plaintext)
        ? plaintext
        : Buffer.from(plaintext, "utf8");

    const iv = crypto.randomBytes(IV_LENGTH);

    try {
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        const encrypted = Buffer.concat([
            cipher.update(input),
            cipher.final()
        ]);

        const authTag = cipher.getAuthTag();

        if (authTag.length !== AUTH_TAG_LENGTH) {
            throw new Error("INVALID_AUTH_TAG");
        }

        return {
            encrypted,
            iv: iv.toString("base64"),
            authTag: authTag.toString("base64")
        };
    } finally {
        iv.fill(0);
    }
}

function decodeBase64(value, expectedLength, label) {
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`INVALID_${label}`);
    }

    const buffer = Buffer.from(value, "base64");

    if (
        buffer.length !== expectedLength ||
        buffer.toString("base64") !== value
    ) {
        buffer.fill(0);
        throw new Error(`INVALID_${label}`);
    }

    return buffer;
}

function decryptData(encrypted, key, iv, authTag) {
    validateKey(key);

    if (
        !Buffer.isBuffer(encrypted) &&
        typeof encrypted !== "string"
    ) {
        throw new Error("INVALID_ENCRYPTED_DATA");
    }

    // Strings passed to this function are Base64-encoded ciphertext.
    const encryptedBuffer = Buffer.isBuffer(encrypted)
        ? encrypted
        : Buffer.from(encrypted, "base64");

    const ivBuffer = decodeBase64(iv, IV_LENGTH, "IV");
    let authTagBuffer;

    try {
        authTagBuffer = decodeBase64(
            authTag,
            AUTH_TAG_LENGTH,
            "AUTH_TAG"
        );

        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            key,
            ivBuffer
        );

        decipher.setAuthTag(authTagBuffer);

        return Buffer.concat([
            decipher.update(encryptedBuffer),
            decipher.final()
        ]);
    } finally {
        ivBuffer.fill(0);

        if (authTagBuffer) {
            authTagBuffer.fill(0);
        }
    }
}

function encryptFileKey(fileKey, version = getActiveKeyVersion()) {
    validateKey(fileKey);

    const keyVersion = Number(version);
    const masterKey = getMasterKey(keyVersion);

    try {
        return {
            ...encryptData(fileKey, masterKey),
            keyVersion
        };
    } finally {
        masterKey.fill(0);
    }
}

function decryptFileKey(encryptedKey, iv, authTag, version) {
    const masterKey = getMasterKey(version);

    try {
        return decryptData(
            encryptedKey,
            masterKey,
            iv,
            authTag
        );
    } finally {
        masterKey.fill(0);
    }
}

function rewrapFileKey(
    encryptedKey,
    iv,
    authTag,
    oldVersion,
    newVersion
) {
    const fileKey = decryptFileKey(
        encryptedKey,
        iv,
        authTag,
        oldVersion
    );

    try {
        return encryptFileKey(fileKey, newVersion);
    } finally {
        fileKey.fill(0);
    }
}

function generateFileKey() {
    return crypto.randomBytes(KEY_LENGTH);
}

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
