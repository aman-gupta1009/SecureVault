
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

async function sendShareAccessOTPEmail(email, otp) {
    if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        throw new Error("INVALID_RECIPIENT_EMAIL");
    }

    if (
        typeof otp !== "string" ||
        !/^\d{6}$/.test(otp)
    ) {
        throw new Error("INVALID_SHARE_OTP");
    }

    const safeOTP = escapeHTML(otp);
    const expiryMinutes = 10;
    const year = new Date().getFullYear();

    const text = `
SECUREVAULT - SHARED FILE VERIFICATION

Your verification code is: ${otp}

This code expires in ${expiryMinutes} minutes.

Enter this code only on the SecureVault share page.
Never share this code with anyone.

If you did not request access to a shared file, ignore this email.

(c) ${year} SecureVault.
    `.trim();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark light">
    <title>Shared file verification | SecureVault</title>
</head>
<body style="margin:0;padding:30px 12px;background:#080d0b;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;">
        <tr>
            <td style="padding:30px;background:#111a15;border:1px solid #26372d;border-radius:16px;">
                <div style="color:#8af0b3;font-size:20px;font-weight:bold;letter-spacing:2px;">
                    SECUREVAULT
                </div>

                <p style="margin-top:30px;color:#83e8ad;font-size:11px;font-weight:bold;letter-spacing:1.5px;">
                    SHARED FILE VERIFICATION
                </p>

                <h1 style="color:#f1f7f3;font-size:25px;line-height:1.3;">
                    Verify your email address
                </h1>

                <p style="color:#aab9af;font-size:14px;line-height:1.8;">
                    Someone has requested access to a file shared through SecureVault using this email address.
                    Enter the verification code below to continue.
                </p>

                <div style="margin:25px 0;padding:22px 12px;text-align:center;background:#0b1510;border:1px solid #31533e;border-radius:12px;">
                    <div style="color:#8af0b3;font-size:34px;font-weight:bold;letter-spacing:9px;">
                        ${safeOTP}
                    </div>
                </div>

                <p style="color:#b6c5bb;font-size:13px;line-height:1.7;">
                    This code expires in
                    <strong style="color:#8af0b3;">${expiryMinutes} minutes</strong>.
                </p>

                <div style="margin-top:25px;padding-top:20px;border-top:1px solid #29382e;color:#9eaaa1;font-size:12px;line-height:1.7;">
                    <strong style="color:#e7c98d;">Security notice</strong>
                    <br>
                    Never share this code with anyone.
                    If you did not request access, ignore this email.
                </div>
            </td>
        </tr>

        <tr>
            <td style="padding:20px 10px;text-align:center;color:#718278;font-size:11px;line-height:1.8;">
                (c) ${year} SecureVault. All rights reserved.
                <br>
                Privacy. Security. Control.
            </td>
        </tr>
    </table>
</body>
</html>`;

    return transporter.sendMail({
        from: mailConfig.from,
        to: email,
        subject: "Verify access to a shared file | SecureVault",
        text,
        html
    });
}

async function sendShareInvitationEmail(
    email,
    {
        fileName,
        shareUrl,
        permissionType,
        expiresAt
    }
) {
    if (
        typeof email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
        throw new Error("INVALID_RECIPIENT_EMAIL");
    }

    if (
        typeof shareUrl !== "string" ||
        !/^https?:\/\/\S+$/i.test(shareUrl)
    ) {
        throw new Error("INVALID_SHARE_URL");
    }

    if (typeof fileName !== "string" || !fileName.trim()) {
        throw new Error("INVALID_SHARED_FILE_NAME");
    }

    if (!["VIEW", "DOWNLOAD"].includes(permissionType)) {
        throw new Error("INVALID_PERMISSION_TYPE");
    }

    const safeFileName = escapeHTML(fileName);
    const safeShareUrl = escapeHTML(shareUrl);
    const permissionLabel =
        permissionType === "VIEW" ? "View only" : "View and download";

    const safePermission = escapeHTML(permissionLabel);
    const expiryText = expiresAt
        ? new Date(expiresAt).toLocaleString()
        : "No automatic expiry";

    const safeExpiry = escapeHTML(expiryText);
    const year = new Date().getFullYear();

    const text = `
