# SecureVault

**SecureVault** is a secure file-locker application designed to help
users store, organize, protect, and back up their personal files in a
controlled workspace. The project combines a React-based user interface,
a Node.js/Express backend, a MySQL database, and an Electron desktop
shell.

The application is being developed with a focus on practical file
security, account protection, vault access control, backup integrity,
and a straightforward desktop experience.

> **Project status:** SecureVault is under active development. Some
> modules are implemented and connected to backend services, while other
> screens and capabilities are still being refined. This README
> distinguishes current functionality from planned work wherever
> possible.

------------------------------------------------------------------------

## Table of Contents

-   [Project Overview](#project-overview)
-   [Objectives](#objectives)
-   [Key Features](#key-features)
-   [Application Modules](#application-modules)
-   [Technology Stack](#technology-stack)
-   [Architecture](#architecture)
-   [Project Structure](#project-structure)
-   [Prerequisites](#prerequisites)
-   [Installation and Setup](#installation-and-setup)
-   [Environment Configuration](#environment-configuration)
-   [Running the Application](#running-the-application)
-   [Application Access](#application-access)
-   [Backend API Overview](#backend-api-overview)
-   [Security Design](#security-design)
-   [Backup and Recovery](#backup-and-recovery)
-   [Vault File Workflow](#vault-file-workflow)
-   [Development Notes](#development-notes)
-   [Troubleshooting](#troubleshooting)
-   [Roadmap](#roadmap)
-   [Limitations and Responsible Use](#limitations-and-responsible-use)
-   [Contributing](#contributing)
-   [License](#license)
-   [Author](#author)

------------------------------------------------------------------------

## Project Overview

Personal files often contain sensitive information, and keeping them in
ordinary folders can make access control, secure storage, and recovery
difficult to manage. SecureVault aims to provide a single application in
which users can authenticate, unlock a protected vault, manage stored
files, and create backups.

SecureVault uses a client-server structure:

1.  The **React frontend** provides the user interface.
2.  The **Express backend** handles authentication, vault operations,
    file management, security checks, and backup requests.
3.  **MySQL** stores application records and metadata.
4.  The **Electron desktop application** provides a desktop entry point
    and controlled communication between the desktop shell and the
    application.

The application is designed around a separate vault-locking workflow.
Signing in to the application and unlocking the vault are treated as
distinct actions.

## Objectives

The main objectives of SecureVault are to:

-   Provide authenticated access to a personal file-management
    workspace.
-   Separate account authentication from vault unlocking.
-   Support protected file upload, listing, preview, download, and
    deletion workflows.
-   Reduce unauthorized access through session controls and rate
    limiting.
-   Support backup creation and integrity verification.
-   Provide a consistent desktop-oriented experience.
-   Keep security-sensitive operations on the backend rather than
    exposing direct filesystem access to the renderer.
-   Build a foundation that can be extended with recovery, sharing,
    device management, and additional security features.

## Key Features

The following list describes the project's feature areas. Availability
may differ by module and development stage.

### Account and Authentication

-   User registration and email OTP verification.
-   Login and logout.
-   Session-based authentication using an HTTP-only cookie.
-   Logout from all sessions.
-   Forgot-password and password-reset OTP workflows.
-   Account-state checks, including email-verification and
    account-status checks.
-   Login-attempt tracking and temporary lockout logic.

### Secure Vault

-   Separate vault lock and unlock workflow.
-   Vault status endpoint.
-   File upload with a configured multi-file limit.
-   File listing with pagination, search, and sorting parameters.
-   File count retrieval.
-   File preview and restore/download workflows.
-   File deletion workflow.
-   Automatic vault inactivity lock.

### File Management

The file workspace is intended to support common file-management
operations, including:

-   Uploading multiple files.
-   Browsing stored files.
-   Searching and sorting file records.
-   Previewing supported file types.
-   Restoring files to a user-selected location.
-   Organizing files by category and type.

Preview support depends on the file format and the viewer implementation
available in the current build. A preview is not the same as converting
or modifying the original stored file.

### Backup System

-   Backup creation workflow.
-   Backup listing.
-   Backup status tracking.
-   Backup completion records.
-   Integrity verification metadata.
-   Restore-related functionality as the backup workflow is developed.

The development environment has returned completed backup records with
integrity marked as verified. Actual backup behavior should always be
validated against the current application build and the selected backup
destination.

### Security and Account Protection

-   Helmet-based HTTP security headers.
-   CORS configuration.
-   Request rate limiting.
-   Password hashing using Argon2.
-   Cookie-based session handling.
-   Vault inactivity timeout.
-   Session cleanup support.
-   Security-related API routes.

### Desktop Application

-   Electron desktop shell.
-   Preload-based communication between Electron's main and renderer
    processes.
-   Restricted exposure of approved desktop operations through
    `contextBridge`.
-   Native file-picker integration where implemented.

The renderer should not receive unrestricted Node.js or filesystem
access. Desktop operations should be exposed deliberately through the
preload layer.

### Appearance and Workspace

-   Workspace dashboard and sidebar navigation.
-   Dark and light appearance modes.
-   Additional theme choices are part of the appearance work in
    progress.
-   Dedicated pages for files, backups, password management,
    notifications, and devices/sessions.

A visible page or card does not necessarily mean its backend workflow is
complete. Refer to the current implementation before relying on a module
for sensitive operations.

------------------------------------------------------------------------

## Application Modules

  -----------------------------------------------------------------------
  Module                  Purpose                 Development status
  ----------------------- ----------------------- -----------------------
  Authentication          Registration, OTP       Backend workflows
                          verification, login,    implemented; continue
                          logout, and password    testing email and
                          recovery                recovery flows

  Vault                   Lock, unlock, status,   Implemented; test
                          and inactivity          against the configured
                          protection              timeout

  Files                   Upload, list, search,   Core workflows
                          preview, restore, and   implemented; preview
                          delete                  support varies by
                                                  format

  Backups                 Create and view backup  Backup workflows
                          records; verify         implemented and under
                          integrity               active refinement

  Password Manager        Manage saved            UI/module work; verify
                          credentials and related backend integration
                          tools                   before storing real
                                                  credentials

  Notifications           Display security and    UI and integration work
                          application alerts      in progress

  Devices & Sessions      Review and manage       Backend/API integration
                          active sessions/devices exists; verify each
                                                  action in the current
                                                  build

  Smart Organization      Browse files by         Workspace functionality
                          category                being developed

  Secure Sharing          Controlled file sharing Planned/in-progress
                          and permissions         

  Settings                Appearance and          UI/preferences work in
                          workspace preferences   progress
  -----------------------------------------------------------------------

**Status convention:** "Implemented" means a corresponding workflow
exists in the project; it does not imply that every edge case, security
review, or production deployment requirement has been completed.

------------------------------------------------------------------------

## Technology Stack

### Frontend

-   React
-   JavaScript
-   Tailwind CSS
-   CSS
-   Vite

### Backend

-   Node.js
-   Express.js
-   CommonJS modules
-   MySQL 8
-   `mysql2`
-   `argon2`
-   `cookie-parser`
-   `cors`
-   `dotenv`
-   `express-rate-limit`
-   `helmet`
-   `nodemailer`
-   `zod`

### Desktop

-   Electron
-   Electron preload scripts
-   `contextBridge`
-   `ipcRenderer`

### Development Tools

-   Visual Studio Code
-   Git and GitHub
-   PowerShell / Windows Terminal
-   MySQL Server
-   Postman or another HTTP API client

------------------------------------------------------------------------

## Architecture

SecureVault follows a layered architecture.

``` text
+--------------------------------------------------+
|                Electron Desktop Shell            |
|        Main Process / Preload / IPC Bridge       |
+--------------------------+-----------------------+
                           |
                           v
+--------------------------------------------------+
|                 React Frontend                   |
|  Dashboard | Files | Backups | Security | Settings|
+--------------------------+-----------------------+
                           |
                    HTTP API Requests
                    credentials: include
                           |
                           v
+--------------------------------------------------+
|              Node.js / Express Backend           |
|                                                  |
| Auth Routes       Vault Routes                    |
| Security Routes   Backup Routes                   |
| Share Routes      Session / Lock Services         |
| Controllers       Middleware                      |
+--------------------------+-----------------------+
                           |
                           v
+--------------------------------------------------+
|                    MySQL 8                       |
|       Users | Sessions | Vault Metadata          |
|       Backups | Security / Application Records   |
+--------------------------------------------------+
```

### Request Flow

1.  The user interacts with the React interface.
2.  The frontend sends an HTTP request to the backend API.
3.  The browser/Electron renderer includes session credentials where
    required.
4.  Express middleware applies the relevant authentication, validation,
    rate-limit, and security checks.
5.  A route/controller performs the requested operation.
6.  The backend reads or updates the database and performs the relevant
    file operation.
7.  The API returns a response to the frontend.
8.  The frontend updates the visible state.

### Desktop Security Boundary

Electron's main process is responsible for privileged desktop
operations. The preload script exposes only explicitly approved
functions to the renderer. Avoid adding broad APIs such as unrestricted
filesystem access or direct Node.js access to the renderer.

------------------------------------------------------------------------

## Project Structure

The repository is organized into frontend, backend, and Electron-related
code. The exact tree may change as modules are added.

``` text
SecureVault/
|
+-- backend/
|   +-- controllers/
|   +-- middleware/
|   +-- routes/
|   |   +-- authRoutes.js
|   |   +-- backupRoutes.js
|   |   +-- healthRoutes.js
|   |   +-- securityRoutes.js
|   |   +-- sharedFileRoutes.js
|   |   +-- shareRoutes.js
|   |   +-- vaultLockRoutes.js
|   |   +-- vaultRoutes.js
|   +-- services/
|   +-- storage/
|   +-- server.js
|
+-- frontend/
|   +-- src/
|       +-- components/
|       +-- pages/
|       +-- context/
|       +-- styles/
|
+-- electron/
|   +-- main process files
|   +-- preload files
|
+-- .env                 # Local secrets; do not commit
+-- .gitignore
+-- package.json
+-- README.md
```

> This is a conceptual overview, not a guaranteed file-by-file
> inventory. Use the actual repository tree as the source of truth for
> filenames and folders in your local checkout.

------------------------------------------------------------------------

## Prerequisites

Install the following before running the project:

1.  **Node.js and npm**\
    The project has been developed in a Windows environment using
    Node.js 24.11.1. Use a currently supported Node.js release
    compatible with the dependencies in `package.json`.

2.  **MySQL Server 8.0**\
    Install and start MySQL Server. Make sure the MySQL service is
    running before starting the backend.

3.  **Git**\
    Required to clone the repository and manage source changes.

4.  **Visual Studio Code**\
    Recommended editor for development.

5.  **Windows 10/11**\
    The documented development workflow uses Windows PowerShell.

Check the installed versions:

``` powershell
node --version
npm --version
git --version
```

Check that MySQL is available using your MySQL installation's
command-line client.

------------------------------------------------------------------------

## Installation and Setup

### 1. Clone the repository

``` powershell
git clone https://github.com/aman-gupta1009/SecureVault.git
cd SecureVault
```

### 2. Install dependencies

If the root `package.json` manages the development processes:

``` powershell
npm install
```

If dependencies are maintained separately in the frontend and backend
folders, install them in those folders as well:

``` powershell
cd backend
npm install
cd ..

cd frontend
npm install
cd ..
```

Install dependencies in the Electron folder only if it has its own
`package.json`.

### 3. Create the MySQL database

Open MySQL and create the database:

``` sql
CREATE DATABASE secure_vault;
```

The database name used in the development setup is `secure_vault`. The
application may require additional tables and schema initialization. Use
the SQL schema or migration files present in the repository; do not
assume that creating the database alone creates all required tables.

### 4. Configure environment variables

The backend loads environment configuration from the project root `.env`
file in the current setup.

Create a `.env` file in the root directory. Use the variable names
expected by the backend's database, mail, and session configuration. A
typical configuration may look like this:

``` env
PORT=4000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=secure_vault

# Use a long, random secret if the application configuration requires one.
SESSION_SECRET=replace_with_a_long_random_secret

# Configure mail settings if OTP email delivery is enabled.
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=your_verified_sender_address
```

**Important environment notes:**

-   The example above is a template. Confirm the exact variable names in
    the backend configuration before using it.
-   Replace every example value with your own local configuration.
-   Do not commit `.env` to GitHub.
-   Never put database passwords, SMTP credentials, session secrets, or
    OTP secrets in frontend code.
-   If your project uses a different database username or mail provider,
    configure the corresponding values.
-   The backend's configured frontend origin must match the URL used by
    Vite.

### 5. Confirm the database connection

Start MySQL Server, then start the backend. Check the terminal output
for a successful database connection. If the backend reports that the
database does not exist, verify the database name and create the
database before continuing.

------------------------------------------------------------------------

## Running the Application

### Recommended: Start all development processes

From the project root:

``` powershell
npm run dev
```

The root development script is configured to start the backend,
frontend, and Electron processes together.

### Start the backend separately

``` powershell
npm run dev --prefix backend
```

The backend development server uses port `4000` in the current local
setup.

### Start the frontend separately

``` powershell
npm run dev --prefix frontend
```

The Vite development server uses port `5173` in the current local setup.

### Start Electron separately

Use the Electron script defined in the root or Electron `package.json`.
For example, the root development setup may expose a script named
`dev:electron`:

``` powershell
npm run dev:electron
```

Check `package.json` for the exact available script names.

------------------------------------------------------------------------

## Application Access

In the current local development configuration:

  Service        Address
  -------------- ------------------------------------
  Frontend       `http://localhost:5173`
  Backend        `http://localhost:4000`
  Health check   `http://localhost:4000/api/health`

The frontend communicates with the backend through the `/api` base path.
Requests that require a logged-in session should include credentials.

Example frontend request:

``` javascript
fetch("http://localhost:4000/api/auth/me", {
  method: "GET",
  credentials: "include",
});
```

The current session cookie name is `securevault_session`. Cookie
settings, CORS configuration, and frontend origin must remain compatible
for session-based requests to work.

------------------------------------------------------------------------

## Backend API Overview

The backend groups related functionality into route modules. The
following paths reflect the current route mounting structure discussed
during development.

  -----------------------------------------------------------------------
  API base path                       Responsibility
  ----------------------------------- -----------------------------------
  `/api/health`                       Backend health check

  `/api/auth`                         Registration, OTP, login,
                                      profile/session, logout, and
                                      password recovery

  `/api/security`                     Security-related operations

  `/api/vault`                        Vault status, unlock, file upload,
                                      listing, and file operations

  `/api/shares`                       Sharing-related operations

  `/api/shares/access`                Shared-file access workflow with
                                      rate limiting

  `/api/backups`                      Backup operations

  `/api/vault-lock`                   Vault-lock-related operations
  -----------------------------------------------------------------------

### Authentication endpoints

The authentication route module includes workflows for:

-   Registering a user.
-   Verifying a registration OTP.
-   Resending an OTP.
-   Logging in.
-   Retrieving the current authenticated user.
-   Logging out.
-   Logging out from all sessions.
-   Requesting a password-reset OTP.
-   Verifying the password-reset OTP.
-   Resetting the password.

### Vault endpoints

The vault route module includes workflows such as:

-   Retrieving vault status.
-   Unlocking the vault.
-   Locking the vault.
-   Uploading files.
-   Listing files.
-   Retrieving file counts.
-   Previewing or restoring files.
-   Deleting files.

The file listing route is under `/api/vault/files`; `/api/files` is not
the configured route in the current implementation.

The upload endpoint is configured to accept up to 10 files in a single
request in the current setup.

### Health check

Use the health endpoint to check whether the backend is responding:

``` powershell
Invoke-RestMethod -Uri "http://localhost:4000/api/health" -Method Get
```

> For exact request bodies, query parameters, response shapes, and
> authorization requirements, refer to the route and controller files in
> the current repository. Do not assume that every route listed above is
> available without authentication.

------------------------------------------------------------------------

## Security Design

Security is a core design concern in SecureVault. The current
implementation uses several layers of protection.

### Password hashing

The backend uses **Argon2** for password hashing. Passwords should never
be stored as plain text. Password verification should be performed on
the backend.

### Session handling

The application uses cookie-based session handling. The frontend sends
requests with credentials enabled when a session is required.

Session security depends on the cookie configuration, including
appropriate `HttpOnly`, `SameSite`, and `Secure` settings for the
deployment environment. Production settings must be reviewed separately
from local development settings.

### OTP verification

Email OTP workflows are used for registration verification and password
recovery. The current development configuration includes:

-   OTP expiry: 10 minutes.
-   Maximum verification attempts: 5.
-   Resend cooldown: 60 seconds.

These limits should be enforced on the server. An OTP should not be
treated as a replacement for a strong password or secure session
management.

### Rate limiting

Rate limiting is used to reduce repeated requests against sensitive
endpoints. Authentication and shared-file access routes should retain
appropriate rate-limit protection.

### Security headers and CORS

-   Helmet is used to configure HTTP security headers.
-   CORS is configured to permit the frontend origin.
-   Credentialed requests require a compatible, explicit origin
    configuration.

Do not use a wildcard origin with credentialed browser requests.

### Vault inactivity lock

The development setup has an automatic vault-lock timeout configured to
2 minutes. The timeout should be verified against the current
environment configuration and tested during development.

### Electron process isolation

Electron should use context isolation and a restricted preload API. Keep
privileged operations in the main process and expose only the minimum
functions needed by the renderer.

### Security checklist before deployment

-   [ ] Use HTTPS in production.
-   [ ] Use strong, unique secrets.
-   [ ] Use production-safe cookie settings.
-   [ ] Restrict CORS to trusted origins.
-   [ ] Keep dependencies updated.
-   [ ] Validate and sanitize user input.
-   [ ] Enforce authorization on the backend for every protected
    resource.
-   [ ] Avoid logging passwords, OTP values, session tokens, or
    sensitive file contents.
-   [ ] Protect uploaded files from path traversal and unsafe file
    handling.
-   [ ] Verify backup access controls and restore behavior.
-   [ ] Review Electron security settings and preload exposure.
-   [ ] Test authentication, lockout, session expiry, and vault
    auto-lock behavior.

------------------------------------------------------------------------

## Backup and Recovery

The backup module is intended to help users create recoverable copies of
vault data and verify backup integrity.

A backup workflow generally includes:

1.  The user initiates a backup.
2.  The backend validates the request and relevant vault state.
3.  The backup service processes the selected data.
4.  A backup record is updated with its status.
5.  Integrity verification is performed.
6.  The result is made available to the application.

The development environment has produced completed backup records with
integrity status reported as `VERIFIED`. This is development evidence,
not a guarantee that every backup/restore scenario is production-ready.

### Backup safety recommendations

-   Store backups in a location separate from the primary data.
-   Restrict access to backup files.
-   Do not commit backup archives or sensitive storage folders to Git.
-   Test restoration regularly.
-   Verify file hashes or other integrity checks after restore.
-   Keep more than one recovery copy for important data.
-   Document the recovery process before using the application for
    critical files.

------------------------------------------------------------------------

## Vault File Workflow

The file workflow is designed around a locked/unlocked vault state.

A typical workflow is:

1.  Sign in to SecureVault.
2.  Check the vault status.
3.  Unlock the vault when required.
4.  Upload files or browse existing files.
5.  Preview supported file formats.
6.  Restore/download a file when needed.
7.  Lock the vault or allow the inactivity timeout to lock it.

The frontend currently uses the backend API base URL
`http://localhost:4000/api` by default and sends session credentials
with requests.

### File preview notes

Preview support depends on the file type and the installed viewer
libraries. Some formats may open directly, while others may require a
dedicated viewer. Preview functionality should not silently alter the
original stored file.

------------------------------------------------------------------------

## Development Notes

### Useful commands

``` powershell
# Install root dependencies
npm install

# Start the complete development environment
npm run dev

# Start backend only
npm run dev --prefix backend

# Start frontend only
npm run dev --prefix frontend

# Check a JavaScript file for syntax errors
node --check backend/server.js

# Check Git working tree
git status

# View recent commits
git log --oneline -5
```

The exact scripts available depend on the current `package.json` files.

### Git workflow

Check changed files:

``` powershell
git status
```

Stage changes:

``` powershell
git add .
```

Commit changes:

``` powershell
git commit -m "Update SecureVault documentation"
```

Push to the configured remote:

``` powershell
git push origin master
```

Before pushing, review staged changes and confirm that `.env`, database
dumps, user uploads, generated backups, and other sensitive files are
excluded.

### Important `.gitignore` entries

The repository should exclude at least:

``` gitignore
node_modules/
.env
*.log

storage/temp/*
storage/quarantine/*
storage/encrypted/*

backend/storage/
```

Adjust these entries to the actual storage layout. Do not ignore source
code, migrations, or configuration templates that are safe and necessary
to build the project.

------------------------------------------------------------------------

## Troubleshooting

### 1. Backend reports "Unknown database"

Confirm that MySQL Server is running and that the configured database
exists:

``` sql
CREATE DATABASE secure_vault;
```

Then verify the database name, username, password, and port in the local
environment configuration.

### 2. Frontend cannot connect to the backend

-   Confirm that the backend is running on port `4000`.
-   Confirm that the frontend is using the correct API base URL.
-   Check the backend CORS origin.
-   Ensure credentialed requests use `credentials: "include"` where
    required.
-   Inspect the browser developer console and backend terminal.

### 3. API returns `404 Route not found`

Check the route prefix and HTTP method. For example, the file listing
endpoint is under:

``` text
/api/vault/files
```

It is not mounted at `/api/files` in the current route structure.

### 4. API returns `423 Locked`

A `423 Locked` response can mean that the vault is currently locked.
Check the vault status and complete the unlock workflow before
requesting protected file operations.

### 5. Login works but protected requests fail

-   Confirm that the browser is accepting the session cookie.
-   Confirm that the frontend sends credentials.
-   Check cookie and CORS configuration.
-   Confirm that the session has not expired or been revoked.
-   Verify that the backend is using the expected session store and
    database.

### 6. OTP email is not received

-   Verify SMTP host, port, username, and password.
-   Check the sender address and mail-provider restrictions.
-   Check spam/junk folders.
-   Review backend logs without exposing OTP values or credentials.
-   Confirm that the mail configuration variable names match the backend
    code.

### 7. Preview is blank or unsupported

-   Confirm that the file was retrieved successfully.
-   Check the browser console for viewer errors.
-   Verify that the relevant viewer package is installed.
-   Test with a known-good sample file of the same format.
-   Keep preview handling separate from the original file
    restore/download path.

### 8. Electron window does not open

-   Confirm that Electron dependencies are installed.
-   Check the Electron script in `package.json`.
-   Verify that the configured frontend development URL is running.
-   Inspect the Electron main-process terminal for startup errors.
-   Confirm that the preload path exists and is correctly configured.

------------------------------------------------------------------------

## Roadmap

The following items represent planned or continuing development. Their
presence here does not mean they are already complete.

### Core security improvements

-   Complete security testing for authentication and vault access.
-   Refine session protection and device management.
-   Improve key management and key-rotation workflows.
-   Strengthen recovery and account-protection flows.
-   Add more comprehensive audit and activity records.

### File management

-   Improve preview support for additional formats.
-   Refine file categorization and smart organization.
-   Improve multi-file workflows and restore validation.
-   Add clearer file-operation status and error reporting.

### Backup system

-   Improve backup scheduling and retention controls.
-   Complete and test restore workflows.
-   Improve backup verification and failure recovery.
-   Add clearer backup history and reporting.

### Sharing and collaboration

-   Complete protected file-sharing workflows.
-   Add permission and expiry controls.
-   Improve shared-file access validation and auditing.

### Desktop and future platform work

-   Continue hardening the Electron application.
-   Improve desktop-native file workflows.
-   Evaluate a future Flutter mobile application.
-   Explore biometric authentication and offline-vault capabilities
    where technically and securely appropriate.

------------------------------------------------------------------------

## Limitations and Responsible Use

SecureVault is an actively developed project and should not yet be
treated as a fully audited, production-grade security product.

Before storing important or sensitive information:

-   Test the exact version you are using.
-   Keep independent backups.
-   Confirm that restore operations work.
-   Do not rely on UI-only controls for security; authorization must be
    enforced by the backend.
-   Do not store real credentials in modules that are still UI previews
    or not connected to secure storage.
-   Do not expose the development server directly to the public
    internet.
-   Review encryption, key storage, file permissions, and recovery
    procedures before production use.

Security claims should be based on verified implementation and testing,
not only on feature names or interface labels.

------------------------------------------------------------------------

## Contributing

This is a developing project. Contributions and suggestions should focus
on reliability, maintainability, usability, and security.

A useful contribution process is:

1.  Create a separate branch for the change.
2.  Keep changes focused.
3.  Validate the affected frontend and backend workflows.
4.  Run syntax checks and relevant tests.
5.  Review logs and error handling.
6.  Ensure secrets and private data are not included.
7.  Submit a clear description of the change.

------------------------------------------------------------------------

## License

No license information has been confirmed in this README. Unless a
license file is added to the repository, the project should not be
assumed to be open for unrestricted reuse, modification, or
redistribution.

------------------------------------------------------------------------

## Author

**Aman Gupta**

-   GitHub: [aman-gupta1009](https://github.com/aman-gupta1009)
-   Project repository:
    [SecureVault](https://github.com/aman-gupta1009/SecureVault)

------------------------------------------------------------------------

*SecureVault --- A secure and organized workspace for personal file
storage, access control, and backup management.*
