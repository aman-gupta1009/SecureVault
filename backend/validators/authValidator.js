const { z } = require("zod");


// =====================================================
// PASSWORD RULES
// =====================================================

const passwordSchema = z
    .string()
    .min(
        12,
        "Password must contain at least 12 characters"
    )
    .max(
        128,
        "Password cannot exceed 128 characters"
    )
    .regex(
        /[A-Z]/,
        "Password must contain at least one uppercase letter"
    )
    .regex(
        /[a-z]/,
        "Password must contain at least one lowercase letter"
    )
    .regex(
        /[0-9]/,
        "Password must contain at least one number"
    )
    .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character"
    );


// =====================================================
// REGISTER VALIDATION
// =====================================================

const registerSchema = z.object({

    email: z
        .string()
        .trim()
        .email(
            "Please enter a valid email address"
        )
        .max(
            255,
            "Email address is too long"
        ),

    password: passwordSchema

});


// =====================================================
// LOGIN VALIDATION
// =====================================================

const loginSchema = z.object({

    email: z
        .string()
        .trim()
        .email(
            "Please enter a valid email address"
        )
        .max(255),

    password: z
        .string()
        .min(1)
        .max(128)

});


module.exports = {
    registerSchema,
    loginSchema
};