const {
    getSession
} = require("../services/sessionService");


// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

async function authMiddleware(
    req,
    res,
    next
) {

    try {

        // -------------------------------------------------
        // Get cookie name
        // -------------------------------------------------

        const cookieName =
            process.env.SESSION_COOKIE_NAME ||
            "securevault_session";


        // -------------------------------------------------
        // Get session token from cookie
        // -------------------------------------------------

        const sessionToken =
            req.cookies[cookieName];


        // -------------------------------------------------
        // No session
        // -------------------------------------------------

        if (!sessionToken) {

            return res.status(401).json({

                success: false,

                message:
                    "Authentication required."

            });
        }


        // -------------------------------------------------
        // Validate session
        // -------------------------------------------------

        const session =
            await getSession(
                sessionToken
            );


        if (!session) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid or expired session."

            });
        }


        // -------------------------------------------------
        // Attach user information
        // -------------------------------------------------

        req.user = {

            userId:
                session.user_id,

            email:
                session.email,

            emailVerified:
                Boolean(
                    session.email_verified
                ),

            sessionId:
                session.session_id

        };


        // -------------------------------------------------
        // Continue
        // -------------------------------------------------

        next();

    } catch (error) {

        next(error);

    }
}


module.exports = authMiddleware;