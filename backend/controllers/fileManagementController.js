const {
    getUserFiles
} = require("../services/fileManagementService");

async function listFiles(req, res, next) {
    try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 20);

        const search = req.query.search
            ? String(req.query.search)
            : "";

        const mimeType = req.query.mimeType
            ? String(req.query.mimeType)
            : "";

        const sortBy = req.query.sortBy
            ? String(req.query.sortBy)
            : "date";

        const sortOrder = req.query.sortOrder
            ? String(req.query.sortOrder)
            : "desc";

        const result = await getUserFiles(
            req.user.userId,
            {
                page,
                limit,
                search,
                mimeType,
                sortBy,
                sortOrder
            }
        );

        return res.status(200).json({
            success: true,
            message: "Files retrieved successfully.",
            data: result
        });

    } catch (error) {

        if (error.message === "INVALID_PAGE") {
            return res.status(400).json({
                success: false,
                message: "Page must be a positive integer."
            });
        }

        if (error.message === "INVALID_LIMIT") {
            return res.status(400).json({
                success: false,
                message: "Limit must be between 1 and 100."
            });
        }

        if (error.message === "INVALID_SORT_BY") {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid sortBy. Use name, size, or date."
            });
        }

        if (error.message === "INVALID_SORT_ORDER") {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid sortOrder. Use asc or desc."
            });
        }

        next(error);
    }
}

module.exports = {
    listFiles
};