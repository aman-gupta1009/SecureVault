const crypto = require("crypto");

const {
    pool
} = require("../config/database");


/*
|--------------------------------------------------------------------------
| SHARE TOKEN CONFIGURATION
|--------------------------------------------------------------------------
|
| Raw token:
| - 32 random bytes
| - 256 bits of entropy
| - encoded as hexadecimal
|
| Database:
| - stores only SHA-256 hash
| - raw token is never stored
|
|--------------------------------------------------------------------------
*/

const SHARE_TOKEN_BYTES = 32;


/*
|--------------------------------------------------------------------------
| ALLOWED SHARE STATUS FILTERS
|--------------------------------------------------------------------------
*/

const ALLOWED_SHARE_STATUSES = new Set([
    "ALL",
    "ACTIVE",
    "EXPIRED",
    "REVOKED",
    "LIMIT_REACHED"
]);


/*
|--------------------------------------------------------------------------
| GENERATE SHARE TOKEN
|--------------------------------------------------------------------------
*/

function generateShareToken() {
    return crypto
        .randomBytes(SHARE_TOKEN_BYTES)
        .toString("hex");
}


/*
|--------------------------------------------------------------------------
| HASH SHARE TOKEN
|--------------------------------------------------------------------------
*/

function hashShareToken(token) {
    if (
        typeof token !== "string" ||
        token.length === 0
    ) {
        throw new Error("INVALID_SHARE_TOKEN");
    }

    return crypto
        .createHash("sha256")
        .update(token, "utf8")
        .digest("hex");
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
    expiresInMinutes = null,
    maxDownloads = null
}) {
    if (
        !Number.isInteger(Number(fileId)) ||
        Number(fileId) < 1
    ) {
        throw new Error("INVALID_FILE_ID");
    }

    if (
        !Number.isInteger(Number(ownerUserId)) ||
        Number(ownerUserId) < 1
    ) {
        throw new Error("INVALID_OWNER_USER_ID");
    }

    if (
        recipientEmail !== null &&
        (
            typeof recipientEmail !== "string" ||
            recipientEmail.length > 255
        )
    ) {
        throw new Error("INVALID_RECIPIENT_EMAIL");
    }

    if (
        expiresInMinutes !== null &&
        (
            !Number.isInteger(Number(expiresInMinutes)) ||
            Number(expiresInMinutes) < 1 ||
            Number(expiresInMinutes) > 10080
        )
    ) {
        throw new Error("INVALID_EXPIRES_IN_MINUTES");
    }

    if (
        maxDownloads !== null &&
        (
            !Number.isInteger(Number(maxDownloads)) ||
            Number(maxDownloads) < 1
        )
    ) {
        throw new Error("INVALID_MAX_DOWNLOADS");
    }

    const rawToken = generateShareToken();

    const tokenHash = hashShareToken(
        rawToken
    );

    let result;

    if (expiresInMinutes === null) {

        [result] = await pool.execute(
            `
            INSERT INTO file_shares
            (
                file_id,
                owner_user_id,
                share_token_hash,
                recipient_email,
                expires_at,
                max_downloads
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                NULL,
                ?
            )
            `,
            [
                Number(fileId),
                Number(ownerUserId),
                tokenHash,
                recipientEmail,
                maxDownloads === null
                    ? null
                    : Number(maxDownloads)
            ]
        );

    } else {

        [result] = await pool.execute(
            `
            INSERT INTO file_shares
            (
                file_id,
                owner_user_id,
                share_token_hash,
                recipient_email,
                expires_at,
                max_downloads
            )
            VALUES
            (
                ?,
                ?,
                ?,
                ?,
                DATE_ADD(
                    NOW(),
                    INTERVAL ? MINUTE
                ),
                ?
            )
            `,
            [
                Number(fileId),
                Number(ownerUserId),
                tokenHash,
                recipientEmail,
                Number(expiresInMinutes),
                maxDownloads === null
                    ? null
                    : Number(maxDownloads)
            ]
        );
    }

    const [rows] = await pool.execute(
        `
        SELECT
            share_id,
            expires_at,
            max_downloads
        FROM file_shares
        WHERE share_id = ?
        LIMIT 1
        `,
        [result.insertId]
    );

    if (rows.length === 0) {
        throw new Error(
            "SHARE_CREATED_BUT_NOT_FOUND"
        );
    }

    return {
        shareId: result.insertId,

        shareToken: rawToken,

        expiresAt:
            rows[0].expires_at,

        maxDownloads:
            rows[0].max_downloads === null
                ? null
                : Number(rows[0].max_downloads)
    };
}


