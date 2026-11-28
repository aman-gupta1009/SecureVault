
import { useEffect, useState } from "react";
import * as SimpleIcons from "simple-icons";

const BRAND_MAP = [
  { names: ["instagram"], icon: "siInstagram" },
  { names: ["gmail"], icon: "siGmail" },
  { names: ["google"], icon: "siGoogle" },
  { names: ["facebook", "fb"], icon: "siFacebook" },
  { names: ["github"], icon: "siGithub" },
  { names: ["youtube"], icon: "siYoutube" },
  { names: ["whatsapp"], icon: "siWhatsapp" },
  { names: ["telegram"], icon: "siTelegram" },
  { names: ["discord"], icon: "siDiscord" },
  { names: ["reddit"], icon: "siReddit" },
  { names: ["snapchat"], icon: "siSnapchat" },
  { names: ["pinterest"], icon: "siPinterest" },
  { names: ["netflix"], icon: "siNetflix" },
  { names: ["amazon"], icon: "siAmazon" },
  { names: ["microsoft"], icon: "siMicrosoft" },
  { names: ["outlook"], icon: "siMicrosoftoutlook" },
  { names: ["spotify"], icon: "siSpotify" },
  { names: ["tiktok"], icon: "siTiktok" },
  { names: ["steam"], icon: "siSteam" },
  { names: ["twitch"], icon: "siTwitch" },
  { names: ["zoom"], icon: "siZoom" },
  { names: ["slack"], icon: "siSlack" },
  { names: ["notion"], icon: "siNotion" },
  { names: ["canva"], icon: "siCanva" },
  { names: ["figma"], icon: "siFigma" },
  { names: ["dropbox"], icon: "siDropbox" },
  { names: ["apple", "icloud"], icon: "siApple" },
  { names: ["paypal"], icon: "siPaypal" },
  { names: ["x", "twitter"], icon: "siX" },
];

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findBrand(websiteName) {
  const name = normalizeName(websiteName);

  const match = BRAND_MAP.find((brand) =>
    brand.names.some((alias) => {
      const normalizedAlias = normalizeName(alias);
      return (
        name === normalizedAlias ||
        name.includes(normalizedAlias)
      );
    })
  );

  if (!match) return null;

  return SimpleIcons[match.icon] || null;
}

function BrandSvg({ websiteName, brand }) {
  const isLinkedIn =
    normalizeName(websiteName).includes("linkedin");

  if (isLinkedIn) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="25"
        height="25"
        role="img"
        aria-label="LinkedIn logo"
        style={{ display: "block", fill: "#0A66C2" }}
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.35V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    );
  }

  if (!brand) return null;

  return (
    <svg
      viewBox="0 0 24 24"
      width="25"
      height="25"
      role="img"
      aria-label={`${brand.title} logo`}
      style={{
        display: "block",
        fill: `#${brand.hex}`,
      }}
    >
      <path d={brand.path} />
    </svg>
  );
}

export default function BrandLogo({
  websiteName,
  websiteOrigin,
}) {
  const [faviconFailed, setFaviconFailed] = useState(false);

  const normalizedName = normalizeName(websiteName);
  const isLinkedIn = normalizedName.includes("linkedin");
  const brand = isLinkedIn ? true : findBrand(websiteName);

  useEffect(() => {
    setFaviconFailed(false);
  }, [websiteOrigin]);

  const logoStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  };

  if (brand) {
    return (
      <div
        className="pm-website-logo"
        style={{
          ...logoStyle,
          background: "#ffffff",
          border: "1px solid rgba(128,128,128,0.18)",
        }}
        title={isLinkedIn ? "LinkedIn" : brand.title}
      >
        <BrandSvg
          websiteName={websiteName}
          brand={isLinkedIn ? null : brand}
        />
      </div>
    );
  }

  if (websiteOrigin && !faviconFailed) {
    return (
      <div
        className="pm-website-logo"
        style={logoStyle}
      >
        <img
          src={`${websiteOrigin}/favicon.ico`}
          alt={`${websiteName} logo`}
          onError={() => setFaviconFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="pm-website-logo"
      style={logoStyle}
    >
      <span>
        {(websiteName || "W").slice(0, 1).toUpperCase()}
      </span>
    </div>
  );
}
