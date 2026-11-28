
const crypto = require("crypto");
const { pool } = require("../config/database");

const SHARE_TOKEN_BYTES = 32;

const ALLOWED_SHARE_STATUSES = new Set([
    "ALL",
    "ACTIVE",
    "EXPIRED",
    "REVOKED",
    "LIMIT_REACHED"
]);

const ALLOWED_PERMISSIONS = new Set([
    "VIEW",
    "DOWNLOAD"
]);

const ALLOWED_ACTIVITY_TYPES = new Set([
    "OPENED",
    "VIEWED",
    "DOWNLOADED"
]);

function createServiceError(message, statusCode = 400) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function generateShareToken() {
    return crypto.randomBytes(SHARE_TOKEN_BYTES).toString("hex");
}

function hashShareToken(token) {
    if (
        typeof token !== "string" ||
        !/^[a-f0-9]{64}$/i.test(token)
    ) {
        throw createServiceError("INVALID_SHARE_TOKEN");
    }

    return crypto
        .createHash("sha256")
        .update(token, "utf8")
        .digest("hex");
}

function normalizeEmail(email) {
    if (email === null || email === undefined || email === "") {
        return null;
    }

    if (typeof email !== "string") {
        throw createServiceError("INVALID_RECIPIENT_EMAIL");
    }

    const normalized = email.trim().toLowerCase();

    if (
        normalized.length > 255 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ) {
        throw createServiceError("INVALID_RECIPIENT_EMAIL");
    }

    return normalized;
}

function validatePositiveInteger(
    value,
    errorCode,
    max = Number.MAX_SAFE_INTEGER
) {
    const number = Number(value);

    if (
        !Number.isSafeInteger(number) ||
        number < 1 ||
        number > max
    ) {
        throw createServiceError(errorCode);
    }

    return number;
}

/*
|--------------------------------------------------------------------------
| NORMALIZE EXACT EXPIRY
|--------------------------------------------------------------------------
*/

function normalizeExpiry(expiresAt) {
    if (
        expiresAt === null ||
        expiresAt === undefined ||
        expiresAt === ""
    ) {
        return null;
    }

    const timestamp = new Date(expiresAt).getTime();

    if (
        !Number.isFinite(timestamp) ||
        timestamp <= Date.now()
    ) {
        throw createServiceError("INVALID_EXPIRES_AT");
    }

    return timestamp;
}

/*
|--------------------------------------------------------------------------
| CREATE FILE SHARE
|--------------------------------------------------------------------------
*/

