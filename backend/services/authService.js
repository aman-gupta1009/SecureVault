const argon2 = require("argon2");

const {
    pool
} = require("../config/database");

const {
    createOTP
} = require("./otpService");


// =====================================================
// REGISTER USER
// =====================================================

async function registerUser(
    email,
    password
) {

    const normalizedEmail =
        email
            .trim()
            .toLowerCase();


    const [
        existingUsers
    ] = await pool.execute(
        `
        SELECT
            user_id,
            email_verified
        FROM users
        WHERE email = ?
        `,
        [normalizedEmail]
    );


    if (existingUsers.length > 0) {

        const existingUser =
            existingUsers[0];


        if (
            existingUser.email_verified
        ) {

            const error =
                new Error(
                    "ACCOUNT_ALREADY_EXISTS"
                );

            throw error;
        }


        const passwordHash =
            await argon2.hash(
                password,
                {
                    type:
                        argon2.argon2id
                }
            );


        await pool.execute(
            `
            UPDATE users
            SET password_hash = ?
            WHERE user_id = ?
            `,
            [
                passwordHash,
                existingUser.user_id
            ]
        );


        const otp =
            await createOTP(
                existingUser.user_id,
                "REGISTRATION"
            );


        return {
            userId:
                existingUser.user_id,

            email:
                normalizedEmail,

            otp
        };
    }


    const passwordHash =
        await argon2.hash(
            password,
            {
                type:
                    argon2.argon2id
            }
        );


    const [
        result
    ] = await pool.execute(
        `
        INSERT INTO users
        (
            email,
            password_hash
        )
        VALUES
        (
            ?,
            ?
        )
        `,
        [
            normalizedEmail,
            passwordHash
        ]
    );


    const userId =
        result.insertId;


    const otp =
        await createOTP(
            userId,
            "REGISTRATION"
        );


    return {
        userId,
        email: normalizedEmail,
        otp
    };
}


// =====================================================
// LOGIN USER
// =====================================================

async function loginUser(
    email,
    password
) {

    const normalizedEmail =
        email
            .trim()
            .toLowerCase();


    // -------------------------------------------------
    // Find user
    // -------------------------------------------------

    const [
        users
    ] = await pool.execute(
        `
        SELECT
            user_id,
            email,
            password_hash,
            email_verified
        FROM users
        WHERE email = ?
        LIMIT 1
        `,
        [normalizedEmail]
    );


    // -------------------------------------------------
    // Account not found
    // -------------------------------------------------

    if (users.length === 0) {

        const error =
            new Error(
                "INVALID_CREDENTIALS"
            );

        throw error;
    }


    const user =
        users[0];


    // -------------------------------------------------
    // Email verification check
    // -------------------------------------------------

    if (!user.email_verified) {

        const error =
            new Error(
                "EMAIL_NOT_VERIFIED"
            );

        throw error;
    }


    // -------------------------------------------------
    // Verify password
    // -------------------------------------------------

    const passwordValid =
        await argon2.verify(
            user.password_hash,
            password
        );


    if (!passwordValid) {

        const error =
            new Error(
                "INVALID_CREDENTIALS"
            );

        throw error;
    }


    // -------------------------------------------------
    // Login successful
    // -------------------------------------------------

    return {

        userId:
            user.user_id,

        email:
            user.email

    };
}


// =====================================================
// VERIFY USER PASSWORD
// =====================================================

async function verifyUserPassword(
    userId,
    password
) {

    // -------------------------------------------------
    // Validate password input
    // -------------------------------------------------

    if (
        typeof password !== "string" ||
        password.length === 0
    ) {

        const error =
            new Error(
                "INVALID_PASSWORD"
            );

        throw error;
    }


    // -------------------------------------------------
    // Find user's password hash
    // -------------------------------------------------

    const [
        users
    ] = await pool.execute(
        `
        SELECT
            user_id,
            password_hash
        FROM users
        WHERE user_id = ?
        LIMIT 1
        `,
        [userId]
    );


    // -------------------------------------------------
    // User not found
    // -------------------------------------------------

    if (users.length === 0) {

        const error =
            new Error(
                "USER_NOT_FOUND"
            );

        throw error;
    }


    const user =
        users[0];


    // -------------------------------------------------
    // Verify password using Argon2id
    // -------------------------------------------------

    const passwordValid =
        await argon2.verify(
            user.password_hash,
            password
        );


    if (!passwordValid) {

        const error =
            new Error(
                "INVALID_PASSWORD"
            );

        throw error;
    }


    // -------------------------------------------------
    // Password verified
    // -------------------------------------------------

    return true;
}


// =====================================================
// EXPORTS
// =====================================================

module.exports = {

    registerUser,

    loginUser,

    verifyUserPassword

};