
const {
    app,
    BrowserWindow,
    dialog,
    ipcMain
} = require("electron");

const path = require("path");
const fs = require("fs");
const fsp = require("fs/promises");
const crypto = require("crypto");
const {
    fileURLToPath
} = require("url");

let mainWindow = null;

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_TOTAL_FILE_SIZE = 100 * 1024 * 1024;

const TOKEN_EXPIRY_MS = 10 * 60 * 1000;

const selectedFiles = new Map();

const PACKAGED_INDEX_PATH = path.resolve(
    __dirname,
    "../frontend/dist/index.html"
);

// --------------------------------------------------
// HASH AND VALIDATION HELPERS
// --------------------------------------------------

function calculateHash(buffer) {
    return crypto
        .createHash("sha256")
        .update(buffer)
        .digest("hex");
}

function isValidHash(value) {
    return (
        typeof value === "string" &&
        /^[a-f0-9]{64}$/i.test(value)
    );
}

function safeCompareHash(first, second) {
    if (!isValidHash(first) || !isValidHash(second)) {
        return false;
    }

    return crypto.timingSafeEqual(
        Buffer.from(first, "hex"),
        Buffer.from(second, "hex")
    );
}

function isSameFileIdentity(first, second) {
    if (!first || !second) {
        return false;
    }

    return (
        first.isFile() &&
        second.isFile() &&
        first.dev === second.dev &&
        first.ino === second.ino &&
        first.size === second.size &&
        first.mtimeMs === second.mtimeMs
    );
}

function isFileNotFound(error) {
    return error?.code === "ENOENT";
}

function isWindowsSafeFileName(fileName) {
    if (
        typeof fileName !== "string" ||
        !fileName.trim() ||
        fileName !== path.basename(fileName) ||
        fileName === "." ||
        fileName === ".." ||
        /[<>:"/\\|?*\x00-\x1F]/.test(fileName) ||
        /[. ]$/.test(fileName)
    ) {
        return false;
    }

    const nameWithoutExtension = fileName
        .split(".")[0]
        .toUpperCase();

    if (
        /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(
            nameWithoutExtension
        )
    ) {
        return false;
    }

    return true;
}

// --------------------------------------------------
// RENDERER TRUST VALIDATION
// --------------------------------------------------

function isTrustedRendererUrl(rawUrl) {
    if (typeof rawUrl !== "string") {
        return false;
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        return false;
    }

    if (app.isPackaged) {
        if (parsedUrl.protocol !== "file:") {
            return false;
        }

        try {
            const rendererPath = path.resolve(
                fileURLToPath(parsedUrl)
            );

            const expectedPath = path.resolve(
                PACKAGED_INDEX_PATH
            );

            const windows = process.platform === "win32";

            return windows
                ? rendererPath.toLowerCase() ===
                    expectedPath.toLowerCase()
                : rendererPath === expectedPath;
        } catch {
            return false;
        }
    }

    return (
        parsedUrl.protocol === "http:" &&
        parsedUrl.hostname === "localhost" &&
        parsedUrl.port === "5173" &&
        parsedUrl.pathname === "/"
    );
}

function assertTrustedRenderer(event) {
    if (
        !mainWindow ||
        mainWindow.isDestroyed() ||
        event.sender !== mainWindow.webContents ||
        event.senderFrame !== event.sender.mainFrame ||
        !isTrustedRendererUrl(event.senderFrame.url)
    ) {
        throw new Error("UNAUTHORIZED_RENDERER");
    }
}

// --------------------------------------------------
// TOKEN MANAGEMENT
// --------------------------------------------------

function cleanupExpiredTokens() {
    const now = Date.now();

    for (const [token, file] of selectedFiles.entries()) {
        if (now - file.createdAt > TOKEN_EXPIRY_MS) {
            selectedFiles.delete(token);
        }
    }
}

function getSelectedFile(token) {
    cleanupExpiredTokens();

    if (
        typeof token !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(token)
    ) {
        throw new Error("INVALID_FILE_TOKEN");
    }

    const selected = selectedFiles.get(token);

    if (!selected) {
        throw new Error("FILE_TOKEN_EXPIRED_OR_INVALID");
    }

    return selected;
}

// --------------------------------------------------
// WINDOW
// --------------------------------------------------

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1000,
        minHeight: 650,
        show: false,
        backgroundColor: "#0f172a",

        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true
        }
    });

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.webContents.setWindowOpenHandler(() => {
        return {
            action: "deny"
        };
    });

    mainWindow.webContents.on(
        "will-navigate",
        (event, navigationUrl) => {
            if (!isTrustedRendererUrl(navigationUrl)) {
                event.preventDefault();
            }
        }
    );

    if (app.isPackaged) {
        mainWindow.loadFile(PACKAGED_INDEX_PATH);
    } else {
        mainWindow.loadURL("http://localhost:5173/");
    }

    mainWindow.on("closed", () => {
        mainWindow = null;
        selectedFiles.clear();
    });
}

