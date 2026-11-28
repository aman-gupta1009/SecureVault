
const crypto = require("crypto");
const { pool } = require("../config/database");

const {
    encryptData,
    decryptData,
    encryptFileKey,
    decryptFileKey,
    generateFileKey,
    getMasterKey,
    getActiveKeyVersion
} = require("./encryptionService");

const { logSecurityEvent } = require("./securityEventService");

// Normalize account identifiers for duplicate detection.
function normalizeIdentifier(value) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error("INVALID_ACCOUNT_IDENTIFIER");
    }

    return value.trim().toLowerCase();
}

// Browser-captured entries use their actual website origin.
function normalizeWebsiteOrigin(value) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error("INVALID_WEBSITE_URL");
    }

    let parsed;

    try {
        parsed = new URL(value.trim());
    } catch {
        throw new Error("INVALID_WEBSITE_URL");
    }

    if (
        !["http:", "https:"].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
    ) {
        throw new Error("INVALID_WEBSITE_URL");
    }

    return parsed.origin.toLowerCase();
}

// Manual entries do not require a URL.
// A deterministic internal identifier is generated from the app name.
function createManualWebsiteOrigin(websiteName) {
    const normalizedName = websiteName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const slug = normalizedName
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 70) || "application";

    const nameHash = crypto
        .createHash("sha256")
        .update(normalizedName, "utf8")
        .digest("hex")
        .slice(0, 16);

    return `manual://${slug}-${nameHash}`;
}

function validateCredentialInput(input) {
    if (!input || typeof input !== "object") {
        throw new Error("INVALID_CREDENTIAL_DATA");
    }

    const websiteName =
        typeof input.websiteName === "string"
            ? input.websiteName.trim()
            : "";

    const accountIdentifier =
        typeof input.accountIdentifier === "string"
            ? input.accountIdentifier.trim()
            : "";

    const password =
        typeof input.password === "string"
            ? input.password
            : "";

    if (!websiteName || websiteName.length > 150) {
        throw new Error("INVALID_WEBSITE_NAME");
    }

    if (!accountIdentifier || accountIdentifier.length > 320) {
        throw new Error("INVALID_ACCOUNT_IDENTIFIER");
    }

    if (!password || Buffer.byteLength(password, "utf8") > 4096) {
        throw new Error("INVALID_PASSWORD");
    }

    let websiteOrigin;
    let entrySource;

    if (
        input.websiteUrl === undefined ||
        input.websiteUrl === null ||
        input.websiteUrl === ""
    ) {
        websiteOrigin = createManualWebsiteOrigin(websiteName);
        entrySource = "manual";
    } else {
        websiteOrigin = normalizeWebsiteOrigin(input.websiteUrl);
        entrySource = "browser";
    }

    return {
        websiteName,
        websiteOrigin,
        entrySource,
        accountIdentifier,
        password
    };
}

function createLookupHash(identifier, keyVersion) {
    const masterKey = getMasterKey(keyVersion);

    try {
        return crypto
            .createHmac("sha256", masterKey)
            .update("SecureVault:PasswordManager:AccountLookup:v1:")
            .update(normalizeIdentifier(identifier), "utf8")
            .digest("hex");
    } finally {
        masterKey.fill(0);
    }
}

function encryptField(value, dek) {
    const result = encryptData(value, dek);

    try {
        return {
            encrypted: result.encrypted.toString("base64"),
            iv: result.iv,
            authTag: result.authTag
        };
    } finally {
        if (Buffer.isBuffer(result.encrypted)) {
            result.encrypted.fill(0);
        }
    }
}

function decryptField(encrypted, iv, authTag, dek) {
    const ciphertext = Buffer.from(encrypted, "base64");

    try {
        if (
            ciphertext.length === 0 ||
            ciphertext.toString("base64") !== encrypted
        ) {
            throw new Error("INVALID_ENCRYPTED_FIELD");
        }

        return decryptData(ciphertext, dek, iv, authTag);
    } finally {
        ciphertext.fill(0);
    }
}

