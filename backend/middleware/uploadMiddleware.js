
const multer = require("multer");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file
const MAX_FILES = 10;
const MAX_TOTAL_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per request

const storage = multer.memoryStorage();

const upload = multer({
    storage,

    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
        fields: 20,
        parts: MAX_FILES + 20,
        fieldSize: 16 * 1024
    }
});

function validateUploadBatch(req, res, next) {
    const files = req.files || [];

    const totalSize = files.reduce(
        (total, file) => total + file.size,
        0
    );

    if (totalSize > MAX_TOTAL_FILE_SIZE) {
        return res.status(413).json({
            success: false,
            message: "Total upload size must not exceed 100 MB per request."
        });
    }

    next();
}

module.exports = {
    upload,
    validateUploadBatch
};
