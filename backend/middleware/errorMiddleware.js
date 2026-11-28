
function errorMiddleware(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    // Multer upload errors
    if (err && err.name === "MulterError") {
        const multerErrors = {
            LIMIT_FILE_SIZE: {
                status: 413,
                message: "A file exceeds the maximum allowed size of 50 MB."
            },
            LIMIT_FILE_COUNT: {
                status: 400,
                message: "Too many files were uploaded."
            },
            LIMIT_UNEXPECTED_FILE: {
                status: 400,
                message: "Unexpected upload field or too many files."
            },
            LIMIT_FIELD_COUNT: {
                status: 400,
                message: "Too many form fields were submitted."
            },
            LIMIT_FIELD_VALUE: {
                status: 413,
                message: "A form field exceeds the allowed size."
            },
            LIMIT_PART_COUNT: {
                status: 400,
                message: "Too many multipart form parts were submitted."
            }
        };

        const knownError = multerErrors[err.code];

        if (knownError) {
            return res.status(knownError.status).json({
                success: false,
                message: knownError.message
            });
        }

        return res.status(400).json({
            success: false,
            message: "Invalid file upload request."
        });
    }

    // Malformed JSON request
    if (
        err &&
        err.status === 400 &&
        err.type === "entity.parse.failed"
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid JSON request body."
        });
    }

    // Request body too large
    if (err && err.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "Request body exceeds the allowed size."
        });
    }

    // Log details on the server only.
    console.error("Request error:", {
        name: err && err.name,
        code: err && err.code,
        message: err && err.message,
        path: req.originalUrl,
        method: req.method
    });

    const statusCode =
        Number.isInteger(err && err.statusCode) &&
        err.statusCode >= 400 &&
        err.statusCode <= 599
            ? err.statusCode
            : 500;

    // Only intentionally safe client-facing errors should expose their message.
    const safeMessage =
        statusCode < 500 &&
        err &&
        err.expose === true &&
        typeof err.message === "string"
            ? err.message
            : statusCode >= 500
                ? "Internal server error"
                : "Request could not be processed.";

    return res.status(statusCode).json({
        success: false,
        message: safeMessage
    });
}

module.exports = errorMiddleware;
