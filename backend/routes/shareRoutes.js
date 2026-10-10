const express = require("express");

const router = express.Router();

const authMiddleware =
    require("../middleware/authMiddleware");

const {
    createShare,
    revokeShare,
    listShares
} = require("../controllers/fileShareController");


router.get(
    "/",
    authMiddleware,
    listShares
);


router.post(
    "/",
    authMiddleware,
    createShare
);


router.delete(
    "/:shareId",
    authMiddleware,
    revokeShare
);


module.exports = router;