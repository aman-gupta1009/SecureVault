
const {
    contextBridge,
    ipcRenderer
} = require("electron");

// --------------------------------------------------
// IPC VALIDATION
// --------------------------------------------------

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOKEN_LENGTH = 100;

function isValidToken(token) {
    return (
        typeof token === "string" &&
        token.length <= MAX_TOKEN_LENGTH &&
        /^[a-f0-9-]{36}$/i.test(token)
    );
}

function isValidHash(hash) {
    return (
        typeof hash === "string" &&
        /^[a-f0-9]{64}$/i.test(hash)
    );
}

// --------------------------------------------------
// RESTRICTED SECUREVAULT API
// --------------------------------------------------

contextBridge.exposeInMainWorld(
    "secureVault",
    {
        // Open native file picker.
        selectFiles: () => {
            return ipcRenderer.invoke(
                "securevault:select-files"
            );
        },

        // Read a previously selected local file.
        readSelectedFile: (token) => {
            if (!isValidToken(token)) {
                throw new Error("INVALID_FILE_TOKEN");
            }

            return ipcRenderer.invoke(
                "securevault:read-selected-file",
                token
            );
        },

        // Remove the original source only after
        // backend hash verification.
        removeVerifiedSource: (
            token,
            expectedHash
        ) => {
            if (
                !isValidToken(token) ||
                !isValidHash(expectedHash)
            ) {
                throw new Error("INVALID_VERIFICATION_DATA");
            }

            return ipcRenderer.invoke(
                "securevault:remove-verified-source",
                {
                    token,
                    expectedHash
                }
            );
        },

        // Save restored file through the native dialog.
        saveRestoredFile: (
            fileName,
            bytes,
            expectedHash
        ) => {
            if (
                typeof fileName !== "string" ||
                fileName.length === 0 ||
                fileName.length > 255 ||
                !(bytes instanceof Uint8Array) ||
                bytes.byteLength > MAX_FILE_SIZE ||
                !isValidHash(expectedHash)
            ) {
                throw new Error("INVALID_RESTORE_DATA");
            }

            return ipcRenderer.invoke(
                "securevault:save-restored-file",
                {
                    fileName,
                    bytes,
                    expectedHash
                }
            );
        }
    }
);
