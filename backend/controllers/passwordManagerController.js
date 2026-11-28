
const passwordManagerService = require("../services/passwordManagerService");

function sendError(res, error) {
    const message = error?.message || "INTERNAL_SERVER_ERROR";

    if (
        message.startsWith("INVALID_") ||
        message === "WEBSITE_NAME_REQUIRED" ||
        message === "ACCOUNT_IDENTIFIER_REQUIRED" ||
        message === "PASSWORD_REQUIRED"
    ) {
        return res.status(400).json({
            success: false,
            message
        });
    }

    if (message === "CREDENTIAL_NOT_FOUND") {
        return res.status(404).json({
            success: false,
            message: "Credential not found."
        });
    }

    console.error("Password Manager API error:", message);

    return res.status(500).json({
        success: false,
        message: "Password Manager request could not be completed."
    });
}

function isValidCredentialId(value) {
    return typeof value === "string" && /^\d{1,20}$/.test(value);
}

async function listCredentials(req, res) {
    try {
        const credentials = await passwordManagerService.listCredentials(
            req.user.userId
        );

        return res.status(200).json({
            success: true,
            credentials
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function createCredential(req, res) {
    try {
        const {
            websiteName,
            websiteUrl,
            accountIdentifier,
            password
        } = req.body || {};

        if (
            typeof websiteName !== "string" ||
            !websiteName.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "WEBSITE_NAME_REQUIRED"
            });
        }

        if (
            websiteUrl !== undefined &&
            websiteUrl !== null &&
            typeof websiteUrl !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "INVALID_WEBSITE_URL"
            });
        }

        if (
            typeof accountIdentifier !== "string" ||
            !accountIdentifier.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "ACCOUNT_IDENTIFIER_REQUIRED"
            });
        }

        if (
            typeof password !== "string" ||
            password.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "PASSWORD_REQUIRED"
            });
        }

        const result = await passwordManagerService.createCredential(
            req.user.userId,
            {
                websiteName: websiteName.trim(),
                websiteUrl,
                accountIdentifier: accountIdentifier.trim(),
                password
            },
            req
        );

        if (result.status === "update_confirmation_required") {
            return res.status(409).json({
                success: false,
                status: result.status,
                message: "An account already exists with a different password. Confirm the password update before replacing it.",
                credentialId: result.credentialId
            });
        }

        if (result.status === "already_saved") {
            return res.status(200).json({
                success: true,
                status: result.status,
                message: "This account is already saved."
            });
        }

        return res.status(201).json({
            success: true,
            status: result.status,
            message: "Credential saved successfully.",
            credentialId: result.credentialId
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function revealCredential(req, res) {
    try {
        const { credentialId } = req.params;

        if (!isValidCredentialId(credentialId)) {
            return res.status(400).json({
                success: false,
                message: "INVALID_CREDENTIAL_ID"
            });
        }

        const password = await passwordManagerService.revealCredential(
            req.user.userId,
            credentialId,
            req
        );

        return res.status(200).json({
            success: true,
            password
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function updateCredentialPassword(req, res) {
    try {
        const { credentialId } = req.params;
        const {
            password,
            confirmPasswordUpdate
        } = req.body || {};

        if (!isValidCredentialId(credentialId)) {
            return res.status(400).json({
                success: false,
                message: "INVALID_CREDENTIAL_ID"
            });
        }

        if (confirmPasswordUpdate !== true) {
            return res.status(400).json({
                success: false,
                message: "PASSWORD_UPDATE_CONFIRMATION_REQUIRED"
            });
        }

        if (
            typeof password !== "string" ||
            password.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "PASSWORD_REQUIRED"
            });
        }

        await passwordManagerService.updateCredentialPassword(
            req.user.userId,
            credentialId,
            password,
            req
        );

        return res.status(200).json({
            success: true,
            message: "Password updated successfully."
        });
    } catch (error) {
        return sendError(res, error);
    }
}

async function deleteCredential(req, res) {
    try {
        const { credentialId } = req.params;

        if (!isValidCredentialId(credentialId)) {
            return res.status(400).json({
                success: false,
                message: "INVALID_CREDENTIAL_ID"
            });
        }

        await passwordManagerService.deleteCredential(
            req.user.userId,
            credentialId,
            req
        );

        return res.status(200).json({
            success: true,
            message: "Credential deleted successfully."
        });
    } catch (error) {
        return sendError(res, error);
    }
}

module.exports = {
    listCredentials,
    createCredential,
    revealCredential,
    updateCredentialPassword,
    deleteCredential
};
