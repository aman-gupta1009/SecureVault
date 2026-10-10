const nodemailer = require("nodemailer");

const mailConfig = require("../config/mail");


const transporter =
    nodemailer.createTransport({

        host: mailConfig.host,

        port: mailConfig.port,

        secure:
            mailConfig.port === 465,

        auth: {
            user: mailConfig.user,

            pass:
                mailConfig.password
        }
    });


async function sendOTPEmail(
    email,
    otp,
    purpose
) {

    let subject =
        "SecureVault Verification Code";


    if (
        purpose ===
        "PASSWORD_RECOVERY"
    ) {

        subject =
            "SecureVault Password Recovery";
    }


    await transporter.sendMail({

        from: mailConfig.from,

        to: email,

        subject,

        text: `
SecureVault

Your verification code is:

${otp}

This code expires in ${
            process.env.OTP_EXPIRY_MINUTES || 10
        } minutes.

If you did not request this code,
please ignore this email.
        `.trim()
    });
}


module.exports = {
    sendOTPEmail
};