async function createFileShare({
    fileId,
    ownerUserId,
    recipientEmail = null,
    expiresAt = null,
    expiresInMinutes = null,
    maxDownloads = null,
    maxOpens = null,
    permissionType = "DOWNLOAD",
    watermarkEnabled = false
}) {
    const safeFileId = validatePositiveInteger(
        fileId,
        "INVALID_FILE_ID"
    );

    const safeOwnerId = validatePositiveInteger(
        ownerUserId,
        "INVALID_OWNER_USER_ID"
    );

    const safeEmail = normalizeEmail(recipientEmail);

    const safePermission = String(permissionType)
        .trim()
        .toUpperCase();

    if (!ALLOWED_PERMISSIONS.has(safePermission)) {
        throw createServiceError("INVALID_PERMISSION_TYPE");
    }

    if (typeof watermarkEnabled !== "boolean") {
        throw createServiceError("INVALID_WATERMARK_SETTING");
    }


    // Watermark is applicable to both VIEW and DOWNLOAD shares.
const safeWatermark = watermarkEnabled;

    /*
     * Support either:
     * 1. Exact expiry date/time.
     * 2. Relative expiry in minutes.
     *
     * Do not accept both simultaneously.
     */

    if (
        expiresAt !== null &&
        expiresAt !== undefined &&
        expiresAt !== "" &&
        expiresInMinutes !== null &&
        expiresInMinutes !== undefined
    ) {
        throw createServiceError(
            "USE_EITHER_EXPIRES_AT_OR_EXPIRES_IN_MINUTES"
        );
    }

    let safeExpiryTimestamp = null;

    if (
        expiresAt !== null &&
        expiresAt !== undefined &&
        expiresAt !== ""
    ) {
        safeExpiryTimestamp = normalizeExpiry(expiresAt);
    } else if (expiresInMinutes !== null) {
        const safeMinutes = validatePositiveInteger(
            expiresInMinutes,
            "INVALID_EXPIRES_IN_MINUTES",
            10080
        );

        safeExpiryTimestamp =
            Date.now() + safeMinutes * 60 * 1000;
    }

    let safeMaxDownloads = null;

    if (maxDownloads !== null) {
        safeMaxDownloads = validatePositiveInteger(
            maxDownloads,
            "INVALID_MAX_DOWNLOADS",
            10000
        );
    }

    let safeMaxOpens = null;

    if (maxOpens !== null) {
        safeMaxOpens = validatePositiveInteger(
            maxOpens,
            "INVALID_MAX_OPENS",
            10000
        );
    }

    // VIEW-only shares cannot be downloaded.
    if (safePermission === "VIEW") {
        safeMaxDownloads = null;
    }

    const rawToken = generateShareToken();
    const tokenHash = hashShareToken(rawToken);

    const [result] = await pool.execute(
        `
        INSERT INTO file_shares
        (
            file_id,
            owner_user_id,
            share_token_hash,
            recipient_email,
            permission_type,
            watermark_enabled,
            expires_at,
            max_downloads,
            max_opens,
            open_count
        )
        VALUES
        (
            ?, ?, ?, ?, ?, ?,
            CASE
                WHEN ? IS NULL THEN NULL
                ELSE FROM_UNIXTIME(? / 1000)
            END,
            ?,
            ?,
            0
        )
        `,
        [
            safeFileId,
            safeOwnerId,
            tokenHash,
            safeEmail,
            safePermission,
            safeWatermark ? 1 : 0,
            safeExpiryTimestamp,
            safeExpiryTimestamp,
            safeMaxDownloads,
            safeMaxOpens
        ]
    );

    const [rows] = await pool.execute(
        `
        SELECT
            share_id,
            expires_at,
            max_downloads,
            download_count,
            max_opens,
            open_count,
            permission_type,
            watermark_enabled
        FROM file_shares
        WHERE share_id = ?
        LIMIT 1
        `,
        [result.insertId]
    );

    if (rows.length === 0) {
        throw new Error("SHARE_CREATED_BUT_NOT_FOUND");
    }

    const share = rows[0];

    return {
        shareId: Number(share.share_id),
        shareToken: rawToken,

        expiresAt: share.expires_at,

        maxDownloads: share.max_downloads === null
            ? null
            : Number(share.max_downloads),

        downloadCount: Number(share.download_count),

        maxOpens: share.max_opens === null
            ? null
            : Number(share.max_opens),

        openCount: Number(share.open_count),

        remainingOpens: share.max_opens === null
            ? null
            : Math.max(
                0,
                Number(share.max_opens) -
                Number(share.open_count)
            ),

        permissionType: share.permission_type,

        watermarkEnabled:
            Number(share.watermark_enabled) === 1
    };
}

/*
|--------------------------------------------------------------------------
| GET SHARE BY TOKEN
|--------------------------------------------------------------------------
*/

async function getShareByToken(shareToken) {
    const tokenHash = hashShareToken(shareToken);

    const [rows] = await pool.execute(
        `
        SELECT
            share_id,
            file_id,
            owner_user_id,
            share_token_hash,
            recipient_email,
            permission_type,
            watermark_enabled,
            expires_at,
            max_downloads,
            download_count,
            max_opens,
            open_count,
            revoked,
            created_at,
            updated_at
        FROM file_shares
        WHERE share_token_hash = ?
        LIMIT 1
        `,
        [tokenHash]
    );

    return rows.length > 0 ? rows[0] : null;
}

/*
|--------------------------------------------------------------------------
| REVOKE FILE SHARE
|--------------------------------------------------------------------------
*/

async function revokeFileShare(ownerUserId, shareId) {
    const safeOwnerId = validatePositiveInteger(
        ownerUserId,
        "INVALID_OWNER_USER_ID"
    );

    const safeShareId = validatePositiveInteger(
        shareId,
        "INVALID_SHARE_ID"
    );

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `
            UPDATE file_shares
            SET
                revoked = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE share_id = ?
              AND owner_user_id = ?
              AND revoked = 0
            `,
            [safeShareId, safeOwnerId]
        );

        if (result.affectedRows === 1) {
            await connection.execute(
                `
                UPDATE share_access_sessions
                SET revoked = 1
                WHERE share_id = ?
                `,
                [safeShareId]
            );
        }

        await connection.commit();

        return result.affectedRows === 1;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/*
|--------------------------------------------------------------------------
| VALIDATE SHARE ACCESS
|--------------------------------------------------------------------------
*/

