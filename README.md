# SecureVault 🔐

**A Security-Focused File Locker**

SecureVault is a personal project focused on secure file storage, user authentication, and protecting access to private files.

**Status:** Work in Progress

## Technology Stack

- Node.js
- Express.js
- MySQL
- Argon2
- Nodemailer
- React and Tailwind CSS (frontend)

## Backend Features

The backend includes modules for:

- User authentication and email OTP
- Vault and file management
- File encryption services
- Vault auto-lock
- Key rotation
- Backup management
- File sharing
- Security alerts and activity tracking

Features are being developed and tested. Their availability may change during development.

## Project Structure

SecureVault/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── crypto/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── scripts/
│   ├── services/
│   ├── storage/
│   ├── tests/
│   ├── utils/
│   ├── validators/
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── database/
│   └── schema.sql
├── .gitignore
└── README.md


## Local Setup

### Prerequisites

- Node.js and npm
- MySQL Server
- Git
- SMTP credentials for email verification

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/SecureVault.git
cd SecureVault
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment variables

Create a `.env` file in the backend directory using `.env.example` as a reference.

Add your local database and SMTP configuration. Never publish actual credentials.

### 4. Set up the database

Create the `secure_vault` database and import `database/schema.sql` using MySQL.

### 5. Start the backend

```bash
npm run dev
```

## Security

- Never commit `.env` or actual credentials.
- Do not upload private keys or real user files.
- Do not commit real user records, OTPs, or session tokens.
- Test authentication, file access, encryption, and recovery flows before deployment.

## Development Status

SecureVault is under active development. This repository documents the project's development and will be updated as features are completed and tested.