function parseEncryptedDEK(value) {
    let parsed;

    try {
        parsed = typeof value === "string"
            ? JSON.parse(value)
            : value;
    } catch {
        throw new Error("INVALID_ENCRYPTED_DEK");
    }

    if (
        !parsed ||
        typeof parsed.encrypted !== "string" ||
        typeof parsed.iv !== "string" ||
        typeof parsed.authTag !== "string"
    ) {
        throw new Error("INVALID_ENCRYPTED_DEK");
    }

    const encrypted = Buffer.from(parsed.encrypted, "base64");

    if (
        encrypted.length !== 32 ||
        encrypted.toString("base64") !== parsed.encrypted
    ) {
        encrypted.fill(0);
        throw new Error("INVALID_ENCRYPTED_DEK");
    }

    return {
        encrypted,
        iv: parsed.iv,
        authTag: parsed.authTag
    };
}

function unwrapCredentialDEK(row) {
    const wrapped = parseEncryptedDEK(row.encrypted_dek);

    try {
        return decryptFileKey(
            wrapped.encrypted,
            wrapped.iv,
            wrapped.authTag,
            Number(row.key_version)
        );
    } finally {
        wrapped.encrypted.fill(0);
    }
}

function safeHashEqual(first, second) {
    if (
        typeof first !== "string" ||
        typeof second !== "string" ||
        !/^[a-f0-9]{64}$/i.test(first) ||
        !/^[a-f0-9]{64}$/i.test(second)
    ) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(first, "hex"),
        Buffer.from(second, "hex")
    );
}

async function findMatchingCredential(
    userId,
    websiteOrigin,
    accountIdentifier
) {
    const [rows] = await pool.execute(
        `
        SELECT
            credential_id,
            user_id,
            website_name,
            website_origin,
            account_identifier_encrypted,
            account_identifier_iv,
            account_identifier_auth_tag,
            password_encrypted,
            password_iv,
            password_auth_tag,
            encrypted_dek,
            key_version,
            account_lookup_hash,
            lookup_key_version
        FROM password_manager_entries
        WHERE user_id = ?
          AND website_origin = ?
        ORDER BY credential_id ASC
        `,
        [userId, websiteOrigin]
    );

    for (const row of rows) {
        const candidateHash = createLookupHash(
            accountIdentifier,
            Number(row.lookup_key_version)
        );

        if (safeHashEqual(candidateHash, row.account_lookup_hash)) {
            return row;
        }
    }

    return null;
}

function decryptAccountIdentifier(row, dek) {
    const plaintext = decryptField(
        row.account_identifier_encrypted,
        row.account_identifier_iv,
        row.account_identifier_auth_tag,
        dek
    );

    try {
        return plaintext.toString("utf8");
    } finally {
        plaintext.fill(0);
    }
}

function decryptStoredPassword(row, dek) {
    const plaintext = decryptField(
        row.password_encrypted,
        row.password_iv,
        row.password_auth_tag,
        dek
    );

    try {
        return plaintext.toString("utf8");
    } finally {
        plaintext.fill(0);
    }
}

async function recordSecurityEvent(
    userId,
    eventType,
    req,
    credentialId
) {
    try {
        await logSecurityEvent({
            userId,
            eventType,
            req: req || null,
            metadata: { credentialId }
        });
    } catch (error) {
        console.error(
            "PASSWORD_MANAGER_AUDIT_FAILED:",
            error.message
        );
    }
}

async function getExistingCredentialStatus(
    existing,
    newPassword
) {
    let dek;

    try {
        dek = unwrapCredentialDEK(existing);

        const oldPassword = decryptStoredPassword(existing, dek);

        if (oldPassword === newPassword) {
            return {
                status: "already_saved",
                credentialId: existing.credential_id
            };
        }

        return {
            status: "update_confirmation_required",
            credentialId: existing.credential_id
        };
    } finally {
        if (Buffer.isBuffer(dek)) {
            dek.fill(0);
        }
    }
}