// --------------------------------------------------
// 1. NATIVE FILE PICKER
// --------------------------------------------------

ipcMain.handle(
    "securevault:select-files",
    async (event) => {
        assertTrustedRenderer(event);

        const result = await dialog.showOpenDialog(
            mainWindow,
            {
                title: "Select files to hide in SecureVault",
                properties: [
                    "openFile",
                    "multiSelections"
                ]
            }
        );

        if (
            result.canceled ||
            result.filePaths.length === 0
        ) {
            return {
                canceled: true,
                files: []
            };
        }

        if (result.filePaths.length > MAX_FILES) {
            throw new Error("MAX_FILE_COUNT_EXCEEDED");
        }

        const preparedFiles = [];
        let totalSize = 0;

        // Validate every file before creating any tokens.
        for (const selectedPath of result.filePaths) {
            const absolutePath = await fsp.realpath(
                selectedPath
            );

            const stats = await fsp.lstat(absolutePath);

            if (!stats.isFile()) {
                throw new Error("INVALID_SOURCE_FILE");
            }

            if (stats.size > MAX_FILE_SIZE) {
                throw new Error("FILE_SIZE_LIMIT_EXCEEDED");
            }

            totalSize += stats.size;

            if (totalSize > MAX_TOTAL_FILE_SIZE) {
                throw new Error("TOTAL_FILE_SIZE_LIMIT_EXCEEDED");
            }

            preparedFiles.push({
                path: absolutePath,
                name: path.basename(absolutePath),
                size: stats.size,
                dev: stats.dev,
                ino: stats.ino,
                modifiedAt: stats.mtimeMs
            });
        }

        const files = [];

        for (const prepared of preparedFiles) {
            const token = crypto.randomUUID();

            selectedFiles.set(token, {
                ...prepared,
                createdAt: Date.now(),
                verifiedHash: null
            });

            files.push({
                token,
                name: prepared.name,
                size: prepared.size
            });
        }

        return {
            canceled: false,
            files
        };
    }
);

// --------------------------------------------------
// 2. READ SELECTED SOURCE FILE
// --------------------------------------------------

ipcMain.handle(
    "securevault:read-selected-file",
    async (event, token) => {
        assertTrustedRenderer(event);

        const selected = getSelectedFile(token);

        const before = await fsp.lstat(selected.path);

        if (
            !before.isFile() ||
            before.size !== selected.size ||
            before.mtimeMs !== selected.modifiedAt ||
            before.dev !== selected.dev ||
            before.ino !== selected.ino
        ) {
            throw new Error("SOURCE_FILE_CHANGED");
        }

        if (before.size > MAX_FILE_SIZE) {
            throw new Error("FILE_SIZE_LIMIT_EXCEEDED");
        }

        const buffer = await fsp.readFile(selected.path);

        const after = await fsp.lstat(selected.path);

        if (
            !after.isFile() ||
            after.size !== selected.size ||
            after.mtimeMs !== selected.modifiedAt ||
            after.dev !== selected.dev ||
            after.ino !== selected.ino ||
            buffer.length !== selected.size
        ) {
            throw new Error("SOURCE_FILE_CHANGED");
        }

        const hash = calculateHash(buffer);

        selected.verifiedHash = hash;

        return {
            name: selected.name,
            size: buffer.length,
            hash,
            bytes: new Uint8Array(buffer)
        };
    }
);

// --------------------------------------------------
// 3. RESTORE SOURCE IF QUARANTINE VERIFICATION FAILS
// --------------------------------------------------

async function restoreQuarantinedSource(
    quarantinePath,
    originalPath
) {
    try {
        await fsp.lstat(originalPath);

        // Never overwrite a file that appeared at the
        // original location after the source was moved.
        return false;
    } catch (error) {
        if (!isFileNotFound(error)) {
            return false;
        }
    }

    try {
        await fsp.rename(
            quarantinePath,
            originalPath
        );

        return true;
    } catch {
        return false;
    }
}

// --------------------------------------------------
// 4. REMOVE ORIGINAL ONLY AFTER VERIFICATION
// --------------------------------------------------

