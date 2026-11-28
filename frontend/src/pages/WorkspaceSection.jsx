import { useState } from "react";
import {
  useTheme,
  THEME_OPTIONS,
} from "../ThemeContext.jsx";

const content = {
  "Smart Organization": {
    eyebrow: "FILE WORKSPACE",
    title: "Organize your vault",
    description: "A clearer way to browse files by type and category.",
    cards: [
      ["Documents", "DOC · DOCX · PDF", "File category"],
      ["Images", "PNG · JPG · WEBP", "File category"],
      ["Videos", "MP4 · MOV · MKV", "File category"],
      ["Audio", "MP3 · WAV · AAC", "File category"],
      ["Archives", "ZIP · RAR · 7Z", "File category"],
      ["Other files", "Additional formats", "File category"],
    ],
    note: "Choose a category to open the matching files stored in your vault.",
  },

  "Secure Sharing": {
    eyebrow: "CONTROLLED ACCESS",
    title: "Share with confidence",
    description: "A dedicated workspace for protected file sharing.",
    cards: [
      ["Create a share", "Choose a file and define access", "SHARE WORKFLOW"],
      ["Access permissions", "View and download controls", "PERMISSIONS"],
      ["Expiry controls", "Time-limited access", "LINK SECURITY"],
    ],
    note: "Sharing controls are a UI preview. No share link is created and no access permission is changed from this screen yet.",
  },

  Notifications: {
    eyebrow: "ALERTS & UPDATES",
    title: "Stay informed",
    description: "A single place for security, backup and account notifications.",
    cards: [
      ["Security alerts", "Important account and vault notices", "ALERT TYPE"],
      ["Backup updates", "Completion and integrity notices", "ALERT TYPE"],
      ["Account updates", "Profile and session notices", "ALERT TYPE"],
    ],
    note: "Open the Notifications module to view available notifications.",
  },

  "Devices & Sessions": {
    eyebrow: "ACCOUNT ACCESS",
    title: "Devices & sessions",
    description: "Review account access and connected devices.",
    cards: [
      ["Active sessions", "Review signed-in sessions", "ACCESS CONTROL"],
      ["Trusted devices", "Recognize your devices", "DEVICE CONTROL"],
      ["Session protection", "Sign-out and access controls", "SECURITY"],
    ],
    note: "Use the Devices & Sessions module to manage available session controls.",
  },
};

function CategoryIcon({ index }) {
  const glyphs = ["▤", "▧", "▷", "♫", "▱", "◫"];

  return (
    <span className="sv-section-card-icon" aria-hidden="true">
      {glyphs[index % glyphs.length]}
    </span>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <section className="sv-settings-appearance">
      <div className="sv-module-heading-row">
        <div>
          <span className="sv-module-eyebrow">
            PREFERENCES / APPEARANCE
          </span>

          <h2>Make SecureVault yours</h2>

          <p>
            Choose a theme for your SecureVault workspace.
            Your selection will be saved automatically.
          </p>
        </div>
      </div>

      <div className="sv-settings-current">
        <div>
          <span className="sv-settings-current-label">
            CURRENT THEME
          </span>

          <strong>
            {THEME_OPTIONS.find((item) => item.id === theme)?.name ||
              "Emerald Dark"}
          </strong>
        </div>

        <span className="sv-settings-saved">
          <span aria-hidden="true">●</span> Saved automatically
        </span>
      </div>

      <div className="sv-theme-grid">
        {THEME_OPTIONS.map((item) => {
          const selected = theme === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={`sv-theme-card ${selected ? "selected" : ""}`}
              data-theme-preview={item.id}
              onClick={() => setTheme(item.id)}
              aria-pressed={selected}
              aria-label={`Apply ${item.name} theme`}
            >
              <div className="sv-theme-card-top">
                <span className="sv-theme-card-icon" aria-hidden="true">
                  {item.id === "dark" && "♢"}
                  {item.id === "light" && "☼"}
                  {item.id === "midnight-blue" && "☾"}
                  {item.id === "royal-purple" && "✧"}
                  {item.id === "ocean-teal" && "≋"}
                  {item.id === "warm-amber" && "☀"}
                </span>

                {selected && (
                  <span className="sv-theme-selected">
                    ✓ Selected
                  </span>
                )}

                {!selected && item.id === "dark" && (
                  <span className="sv-theme-default">
                    Default
                  </span>
                )}
              </div>

              <strong className="sv-theme-name">
                {item.name}
              </strong>

              <span className="sv-theme-description">
                {item.description}
              </span>

              <span className="sv-theme-swatches" aria-hidden="true">
                {item.colors.map((color) => (
                  <span
                    key={color}
                    style={{ background: color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="sv-settings-info">
        <span aria-hidden="true">i</span>
        <p>
          Your selected theme is stored on this device and
          automatically restored when you reopen SecureVault.
        </p>
      </div>
    </section>
  );
}

export default function WorkspaceSection({
  page,
  onNavigate,
  onCategorySelect,
}) {
  const [filter, setFilter] = useState("");

  if (page === "Settings") {
    return <AppearanceSettings />;
  }

  const data = content[page] || content["Smart Organization"];

  const cards = data.cards.filter((card) =>
    card.join(" ").toLowerCase().includes(filter.toLowerCase())
  );

  function handleCardClick(card) {
    if (page !== "Smart Organization") return;

    if (typeof onCategorySelect === "function") {
      onCategorySelect(card[0]);
      return;
    }

    onNavigate?.("Files");
  }

  return (
    <section className="sv-module-page">
      <div className="sv-module-heading-row">
        <div>
          <span className="sv-module-eyebrow">{data.eyebrow}</span>
          <h2>{data.title}</h2>
          <p>{data.description}</p>
        </div>

        {page === "Smart Organization" && (
          <label className="sv-module-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter categories"
              aria-label="Filter categories"
            />
          </label>
        )}
      </div>

      <div className={`sv-module-card-grid ${cards.length === 3 ? "three" : ""}`}>
        {cards.map((card, index) => {
          const isCategory = page === "Smart Organization";

          return (
            <button
              className="sv-module-card"
              key={card[0]}
              type="button"
              onClick={() => handleCardClick(card)}
              disabled={!isCategory}
              aria-label={
                isCategory ? `Show ${card[0]} in My Files` : undefined
              }
              style={{
                textAlign: "left",
                width: "100%",
                cursor: isCategory ? "pointer" : "default",
                font: "inherit",
              }}
            >
              <CategoryIcon index={index} />
              <span className="sv-module-card-label">{card[2]}</span>
              <h3>{card[0]}</h3>
              <p>{card[1]}</p>
              <span className="sv-module-card-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          );
        })}

        {cards.length === 0 && (
          <div className="sv-module-empty">
            No matching categories.
          </div>
        )}
      </div>

      <div className="sv-module-notice">
        <span className="sv-module-notice-icon" aria-hidden="true">i</span>
        <p>{data.note}</p>
      </div>

      <div className="sv-module-footer">
        <span>
          {page === "Smart Organization"
            ? "CONNECTED TO VAULT FILES"
            : "DESIGN PREVIEW"}
        </span>

        <span>
          {page === "Smart Organization"
            ? "CATEGORY FILTERING ENABLED"
            : "MODULE INTEGRATION PENDING"}
        </span>
      </div>
    </section>
  );
}