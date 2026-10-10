require("dotenv").config();

const nodemailer = require("nodemailer");

console.log("SMTP HOST:", process.env.SMTP_HOST);
console.log("SMTP PORT:", process.env.SMTP_PORT);
console.log("SMTP USER:", process.env.SMTP_USER);
console.log(
    "SMTP PASSWORD LOADED:",
    process.env.SMTP_PASSWORD ? "YES" : "NO"
);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
    }
});

async function testSMTP() {
    try {

        await transporter.verify();

        console.log("");
        console.log("================================");
        console.log("✅ SMTP AUTHENTICATION SUCCESS");
        console.log("================================");

    } catch (error) {

        console.log("");
        console.log("================================");
        console.log("❌ SMTP AUTHENTICATION FAILED");
        console.log("================================");

        console.log("Code:", error.code);
        console.log("Response:", error.response);
        console.log("Command:", error.command);
    }
}

testSMTP();