async function createCredential(userId, input, req = null) {
    const data = validateCredentialInput(input);

    const existing = await findMatchingCredential(
        userId,
        data.websiteOrigin,
        data.accountIdentifier
    );

    if (existing) {
        return getExistingCredentialStatus(existing, data.password);
    }

    const keyVersion = Number(getActiveKeyVersion());

    if (!Number.isSafeInteger(keyVersion) || keyVersion < 1) {
        throw new Error("INVALID_ACTIVE_KEY_VERSION");
    }

    const dek = generateFileKey();

    let wrappedDEK;

    try {
        const encryptedIdentifier = encryptField(
            data.accountIdentifier,
            dek
        );

        const encryptedPassword = encryptField(
            data.password,
            dek
        );

        wrappedDEK = encryptFileKey(dek, keyVersion);

        const encryptedDEKJSON = JSON.stringify({
            encrypted: wrappedDEK.encrypted.toString("base64"),
            iv: wrappedDEK.iv,
            authTag: wrappedDEK.authTag
        });

        const lookupHash = createLookupHash(
            data.accountIdentifier,
            keyVersion
        );

        try {
            const [result] = await pool.execute(
                `
                INSERT INTO password_manager_entries (
                    user_id,
                    website_name,
                    website_origin,
                    account_identifier_encrypted,
                    account_identifier_iv,
                    account_identifier_auth_tag,
                    password_encrypted,
                    password_iv,
                    password_auth_tag,
                    encrypted_dek,
                    key_version,
                    account_lookup_hash,
                    lookup_key_version
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    userId,
                    data.websiteName,
                    data.websiteOrigin,
                    encryptedIdentifier.encrypted,
                    encryptedIdentifier.iv,
                    encryptedIdentifier.authTag,
                    encryptedPassword.encrypted,
                    encryptedPassword.iv,
                    encryptedPassword.authTag,
                    encryptedDEKJSON,
                    keyVersion,
                    lookupHash,
                    keyVersion
                ]
            );

            await recordSecurityEvent(
                userId,
                "PASSWORD_MANAGER_CREDENTIAL_CREATED",
                req,
                result.insertId
            );

            return {
                status: "created",
                credentialId: result.insertId
            };
        } catch (error) {
            // Handle a concurrent duplicate insert safely.
            if (error.code === "ER_DUP_ENTRY") {
                const duplicate = await findMatchingCredential(
                    userId,
                    data.websiteOrigin,
                    data.accountIdentifier
                );

                if (duplicate) {
                    return getExistingCredentialStatus(
                        duplicate,
                        data.password
                    );
                }
            }

            throw error;
        }
    } finally {
        dek.fill(0);

        if (
            wrappedDEK &&
            Buffer.isBuffer(wrappedDEK.encrypted)
        ) {
            wrappedDEK.encrypted.fill(0);
        }
    }
}

async function listCredentials(userId) {
    const [rows] = await pool.execute(
        `
        SELECT
            credential_id,
            website_name,
            website_origin,
            account_identifier_encrypted,
            account_identifier_iv,
            account_identifier_auth_tag,
            encrypted_dek,
            key_version,
            created_at,
            updated_at
        FROM password_manager_entries
        WHERE user_id = ?
        ORDER BY website_name ASC, updated_at DESC
        `,
        [userId]
    );

    const credentials = [];

    for (const row of rows) {
        let dek;

        try {
            dek = unwrapCredentialDEK(row);

            const accountIdentifier = decryptAccountIdentifier(row, dek);

            const isManual = row.website_origin.startsWith("manual://");

            credentials.push({
                credentialId: row.credential_id,
                websiteName: row.website_name,
                entrySource: isManual ? "manual" : "browser",
                websiteOrigin: isManual ? null : row.website_origin,
                accountIdentifier,
                createdAt: row.created_at,
                updatedAt: row.updated_at
            });
        } finally {
            if (Buffer.isBuffer(dek)) {
                dek.fill(0);
            }
        }
    }

    return credentials;
}

async function revealCredential(userId, credentialId, req = null) {
    const [rows] = await pool.execute(
        `
        SELECT
            credential_id,
            password_encrypted,
            password_iv,
            password_auth_tag,
            encrypted_dek,
            key_version
        FROM password_manager_entries
        WHERE credential_id = ?
          AND user_id = ?
        LIMIT 1
        `,
        [credentialId, userId]
    );

    if (!rows.length) {
        throw new Error("CREDENTIAL_NOT_FOUND");
    }

    let dek;
    let plaintext;

    try {
        dek = unwrapCredentialDEK(rows[0]);

        plaintext = decryptField(
            rows[0].password_encrypted,
            rows[0].password_iv,
            rows[0].password_auth_tag,
            dek
        );

        const password = plaintext.toString("utf8");

        await recordSecurityEvent(
            userId,
            "PASSWORD_MANAGER_CREDENTIAL_REVEALED",
            req,
            credentialId
        );

        return password;
    } finally {
        if (Buffer.isBuffer(plaintext)) {
            plaintext.fill(0);
        }

        if (Buffer.isBuffer(dek)) {
            dek.fill(0);
        }
    }
}

async function updateCredentialPassword(
    userId,
    credentialId,
    newPassword,
    req = null
) {
    if (
        typeof newPassword !== "string" ||
        !newPassword ||
        Buffer.byteLength(newPassword, "utf8") > 4096
    ) {
        throw new Error("INVALID_PASSWORD");
    }

    const [rows] = await pool.execute(
        `
        SELECT
            credential_id,
            encrypted_dek,
            key_version
        FROM password_manager_entries
        WHERE credential_id = ?
          AND user_id = ?
        LIMIT 1
        `,
        [credentialId, userId]
    );

    if (!rows.length) {
        throw new Error("CREDENTIAL_NOT_FOUND");
    }

    let dek;

    try {
        dek = unwrapCredentialDEK(rows[0]);

        const encryptedPassword = encryptField(newPassword, dek);

        const [result] = await pool.execute(
            `
            UPDATE password_manager_entries
            SET
                password_encrypted = ?,
                password_iv = ?,
                password_auth_tag = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE credential_id = ?
              AND user_id = ?
            `,
            [
                encryptedPassword.encrypted,
                encryptedPassword.iv,
                encryptedPassword.authTag,
                credentialId,
                userId
            ]
        );

        if (result.affectedRows !== 1) {
            throw new Error("CREDENTIAL_UPDATE_FAILED");
        }

        await recordSecurityEvent(
            userId,
            "PASSWORD_MANAGER_CREDENTIAL_UPDATED",
            req,
            credentialId
        );

        return {
            status: "updated",
            credentialId
        };
    } finally {
        if (Buffer.isBuffer(dek)) {
            dek.fill(0);
        }
    }
}

async function deleteCredential(userId, credentialId, req = null) {
    const [result] = await pool.execute(
        `
        DELETE FROM password_manager_entries
        WHERE credential_id = ?
          AND user_id = ?
        `,
        [credentialId, userId]
    );

    if (result.affectedRows !== 1) {
        throw new Error("CREDENTIAL_NOT_FOUND");
    }

    await recordSecurityEvent(
        userId,
        "PASSWORD_MANAGER_CREDENTIAL_DELETED",
        req,
        credentialId
    );

    return {
        status: "deleted",
        credentialId
    };
}

module.exports = {
    createCredential,
    listCredentials,
    revealCredential,
    updateCredentialPassword,
    deleteCredential,
    normalizeWebsiteOrigin
};
