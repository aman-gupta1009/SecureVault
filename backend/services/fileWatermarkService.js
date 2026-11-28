
const { PDFDocument, StandardFonts, rgb, degrees } = require("pdf-lib");
const sharp = require("sharp");

function escapeXml(value) {
    return String(value || "").replace(/[<>&"']/g, (char) => ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;"
    })[char]);
}

function createWatermarkText({
    recipientEmail,
    serverTimestamp,
    ipAddress
}) {
    return [
        `SHARED WITH: ${recipientEmail || "Verified Recipient"}`,
        `DATE: ${serverTimestamp || new Date().toISOString()}`,
        ipAddress ? `IP: ${ipAddress}` : ""
    ].filter(Boolean).join("  |  ");
}

async function watermarkPdf(data, watermarkText) {
    const pdf = await PDFDocument.load(data);
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    for (const page of pdf.getPages()) {
        const { width, height } = page.getSize();
        const fontSize = Math.max(16, Math.min(28, width / 22));
        const textWidth = font.widthOfTextAtSize(
            watermarkText,
            fontSize
        );

        const x = Math.max(10, (width - textWidth) / 2);
        const y = height / 2;

        page.drawText(watermarkText, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0.75, 0.10, 0.10),
            opacity: 0.24,
            rotate: degrees(-35)
        });

        page.drawText("SECUREVAULT - CONFIDENTIAL", {
            x: 20,
            y: 18,
            size: 9,
            font,
            color: rgb(0.65, 0.10, 0.10),
            opacity: 0.65
        });
    }

    return Buffer.from(await pdf.save());
}

async function watermarkImage(data, mimeType, watermarkText) {
    if (![
        "image/png",
        "image/jpeg",
        "image/webp"
    ].includes(mimeType)) {
        throw new Error("WATERMARK_UNSUPPORTED_FILE_TYPE");
    }

    const image = sharp(data, {
        failOn: "error",
        limitInputPixels: 100000000
    });

    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
        throw new Error("WATERMARK_PROCESSING_FAILED");
    }

    const width = metadata.width;
    const height = metadata.height;

    const fontSize = Math.max(
        14,
        Math.min(32, Math.floor(width / 24))
    );

    const safeText = escapeXml(watermarkText);

    const svg = `
        <svg width="${width}" height="${height}"
             xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(${width / 2},${height / 2}) rotate(-35)">
                <text
                    text-anchor="middle"
                    dominant-baseline="middle"
                    font-family="Arial, sans-serif"
                    font-size="${fontSize}"
                    font-weight="bold"
                    fill="red"
                    fill-opacity="0.28"
                    stroke="white"
                    stroke-opacity="0.15"
                    stroke-width="1">
                    ${safeText}
                </text>
            </g>
            <text
                x="12"
                y="${height - 14}"
                font-family="Arial, sans-serif"
                font-size="12"
                fill="red"
                fill-opacity="0.65">
                SECUREVAULT - CONFIDENTIAL
            </text>
        </svg>
    `;

    const output = await image
        .composite([{
            input: Buffer.from(svg),
            blend: "over"
        }])
        .toFormat(mimeType === "image/jpeg" ? "jpeg" : mimeType.split("/")[1])
        .toBuffer();

    return output;
}

async function watermarkTextFile(data, watermarkText) {
    const originalText = data.toString("utf8");

    if (originalText.includes("\u0000")) {
        throw new Error("WATERMARK_UNSUPPORTED_FILE_TYPE");
    }

    const header = [
        "==================================================",
        "SECUREVAULT - CONFIDENTIAL SHARED DOCUMENT",
        watermarkText,
        "==================================================",
        ""
    ].join("\n");

    return Buffer.from(
        header + originalText,
        "utf8"
    );
}

async function applyWatermark({
    data,
    mimeType,
    recipientEmail,
    serverTimestamp,
    ipAddress
}) {
    if (!Buffer.isBuffer(data)) {
        throw new Error("WATERMARK_INVALID_INPUT");
    }

    const normalizedMime = String(
        mimeType || "application/octet-stream"
    ).split(";")[0].trim().toLowerCase();

    const watermarkText = createWatermarkText({
        recipientEmail,
        serverTimestamp,
        ipAddress
    });

    let watermarkedData;

    if (normalizedMime === "application/pdf") {
        watermarkedData = await watermarkPdf(
            data,
            watermarkText
        );
    } else if (
        ["image/png", "image/jpeg", "image/webp"].includes(normalizedMime)
    ) {
        watermarkedData = await watermarkImage(
            data,
            normalizedMime,
            watermarkText
        );
    } else if (normalizedMime === "text/plain") {
        watermarkedData = await watermarkTextFile(
            data,
            watermarkText
        );
    } else {
        throw new Error("WATERMARK_UNSUPPORTED_FILE_TYPE");
    }

    return {
        data: watermarkedData,
        mimeType: normalizedMime,
        watermarked: true
    };
}

module.exports = {
    applyWatermark
};