SECUREVAULT - FILE SHARING INVITATION

You have been invited to access a file through SecureVault.

File: ${fileName}
Permission: ${permissionLabel}
Expiry: ${expiryText}

Open your secure file:
${shareUrl}

You will need to verify your email address using a one-time password before accessing the file.

If you were not expecting this invitation, you can ignore this email.

(c) ${year} SecureVault.
    `.trim();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark light">
    <title>Secure file invitation | SecureVault</title>
</head>
<body style="margin:0;padding:30px 12px;background:#080d0b;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;">
        <tr>
            <td style="padding:30px;background:#111a15;border:1px solid #26372d;border-radius:16px;">
                <div style="color:#8af0b3;font-size:20px;font-weight:bold;letter-spacing:2px;">
                    SECUREVAULT
                </div>

                <p style="margin-top:30px;color:#83e8ad;font-size:11px;font-weight:bold;letter-spacing:1.5px;">
                    SECURE FILE INVITATION
                </p>

                <h1 style="color:#f1f7f3;font-size:25px;line-height:1.3;">
                    A file has been shared with you
                </h1>

                <p style="color:#aab9af;font-size:14px;line-height:1.8;">
                    You have been invited to access the following file through SecureVault.
                </p>

                <div style="margin:24px 0;padding:18px;background:#0b1510;border:1px solid #31533e;border-radius:12px;">
                    <p style="margin:0 0 8px;color:#718278;font-size:10px;font-weight:bold;letter-spacing:1px;">
                        SHARED FILE
                    </p>
                    <p style="margin:0;color:#f1f7f3;font-size:16px;font-weight:bold;word-break:break-word;">
                        ${safeFileName}
                    </p>

                    <p style="margin:18px 0 5px;color:#718278;font-size:10px;font-weight:bold;letter-spacing:1px;">
                        PERMISSION
                    </p>
                    <p style="margin:0;color:#8af0b3;font-size:13px;">
                        ${safePermission}
                    </p>

                    <p style="margin:18px 0 5px;color:#718278;font-size:10px;font-weight:bold;letter-spacing:1px;">
                        LINK EXPIRY
                    </p>
                    <p style="margin:0;color:#b6c5bb;font-size:13px;">
                        ${safeExpiry}
                    </p>
                </div>

                <a href="${safeShareUrl}" style="display:block;padding:15px 20px;background:#8af0b3;border-radius:10px;color:#08120c;text-align:center;text-decoration:none;font-size:14px;font-weight:bold;">
                    Open Secure File
                </a>

                <p style="margin-top:22px;color:#aab9af;font-size:12px;line-height:1.8;">
                    For your protection, you must verify your email address with a one-time password before accessing this file.
                </p>

                <p style="color:#718278;font-size:11px;line-height:1.7;word-break:break-all;">
                    If the button does not work, open this link:
                    <br>
                    ${safeShareUrl}
                </p>

                <div style="margin-top:25px;padding-top:20px;border-top:1px solid #29382e;color:#9eaaa1;font-size:12px;line-height:1.7;">
                    <strong style="color:#e7c98d;">Security notice</strong>
                    <br>
                    Only open this link if you trust the person who shared the file.
                    Never share your verification code with anyone.
                    If you were not expecting this invitation, ignore this email.
                </div>
            </td>
        </tr>

        <tr>
            <td style="padding:20px 10px;text-align:center;color:#718278;font-size:11px;line-height:1.8;">
                (c) ${year} SecureVault. All rights reserved.
                <br>
                Privacy. Security. Control.
            </td>
        </tr>
    </table>
</body>
</html>`;

    return transporter.sendMail({
        from: mailConfig.from,
        to: email,
        subject: "You have received a secure file | SecureVault",
        text,
        html
    });
}

module.exports = {
    sendShareAccessOTPEmail,
    sendShareInvitationEmail
};