async function validateShareAccess(
    shareToken,
    options = {}
) {
    const share = await getShareByToken(shareToken);

    if (!share) {
        throw createServiceError("SHARE_NOT_FOUND", 404);
    }

    if (Number(share.revoked) === 1) {
        throw createServiceError("SHARE_REVOKED", 410);
    }

    if (share.expires_at) {
        const expiry = new Date(share.expires_at);

        if (
            Number.isNaN(expiry.getTime()) ||
            expiry.getTime() <= Date.now()
        ) {
            throw createServiceError("SHARE_EXPIRED", 410);
        }
    }

    if (options.requireDownloadPermission === true) {
        if (share.permission_type !== "DOWNLOAD") {
            throw createServiceError(
                "SHARE_DOWNLOAD_NOT_ALLOWED",
                403
            );
        }
    }

    if (options.enforceDownloadLimit === true) {
        if (
            share.max_downloads !== null &&
            Number(share.download_count) >=
                Number(share.max_downloads)
        ) {
            throw createServiceError(
                "SHARE_DOWNLOAD_LIMIT_REACHED",
                410
            );
        }
    }

    /*
     * Open limits are enforced when registering a new
     * recipient session, not here.
     *
     * An already-opened session must remain usable even
     * after the maximum number of opens is reached.
     */

    return share;
}

/*
|--------------------------------------------------------------------------
| SHARE STATUS EXPRESSION
|--------------------------------------------------------------------------
*/

const statusExpression = `
    CASE
        WHEN fs.revoked = 1
            THEN 'REVOKED'

        WHEN fs.expires_at IS NOT NULL
             AND fs.expires_at <= NOW()
            THEN 'EXPIRED'

        WHEN (
            (
                fs.permission_type = 'DOWNLOAD'
                AND fs.max_downloads IS NOT NULL
                AND fs.download_count >= fs.max_downloads
            )
            OR
            (
                fs.max_opens IS NOT NULL
                AND fs.open_count >= fs.max_opens
            )
        )
            THEN 'LIMIT_REACHED'

        ELSE 'ACTIVE'
    END
`;

/*
|--------------------------------------------------------------------------
| GET USER FILE SHARES
|--------------------------------------------------------------------------
*/