ipcMain.handle(
    "securevault:remove-verified-source",
    async (event, payload) => {
        assertTrustedRenderer(event);

        if (
            !payload ||
            typeof payload !== "object" ||
            Array.isArray(payload)
        ) {
            throw new Error("INVALID_VERIFICATION_DATA");
        }

        const {
            token,
            expectedHash
        } = payload;

        if (!isValidHash(expectedHash)) {
            throw new Error("INVALID_VERIFICATION_DATA");
        }

        const selected = getSelectedFile(token);

        if (
            !selected.verifiedHash ||
            !safeCompareHash(
                selected.verifiedHash,
                expectedHash
            )
        ) {
            throw new Error("UPLOAD_HASH_VERIFICATION_FAILED");
        }

        const before = await fsp.lstat(selected.path);

        if (
            !before.isFile() ||
            before.size !== selected.size ||
            before.mtimeMs !== selected.modifiedAt ||
            before.dev !== selected.dev ||
            before.ino !== selected.ino
        ) {
            throw new Error("SOURCE_FILE_CHANGED");
        }

        const currentBuffer = await fsp.readFile(
            selected.path
        );

        if (
            !safeCompareHash(
                calculateHash(currentBuffer),
                expectedHash
            )
        ) {
            throw new Error("SOURCE_FILE_INTEGRITY_FAILED");
        }

        // Move to a unique temporary name first.
        // The moved file is verified again before deletion.
        const quarantinePath = path.join(
            path.dirname(selected.path),
            `.${path.basename(selected.path)}.${crypto.randomUUID()}.securevault-pending`
        );

        await fsp.rename(
            selected.path,
            quarantinePath
        );

        try {
            const quarantinedStats = await fsp.lstat(
                quarantinePath
            );

            if (
                !isSameFileIdentity(
                    before,
                    quarantinedStats
                ) ||
                quarantinedStats.dev !== selected.dev ||
                quarantinedStats.ino !== selected.ino
            ) {
                throw new Error("SOURCE_FILE_CHANGED");
            }

            const quarantinedBuffer = await fsp.readFile(
                quarantinePath
            );

            if (
                !safeCompareHash(
                    calculateHash(quarantinedBuffer),
                    expectedHash
                )
            ) {
                throw new Error("SOURCE_FILE_INTEGRITY_FAILED");
            }

            await fsp.unlink(quarantinePath);

            selectedFiles.delete(token);

            return {
                success: true,
                removed: true
            };
        } catch (error) {
            const restored = await restoreQuarantinedSource(
                quarantinePath,
                selected.path
            );

            if (!restored) {
                throw new Error(
                    "SOURCE_QUARANTINE_RECOVERY_REQUIRED"
                );
            }

            throw error;
        }
    }
);

// --------------------------------------------------
// 5. SAVE RESTORED FILE USING NATIVE SAVE DIALOG
// --------------------------------------------------

ipcMain.handle(
    "securevault:save-restored-file",
    async (event, payload) => {
        assertTrustedRenderer(event);

        if (
            !payload ||
            typeof payload !== "object" ||
            Array.isArray(payload)
        ) {
            throw new Error("INVALID_RESTORE_DATA");
        }

        const {
            fileName,
            bytes,
            expectedHash
        } = payload;

        if (!isWindowsSafeFileName(fileName)) {
            throw new Error("INVALID_FILE_NAME");
        }

        if (
            !(bytes instanceof Uint8Array) ||
            bytes.byteLength > MAX_FILE_SIZE ||
            !isValidHash(expectedHash)
        ) {
            throw new Error("INVALID_RESTORE_DATA");
        }

        const buffer = Buffer.from(bytes);

        if (
            !safeCompareHash(
                calculateHash(buffer),
                expectedHash
            )
        ) {
            throw new Error("RESTORED_FILE_HASH_MISMATCH");
        }

        const result = await dialog.showSaveDialog(
            mainWindow,
            {
                title: "Restore file from SecureVault",
                defaultPath: fileName
            }
        );

        if (result.canceled || !result.filePath) {
            return {
                canceled: true,
                saved: false
            };
        }

        const destination = path.resolve(
            result.filePath
        );

        const temporaryPath = path.join(
            path.dirname(destination),
            `.${path.basename(destination)}.${crypto.randomUUID()}.tmp`
        );

        try {
            // Create a unique temporary file.
            await fsp.writeFile(
                temporaryPath,
                buffer,
                {
                    flag: "wx",
                    mode: 0o600
                }
            );

            // Verify the temporary file before copying.
            const temporaryBuffer = await fsp.readFile(
                temporaryPath
            );

            if (
                !safeCompareHash(
                    calculateHash(temporaryBuffer),
                    expectedHash
                )
            ) {
                throw new Error("SAVED_FILE_VERIFICATION_FAILED");
            }

            // Exclusive copy prevents overwriting a destination
            // that already exists, including a concurrent creation.
            await fsp.copyFile(
                temporaryPath,
                destination,
                fs.constants.COPYFILE_EXCL
            );

            const savedBuffer = await fsp.readFile(
                destination
            );

            if (
                !safeCompareHash(
                    calculateHash(savedBuffer),
                    expectedHash
                )
            ) {
                throw new Error("SAVED_FILE_VERIFICATION_FAILED");
            }

            return {
                canceled: false,
                saved: true,
                verified: true
            };
        } finally {
            await fsp.unlink(temporaryPath).catch(() => {});
        }
    }
);

// --------------------------------------------------
// APPLICATION LIFECYCLE
// --------------------------------------------------

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    selectedFiles.clear();

    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("before-quit", () => {
    selectedFiles.clear();
});
