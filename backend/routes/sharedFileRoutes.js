const express = require("express");

const router = express.Router();

const {
    getSharedFileInfo,
    downloadSharedFile
} = require("../controllers/sharedFileController");


router.get(
    "/:shareToken",
    getSharedFileInfo
);

router.get(
    "/:shareToken/download",
    downloadSharedFile
);


module.exports = router;