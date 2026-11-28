
const nodemailer = require("nodemailer");
const mailConfig = require("../config/mail");

const transporter = nodemailer.createTransport({
    host: mailConfig.host,
    port: mailConfig.port,
    secure: mailConfig.port === 465,
    auth: {
        user: mailConfig.user,
        pass: mailConfig.password
    }
});

// Escape dynamic HTML content.
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function getEmailContent(purpose) {
    switch (purpose) {
        case "REGISTRATION":
            return {
                subject: "Verify your email | SecureVault",
                eyebrow: "ACCOUNT VERIFICATION",
                heading: "Welcome to SecureVault.",
                message:
                    "You're one step away from creating your secure workspace. Enter the verification code below to confirm your email address.",
                action: "Verify your email address"
            };

        case "PASSWORD_RECOVERY":
            return {
                subject: "Password recovery code | SecureVault",
                eyebrow: "ACCOUNT RECOVERY",
                heading: "Let's get you back in.",
                message:
                    "We received a request to reset your SecureVault password. Use the one-time code below to continue securely.",
                action: "Complete password recovery"
            };

        default:
            return {
                subject: "Your security code | SecureVault",
                eyebrow: "SECURITY VERIFICATION",
                heading: "Your verification code is ready.",
                message:
                    "Use the one-time code below to complete your requested SecureVault security verification.",
                action: "Complete verification"
            };
    }
}