async function getUserFileShares(
    ownerUserId,
    options = {}
) {
    const page = Number(
        options.page === undefined ? 1 : options.page
    );

    const limit = Number(
        options.limit === undefined ? 20 : options.limit
    );

    const status = String(options.status || "ALL")
        .trim()
        .toUpperCase();

    if (!Number.isInteger(page) || page < 1) {
        throw createServiceError("INVALID_PAGE");
    }

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        throw createServiceError("INVALID_LIMIT");
    }

    if (!ALLOWED_SHARE_STATUSES.has(status)) {
        throw createServiceError("INVALID_SHARE_STATUS");
    }

    const safeOwnerId = validatePositiveInteger(
        ownerUserId,
        "INVALID_OWNER_USER_ID"
    );

    const offset = (page - 1) * limit;

    let statusCondition = "";
    const params = [safeOwnerId];

    if (status !== "ALL") {
        statusCondition = `AND (${statusExpression}) = ?`;
        params.push(status);
    }

    const [countRows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM file_shares fs
        INNER JOIN vault_files vf
            ON vf.file_id = fs.file_id
           AND vf.user_id = fs.owner_user_id
        WHERE fs.owner_user_id = ?
        ${statusCondition}
        `,
        params
    );

    const total = Number(countRows[0].total);

    const dataParams = [safeOwnerId];

    if (status !== "ALL") {
        dataParams.push(status);
    }

    const [rows] = await pool.execute(
        `
        SELECT
            fs.share_id,
            fs.file_id,
            vf.original_name,
            vf.mime_type,
            vf.file_size,

            fs.recipient_email,
            fs.permission_type,
            fs.watermark_enabled,
            fs.expires_at,

            fs.max_downloads,
            fs.download_count,

            fs.max_opens,
            fs.open_count,

            fs.revoked,
            fs.created_at,
            fs.updated_at,

            ${statusExpression} AS share_status,

            CASE
                WHEN fs.permission_type = 'VIEW'
                    THEN NULL

                WHEN fs.max_downloads IS NULL
                    THEN NULL

                WHEN fs.max_downloads - fs.download_count < 0
                    THEN 0

                ELSE fs.max_downloads - fs.download_count
            END AS remaining_downloads,

            CASE
                WHEN fs.max_opens IS NULL
                    THEN NULL

                WHEN fs.max_opens - fs.open_count < 0
                    THEN 0

                ELSE fs.max_opens - fs.open_count
            END AS remaining_opens

        FROM file_shares fs

        INNER JOIN vault_files vf
            ON vf.file_id = fs.file_id
           AND vf.user_id = fs.owner_user_id

        WHERE fs.owner_user_id = ?

        ${statusCondition}

        ORDER BY
            fs.created_at DESC,
            fs.share_id DESC

        LIMIT ${limit}
        OFFSET ${offset}
        `,
        dataParams
    );

    const shares = rows.map((share) => ({
        shareId: Number(share.share_id),
        fileId: Number(share.file_id),

        fileName: share.original_name,
        mimeType: share.mime_type,
        fileSize: Number(share.file_size),

        recipientEmail: share.recipient_email,

        permissionType: share.permission_type,

        watermarkEnabled:
            Number(share.watermark_enabled) === 1,

        expiresAt: share.expires_at,

        maxDownloads: share.max_downloads === null
            ? null
            : Number(share.max_downloads),

        downloadCount: Number(share.download_count),

        remainingDownloads:
            share.remaining_downloads === null
                ? null
                : Number(share.remaining_downloads),

        maxOpens: share.max_opens === null
            ? null
            : Number(share.max_opens),

        openCount: Number(share.open_count),

        remainingOpens:
            share.remaining_opens === null
                ? null
                : Number(share.remaining_opens),

        revoked: Number(share.revoked) === 1,

        status: share.share_status,

        createdAt: share.created_at,
        updatedAt: share.updated_at
    }));

    const totalPages = total === 0
        ? 0
        : Math.ceil(total / limit);

    return {
        shares,

        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        },

        filters: {
            status
        }
    };
}

/*
|--------------------------------------------------------------------------
| GET SHARE ACTIVITY
|--------------------------------------------------------------------------
|
| Only the owner of the share can retrieve its activity.
|
*/

async function getShareActivity(
    ownerUserId,
    shareId,
    options = {}
) {
    const safeOwnerId = validatePositiveInteger(
        ownerUserId,
        "INVALID_OWNER_USER_ID"
    );

    const safeShareId = validatePositiveInteger(
        shareId,
        "INVALID_SHARE_ID"
    );

    const page = Number(
        options.page === undefined ? 1 : options.page
    );

    const limit = Number(
        options.limit === undefined ? 20 : options.limit
    );

    const eventType = options.eventType
        ? String(options.eventType).trim().toUpperCase()
        : null;

    if (!Number.isInteger(page) || page < 1) {
        throw createServiceError("INVALID_PAGE");
    }

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        throw createServiceError("INVALID_LIMIT");
    }

    if (
        eventType !== null &&
        !ALLOWED_ACTIVITY_TYPES.has(eventType)
    ) {
        throw createServiceError("INVALID_ACTIVITY_TYPE");
    }

    // Verify ownership before returning activity.
    const [shareRows] = await pool.execute(
        `
        SELECT
            share_id,
            recipient_email,
            permission_type
        FROM file_shares
        WHERE share_id = ?
          AND owner_user_id = ?
        LIMIT 1
        `,
        [safeShareId, safeOwnerId]
    );

    if (shareRows.length === 0) {
        throw createServiceError("SHARE_NOT_FOUND", 404);
    }

    const offset = (page - 1) * limit;

    let eventCondition = "";
    const countParams = [safeShareId];
    const dataParams = [safeShareId];

    if (eventType !== null) {
        eventCondition = "AND event_type = ?";
        countParams.push(eventType);
        dataParams.push(eventType);
    }

    const [countRows] = await pool.execute(
        `
        SELECT COUNT(*) AS total
        FROM share_access_events
        WHERE share_id = ?
        ${eventCondition}
        `,
        countParams
    );

    const total = Number(countRows[0].total);

    const [eventRows] = await pool.execute(
        `
        SELECT
            event_id,
            share_id,
            recipient_email,
            event_type,
            ip_address,
            user_agent,
            created_at
        FROM share_access_events
        WHERE share_id = ?
        ${eventCondition}
        ORDER BY
            created_at DESC,
            event_id DESC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        dataParams
    );

    const events = eventRows.map((event) => ({
        eventId: Number(event.event_id),
        shareId: Number(event.share_id),
        recipientEmail: event.recipient_email,
        eventType: event.event_type,
        ipAddress: event.ip_address,
        userAgent: event.user_agent,
        createdAt: event.created_at
    }));

    const totalPages = total === 0
        ? 0
        : Math.ceil(total / limit);

    return {
        share: {
            shareId: Number(shareRows[0].share_id),
            recipientEmail: shareRows[0].recipient_email,
            permissionType: shareRows[0].permission_type
        },

        events,

        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        },

        filters: {
            eventType
        }
    };
}

/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {
    generateShareToken,
    hashShareToken,
    createFileShare,
    getShareByToken,
    validateShareAccess,
    revokeFileShare,
    getUserFileShares,
    getShareActivity
};
