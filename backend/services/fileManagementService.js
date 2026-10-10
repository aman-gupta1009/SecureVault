const { pool } = require("../config/database");

// ============================================================
// ALLOWED SORT OPTIONS
// ============================================================

const ALLOWED_SORT_FIELDS = {
    name: "original_name",
    size: "file_size",
    date: "created_at"
};

const ALLOWED_SORT_ORDERS = new Set([
    "asc",
    "desc"
]);


// ============================================================
// ESCAPE LIKE SPECIAL CHARACTERS
// Prevent % and _ from becoming SQL wildcards.
//
// Example:
// search = "100%"  -> searches for literal "100%"
// ============================================================

function escapeLikePattern(value) {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
}


// ============================================================
// GET USER FILES
//
// Supports:
//
// GET /api/vault/files
//
// Query parameters:
//
// page=1
// limit=20
// search=test
// mimeType=text/plain
// sortBy=name|size|date
// sortOrder=asc|desc
//
// ============================================================

async function getUserFiles(userId, options = {}) {

    // --------------------------------------------------------
    // READ OPTIONS
    // --------------------------------------------------------

    const page = Number(options.page || 1);

    const limit = Number(options.limit || 20);

    const search = options.search
        ? String(options.search).trim()
        : "";

    const mimeType = options.mimeType
        ? String(options.mimeType).trim()
        : "";

    const sortBy = options.sortBy
        ? String(options.sortBy).trim().toLowerCase()
        : "date";

    const sortOrder = options.sortOrder
        ? String(options.sortOrder).trim().toLowerCase()
        : "desc";


    // --------------------------------------------------------
    // VALIDATE PAGE
    // --------------------------------------------------------

    if (
        !Number.isInteger(page) ||
        page < 1
    ) {
        const error = new Error("INVALID_PAGE");

        error.statusCode = 400;

        throw error;
    }


    // --------------------------------------------------------
    // VALIDATE LIMIT
    // --------------------------------------------------------

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
    ) {
        const error = new Error("INVALID_LIMIT");

        error.statusCode = 400;

        throw error;
    }


    // --------------------------------------------------------
    // VALIDATE SEARCH LENGTH
    // --------------------------------------------------------

    if (search.length > 255) {
        const error = new Error("INVALID_SEARCH");

        error.statusCode = 400;

        throw error;
    }


    // --------------------------------------------------------
    // VALIDATE MIME TYPE
    // --------------------------------------------------------

    if (mimeType.length > 100) {
        const error = new Error("INVALID_MIME_TYPE");

        error.statusCode = 400;

        throw error;
    }


    // --------------------------------------------------------
    // VALIDATE SORT FIELD
    //
    // IMPORTANT:
    // Never directly trust a query parameter inside ORDER BY.
    // We only allow predefined database columns.
    // --------------------------------------------------------

    if (
        !Object.prototype.hasOwnProperty.call(
            ALLOWED_SORT_FIELDS,
            sortBy
        )
    ) {
        const error = new Error("INVALID_SORT_BY");

        error.statusCode = 400;

        throw error;
    }


    // --------------------------------------------------------
    // VALIDATE SORT ORDER
    // --------------------------------------------------------

    if (!ALLOWED_SORT_ORDERS.has(sortOrder)) {
        const error = new Error("INVALID_SORT_ORDER");

        error.statusCode = 400;

        throw error;
    }


    // --------------------------------------------------------
    // CALCULATE OFFSET
    // --------------------------------------------------------

    const offset = (page - 1) * limit;


    // --------------------------------------------------------
    // BUILD WHERE CLAUSE
    // --------------------------------------------------------

    let whereClause = `
        WHERE user_id = ?
    `;

    const params = [
        userId
    ];


    // --------------------------------------------------------
    // SEARCH BY ORIGINAL FILE NAME
    // --------------------------------------------------------

    if (search) {

        const escapedSearch =
            escapeLikePattern(search);

        whereClause += `
            AND original_name LIKE ? ESCAPE '\\\\'
        `;

        params.push(
            `%${escapedSearch}%`
        );
    }


    // --------------------------------------------------------
    // FILTER BY MIME TYPE
    // --------------------------------------------------------

    if (mimeType) {

        whereClause += `
            AND mime_type = ?
        `;

        params.push(
            mimeType
        );
    }


    // ========================================================
    // COUNT TOTAL MATCHING FILES
    // ========================================================

    const [countRows] = await pool.execute(
        `
        SELECT
            COUNT(*) AS total
        FROM vault_files
        ${whereClause}
        `,
        params
    );


    const total = Number(
        countRows[0].total
    );


    // ========================================================
    // SAFE SORT COLUMN
    // ========================================================

    const sortColumn =
        ALLOWED_SORT_FIELDS[sortBy];


    const orderDirection =
        sortOrder === "asc"
            ? "ASC"
            : "DESC";


    // ========================================================
    // FETCH FILES
    //
    // LIMIT/OFFSET are inserted only after validation.
    // This avoids the mysql2 prepared-statement issue encountered
    // earlier with LIMIT ? OFFSET ?.
    // ========================================================

    const [rows] = await pool.execute(
        `
        SELECT
            file_id,
            original_name,
            mime_type,
            file_size,
            file_hash,
            encryption_version,
            key_version,
            created_at,
            updated_at
        FROM vault_files
        ${whereClause}
        ORDER BY
            ${sortColumn} ${orderDirection},
            file_id DESC
        LIMIT ${limit}
        OFFSET ${offset}
        `,
        params
    );


    // ========================================================
    // FORMAT RESPONSE
    // ========================================================

    const files = rows.map((file) => ({

        fileId:
            Number(file.file_id),

        originalName:
            file.original_name,

        mimeType:
            file.mime_type,

        fileSize:
            Number(file.file_size),

        fileHash:
            file.file_hash,

        encryptionVersion:
            file.encryption_version,

        keyVersion:
            Number(file.key_version),

        createdAt:
            file.created_at,

        updatedAt:
            file.updated_at
    }));


    // ========================================================
    // PAGINATION
    // ========================================================

    const totalPages =
        total === 0
            ? 0
            : Math.ceil(
                total / limit
            );


    // ========================================================
    // RETURN RESULT
    // ========================================================

    return {

        files,

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

            search:
                search || null,

            mimeType:
                mimeType || null,

            sortBy,

            sortOrder
        }
    };
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    getUserFiles
};