function buildEmailHTML({ otp, expiry, content }) {
    const safeOTP = escapeHTML(otp);
    const safeExpiry = escapeHTML(expiry);
    const safeHeading = escapeHTML(content.heading);
    const safeMessage = escapeHTML(content.message);
    const safeEyebrow = escapeHTML(content.eyebrow);
    const safeAction = escapeHTML(content.action);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark light">
    <meta name="supported-color-schemes" content="dark light">
    <title>${safeHeading}</title>
    <style>
        body {
            margin: 0 !important;
            padding: 0 !important;
            background-color: #080d0b;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-text-size-adjust: 100%;
        }

        table {
            border-spacing: 0;
            border-collapse: collapse;
        }

        @media only screen and (max-width: 600px) {
            .email-wrapper {
                width: 100% !important;
            }

            .email-content {
                padding: 28px 22px !important;
            }

            .otp-code {
                font-size: 31px !important;
                letter-spacing: 7px !important;
            }

            .brand-title {
                font-size: 19px !important;
            }
        }
    </style>
</head>
<body style="margin:0;padding:0;background-color:#080d0b;">
    <div style="display:none;font-size:1px;color:#080d0b;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        Your SecureVault verification code is ready. It expires in ${safeExpiry} minutes.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background-color:#080d0b;width:100%;">
        <tr>
            <td align="center" style="padding:38px 14px;">
                <table role="presentation" class="email-wrapper"
                    width="560" cellpadding="0" cellspacing="0"
                    style="width:100%;max-width:560px;">
                    <tr>
                        <td style="padding:0 0 22px 0;">
                            <table role="presentation" width="100%">
                                <tr>
                                    <td align="center">
                                        <table role="presentation">
                                            <tr>
                                                <td valign="middle" style="padding-right:10px;">
                                                    <div style="width:38px;height:38px;line-height:38px;text-align:center;border-radius:12px;background-color:#123b2a;color:#7df0b0;font-size:20px;font-weight:bold;">
                                                        S
                                                    </div>
                                                </td>
                                                <td valign="middle">
                                                    <div class="brand-title" style="color:#f1f7f3;font-size:21px;font-weight:700;letter-spacing:1.2px;">
                                                        SECUREVAULT
                                                    </div>
                                                    <div style="color:#82968a;font-size:10px;letter-spacing:2px;margin-top:3px;">
                                                        YOUR PRIVATE SPACE
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td class="email-content" style="padding:42px 42px 36px;background-color:#111a15;border:1px solid #26372d;border-radius:18px;">
                            <div style="display:inline-block;padding:8px 12px;border-radius:20px;background-color:#173425;color:#83e8ad;font-size:10px;font-weight:bold;letter-spacing:1.5px;">
                                ${safeEyebrow}
                            </div>

                            <h1 style="margin:24px 0 13px;color:#f1f7f3;font-size:27px;line-height:1.3;font-weight:700;">
                                ${safeHeading}
                            </h1>

                            <p style="margin:0;color:#aab9af;font-size:14px;line-height:1.8;">
                                ${safeMessage}
                            </p>

                            <div style="margin-top:32px;color:#91a49a;font-size:11px;font-weight:bold;letter-spacing:1.6px;text-align:center;">
                                YOUR ONE-TIME VERIFICATION CODE
                            </div>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:13px;">
                                <tr>
                                    <td align="center" style="padding:23px 10px;background-color:#0b1510;border:1px solid #31533e;border-radius:13px;">
                                        <div class="otp-code" style="color:#8af0b3;font-size:36px;line-height:1.3;font-weight:700;letter-spacing:10px;text-align:center;white-space:nowrap;">
                                            ${safeOTP}
                                        </div>
                                    </td>
                                </tr>
                            </table>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:19px;">
                                <tr>
                                    <td align="center" style="padding:13px;background-color:#1c261f;border-radius:9px;">
                                        <span style="color:#b6c5bb;font-size:12px;line-height:1.6;">
                                            This code expires in
                                            <strong style="color:#8af0b3;">${safeExpiry} minutes</strong>.
                                        </span>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:27px 0 0;color:#82968a;font-size:12px;line-height:1.7;">
                                ${safeAction}. Enter this code only on the official SecureVault application.
                            </p>

                            <div style="height:1px;background-color:#29382e;margin:28px 0 22px;"></div>

                            <table role="presentation" width="100%">
                                <tr>
                                    <td valign="top" width="25" style="color:#e8bd70;font-size:17px;padding-top:1px;">
                                        !
                                    </td>
                                    <td>
                                        <div style="color:#e7c98d;font-size:12px;font-weight:bold;margin-bottom:5px;">
                                            Security notice
                                        </div>
                                        <div style="color:#9eaaa1;font-size:12px;line-height:1.7;">
                                            Never share this code with anyone. SecureVault will never ask you to disclose your OTP over phone, message or email.
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td align="center" style="padding:25px 15px 0;">
                            <div style="color:#718278;font-size:11px;line-height:1.8;">
                                If you did not request this code, you can safely ignore this email.
                            </div>
                            <div style="color:#52645a;font-size:10px;line-height:1.8;margin-top:15px;">
                                &copy; ${new Date().getFullYear()} SecureVault. All rights reserved.
                            </div>
                            <div style="color:#52645a;font-size:10px;margin-top:5px;letter-spacing:1px;">
                                PRIVACY &middot; SECURITY &middot; CONTROL
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

async function sendOTPEmail(email, otp, purpose) {
    const content = getEmailContent(purpose);

    const expiry = Math.max(
        1,
        Number.parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 10
    );

    const text = `
SECUREVAULT
${content.eyebrow}

${content.heading}

${content.message}

YOUR VERIFICATION CODE:
${otp}

This code expires in ${expiry} minutes.

SECURITY NOTICE:
Never share this code with anyone.
SecureVault will never ask you to disclose your OTP.

If you did not request this code, please ignore this email.

© ${new Date().getFullYear()} SecureVault.
Privacy. Security. Control.
    `.trim();

    const html = buildEmailHTML({
        otp,
        expiry,
        content
    });

    return transporter.sendMail({
        from: mailConfig.from,
        to: email,
        subject: content.subject,
        text,
        html
    });
}

/*
|--------------------------------------------------------------------------
| SHARE INVITATION EMAIL
|--------------------------------------------------------------------------
*/

function buildShareInvitationHTML({
    fileName,
    permissionType,
    expiresAt,
    shareUrl
}) {
    const safeFileName = escapeHTML(fileName);
    const safePermission = escapeHTML(permissionType);
    const safeExpiry = escapeHTML(expiresAt || "No expiry set");
    const safeShareUrl = escapeHTML(shareUrl);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Secure file shared with you | SecureVault</title>
</head>
<body style="margin:0;padding:35px 12px;background:#080d0b;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center">
                <table role="presentation" width="560" cellpadding="0" cellspacing="0"
                    style="max-width:560px;width:100%;background:#111a15;border:1px solid #26372d;border-radius:16px;">
                    <tr>
                        <td style="padding:32px;">
                            <div style="text-align:center;color:#8af0b3;font-size:22px;font-weight:bold;letter-spacing:2px;">
                                SECUREVAULT
                            </div>

                            <h1 style="color:#f1f7f3;font-size:25px;margin:30px 0 12px;">
                                A secure file has been shared with you.
                            </h1>

                            <p style="color:#aab9af;font-size:14px;line-height:1.8;">
                                Someone has invited you to access a file through SecureVault.
                                Use the button below to continue.
                            </p>

                            <div style="margin-top:24px;padding:18px;background:#0b1510;border:1px solid #31533e;border-radius:10px;">
                                <div style="color:#82968a;font-size:11px;letter-spacing:1px;">
                                    SHARED FILE
                                </div>
                                <div style="color:#f1f7f3;font-size:16px;font-weight:bold;margin-top:7px;overflow-wrap:anywhere;">
                                    ${safeFileName}
                                </div>

                                <div style="color:#82968a;font-size:11px;letter-spacing:1px;margin-top:20px;">
                                    PERMISSION
                                </div>
                                <div style="color:#8af0b3;font-size:14px;margin-top:6px;">
                                    ${safePermission}
                                </div>

                                <div style="color:#82968a;font-size:11px;letter-spacing:1px;margin-top:20px;">
                                    EXPIRES
                                </div>
                                <div style="color:#f1f7f3;font-size:14px;margin-top:6px;">
                                    ${safeExpiry}
                                </div>
                            </div>

                            <div style="text-align:center;margin:30px 0;">
                                <a href="${safeShareUrl}"
                                    style="display:inline-block;padding:15px 28px;background:#23834d;color:#ffffff;text-decoration:none;border-radius:9px;font-weight:bold;font-size:14px;">
                                    Open shared file
                                </a>
                            </div>

                            <p style="color:#aab9af;font-size:13px;line-height:1.8;">
                                For your protection, email verification using a one-time password (OTP)
                                is required before accessing the shared file.
                            </p>

                            <div style="border-top:1px solid #29382e;margin-top:25px;padding-top:20px;color:#e7c98d;font-size:12px;line-height:1.8;">
                                Security notice: Only open this link if you expected a SecureVault
                                file-sharing invitation. Do not forward this private link to others.
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px;text-align:center;color:#718278;font-size:11px;">
                            &copy; ${new Date().getFullYear()} SecureVault. Privacy. Security. Control.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

async function sendShareInvitationEmail({
    email,
    fileName,
    permissionType,
    expiresAt,
    shareUrl
}) {
    if (!email || !shareUrl || !fileName) {
        throw new Error("INVALID_SHARE_INVITATION_DETAILS");
    }

    const text = `
SECUREVAULT - FILE SHARING INVITATION

A secure file has been shared with you.

File: ${fileName}
Permission: ${permissionType}
Expires: ${expiresAt || "No expiry set"}

Open your shared file:
${shareUrl}

For your protection, email verification using a one-time password (OTP)
is required before accessing the shared file.

Security notice:
Only open this link if you expected this invitation.
Do not forward this private link to others.

© ${new Date().getFullYear()} SecureVault.
Privacy. Security. Control.
    `.trim();

    const html = buildShareInvitationHTML({
        fileName,
        permissionType,
        expiresAt,
        shareUrl
    });

    return transporter.sendMail({
        from: mailConfig.from,
        to: email,
        subject: "A secure file has been shared with you | SecureVault",
        text,
        html
    });
}

module.exports = {
    sendOTPEmail,
    sendShareInvitationEmail
};