/*
|--------------------------------------------------------------------------
| GET SHARE BY TOKEN
|--------------------------------------------------------------------------
*/

async function getShareByToken(shareToken) {

    const tokenHash =
        hashShareToken(shareToken);

    const [rows] =
        await pool.execute(
            `
            SELECT
                share_id,
                file_id,
                owner_user_id,
                share_token_hash,
                recipient_email,
                expires_at,
                max_downloads,
                download_count,
                revoked,
                created_at,
                updated_at
            FROM file_shares
            WHERE share_token_hash = ?
            LIMIT 1
            `,
            [tokenHash]
        );

    if (rows.length === 0) {
        return null;
    }

    return rows[0];
}


/*
|--------------------------------------------------------------------------
| REVOKE FILE SHARE
|--------------------------------------------------------------------------
*/

async function revokeFileShare(
    ownerUserId,
    shareId
) {

    const [result] =
        await pool.execute(
            `
            UPDATE file_shares
            SET
                revoked = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE share_id = ?
            AND owner_user_id = ?
            AND revoked = 0
            `,
            [
                Number(shareId),
                Number(ownerUserId)
            ]
        );

    return result.affectedRows === 1;
}


/*
|--------------------------------------------------------------------------
| VALIDATE SHARE ACCESS
|--------------------------------------------------------------------------
*/

async function validateShareAccess(
    shareToken
) {

    const share =
        await getShareByToken(
            shareToken
        );

    if (!share) {

        const error =
            new Error(
                "SHARE_NOT_FOUND"
            );

        error.statusCode = 404;

        throw error;
    }


    /*
    |----------------------------------------------------------------------
    | REVOKED SHARE
    |----------------------------------------------------------------------
    */

    if (
        Number(share.revoked) === 1
    ) {

        const error =
            new Error(
                "SHARE_REVOKED"
            );

        error.statusCode = 410;

        throw error;
    }


    /*
    |----------------------------------------------------------------------
    | EXPIRATION
    |----------------------------------------------------------------------
    */

    if (share.expires_at) {

        const expiresAt =
            new Date(
                share.expires_at
            );

        if (
            Number.isNaN(
                expiresAt.getTime()
            ) ||
            expiresAt.getTime() <=
                Date.now()
        ) {

            const error =
                new Error(
                    "SHARE_EXPIRED"
                );

            error.statusCode = 410;

            throw error;
        }
    }


    /*
    |----------------------------------------------------------------------
    | DOWNLOAD LIMIT
    |----------------------------------------------------------------------
    */

    if (
        share.max_downloads !== null &&
        Number(share.download_count) >=
            Number(share.max_downloads)
    ) {

        const error =
            new Error(
                "SHARE_DOWNLOAD_LIMIT_REACHED"
            );

        error.statusCode = 410;

        throw error;
    }

    return share;
}


/*
|--------------------------------------------------------------------------
| GET USER FILE SHARES
|--------------------------------------------------------------------------
|
| Returns only shares owned by the authenticated user.
|
| Supports:
|
| page
| limit
| status
|
| Status values:
|
| ALL
| ACTIVE
| EXPIRED
| REVOKED
| LIMIT_REACHED
|
|--------------------------------------------------------------------------
*/

