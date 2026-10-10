const multer = require("multer");


// =====================================================
// MEMORY STORAGE
// =====================================================

const storage = multer.memoryStorage();


// =====================================================
// UPLOAD CONFIGURATION
// =====================================================

const upload = multer({

    storage,

    limits: {

        // Maximum size of each file: 50 MB
        fileSize: 50 * 1024 * 1024,

        // Maximum number of files in one request
        files: 10

    }

});


// =====================================================
// EXPORT
// =====================================================

module.exports = upload;