async function getUserFileShares(
    ownerUserId,
    options = {}
) {

    const page =
        Number(
            options.page === undefined
                ? 1
                : options.page
        );

    const limit =
        Number(
            options.limit === undefined
                ? 20
                : options.limit
        );

    const status =
        String(
            options.status || "ALL"
        )
            .trim()
            .toUpperCase();


    /*
    |----------------------------------------------------------------------
    | VALIDATE PAGE
    |----------------------------------------------------------------------
    */

    if (
        !Number.isInteger(page) ||
        page < 1
    ) {
        throw new Error(
            "INVALID_PAGE"
        );
    }


    /*
    |----------------------------------------------------------------------
    | VALIDATE LIMIT
    |----------------------------------------------------------------------
    */

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        throw new Error(
            "INVALID_LIMIT"
        );
    }


    /*
    |----------------------------------------------------------------------
    | VALIDATE STATUS
    |----------------------------------------------------------------------
    */

    if (
        !ALLOWED_SHARE_STATUSES.has(
            status
        )
    ) {
        const error =
            new Error(
                "INVALID_SHARE_STATUS"
            );

        error.statusCode = 400;

        throw error;
    }


    /*
    |----------------------------------------------------------------------
    | VALIDATE OWNER
    |----------------------------------------------------------------------
    */

    if (
        !Number.isInteger(
            Number(ownerUserId)
        ) ||
        Number(ownerUserId) < 1
    ) {
        throw new Error(
            "INVALID_OWNER_USER_ID"
        );
    }


    const offset =
        (page - 1) * limit;


    /*
    |----------------------------------------------------------------------
    | STATUS EXPRESSION
    |--------------------------------------------------------------------------
    |
    | MySQL calculates status using NOW().
    |
    | This avoids another JavaScript/MySQL timezone
    | mismatch for management queries.
    |
    |--------------------------------------------------------------------------
    */

    const statusExpression = `
        CASE
            WHEN fs.revoked = 1
                THEN 'REVOKED'

            WHEN fs.expires_at IS NOT NULL
                 AND fs.expires_at <= NOW()
                THEN 'EXPIRED'

            WHEN fs.max_downloads IS NOT NULL
                 AND fs.download_count >= fs.max_downloads
                THEN 'LIMIT_REACHED'

            ELSE 'ACTIVE'
        END
    `;


    /*
    |----------------------------------------------------------------------
    | STATUS FILTER
    |----------------------------------------------------------------------
    */

    let statusCondition = "";

    const params = [
        Number(ownerUserId)
    ];

    if (status !== "ALL") {

        statusCondition = `
            AND (
                ${statusExpression}
            ) = ?
        `;

        params.push(status);
    }


    /*
    |----------------------------------------------------------------------
    | COUNT
    |----------------------------------------------------------------------
    */

    const [countRows] =
        await pool.execute(
            `
            SELECT
                COUNT(*) AS total
            FROM file_shares fs
            INNER JOIN vault_files vf
                ON vf.file_id = fs.file_id
                AND vf.user_id = fs.owner_user_id
            WHERE fs.owner_user_id = ?
            ${statusCondition}
            `,
            params
        );


    const total =
        Number(
            countRows[0].total
        );


    /*
    |----------------------------------------------------------------------
    | FILE SHARES
    |----------------------------------------------------------------------
    */

    const dataParams = [
        Number(ownerUserId)
    ];

    if (status !== "ALL") {
        dataParams.push(status);
    }


    const [rows] =
        await pool.execute(
            `
            SELECT
                fs.share_id,
                fs.file_id,
                vf.original_name,
                vf.mime_type,
                vf.file_size,
                fs.recipient_email,
                fs.expires_at,
                fs.max_downloads,
                fs.download_count,
                fs.revoked,
                fs.created_at,
                fs.updated_at,

                ${statusExpression}
                    AS share_status,

                CASE
                    WHEN fs.max_downloads IS NULL
                        THEN NULL

                    WHEN
                        fs.max_downloads -
                        fs.download_count < 0
                        THEN 0

                    ELSE
                        fs.max_downloads -
                        fs.download_count
                END
                    AS remaining_downloads

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


    /*
    |----------------------------------------------------------------------
    | FORMAT RESPONSE
    |----------------------------------------------------------------------
    */

    const shares =
        rows.map(
            (share) => ({
                shareId:
                    share.share_id,

                fileId:
                    share.file_id,

                fileName:
                    share.original_name,

                mimeType:
                    share.mime_type,

                fileSize:
                    Number(
                        share.file_size
                    ),

                recipientEmail:
                    share.recipient_email,

                expiresAt:
                    share.expires_at,

                maxDownloads:
                    share.max_downloads === null
                        ? null
                        : Number(
                            share.max_downloads
                        ),

                downloadCount:
                    Number(
                        share.download_count
                    ),

                remainingDownloads:
                    share.remaining_downloads === null
                        ? null
                        : Number(
                            share.remaining_downloads
                        ),

                revoked:
                    Number(
                        share.revoked
                    ) === 1,

                status:
                    share.share_status,

                createdAt:
                    share.created_at,

                updatedAt:
                    share.updated_at
            })
        );


    const totalPages =
        total === 0
            ? 0
            : Math.ceil(
                total / limit
            );


    return {
        shares,

        pagination: {
            page,
            limit,
            total,
            totalPages,

            hasNextPage:
                page < totalPages,

            hasPreviousPage:
                page > 1
        },

        filters: {
            status
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
    getUserFileShares
};