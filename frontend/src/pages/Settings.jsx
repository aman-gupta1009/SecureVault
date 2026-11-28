
import { useState } from "react";
import { useTheme } from "../ThemeContext.jsx";
import "./Settings.css";

export default function Settings({
  onNavigate,
  sidebarCollapsed,
  onToggleSidebar,
}) {
  const { theme, setTheme, themeOptions } = useTheme();
  const [activeSection, setActiveSection] = useState("home");

  const selectedTheme =
    themeOptions.find((item) => item.id === theme) ||
    themeOptions[0];

  function openSection(section) {
    setActiveSection(section);
  }

  function goBack() {
    setActiveSection("home");
  }

  if (activeSection === "appearance") {
    return (
      <section className="sv-settings-page">
        <button
          className="sv-settings-back"
          onClick={goBack}
          type="button"
        >
          ← Back to Settings
        </button>

        <div className="sv-settings-heading">
          <span className="sv-settings-eyebrow">
            PREFERENCES / APPEARANCE
          </span>
          <h1>Choose your theme</h1>
          <p>
            Select a theme for your SecureVault workspace.
            Your selection will be saved automatically.
          </p>
        </div>

        <div className="sv-settings-current">
          <div>
            <span>CURRENT THEME</span>
            <strong>{selectedTheme.name}</strong>
          </div>
          <span className="sv-settings-saved">
            ● Saved automatically
          </span>
        </div>

        <div className="sv-theme-grid">
          {themeOptions.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`sv-theme-card ${
                theme === item.id ? "selected" : ""
              }`}
              onClick={() => setTheme(item.id)}
              aria-pressed={theme === item.id}
            >
              <div className="sv-theme-card-top">
                <span className="sv-theme-icon">{item.icon}</span>
                {theme === item.id ? (
                  <span className="sv-theme-selected">
                    ✓ Selected
                  </span>
                ) : item.id === "dark" ? (
                  <span className="sv-theme-default">Default</span>
                ) : null}
              </div>

              <strong>{item.name}</strong>
              <small>{item.description}</small>

              <div className="sv-theme-swatches">
                {item.colors.map((color, index) => (
                  <span
                    key={index}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (activeSection === "navigation") {
    return (
      <section className="sv-settings-page">
        <button
          className="sv-settings-back"
          onClick={goBack}
          type="button"
        >
          ← Back to Settings
        </button>

        <div className="sv-settings-heading">
          <span className="sv-settings-eyebrow">
            PREFERENCES / NAVIGATION
          </span>
          <h1>Navigation preferences</h1>
          <p>Control how your SecureVault workspace sidebar appears.</p>
        </div>

        <div className="sv-settings-detail-card">
          <div>
            <strong>Workspace sidebar</strong>
            <p>
              {sidebarCollapsed
                ? "Your sidebar is currently collapsed."
                : "Your sidebar is currently expanded."}
            </p>
          </div>

          <button
            type="button"
            className="sv-settings-action"
            onClick={onToggleSidebar}
          >
            {sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          </button>
        </div>
      </section>
    );
  }

  if (activeSection === "privacy") {
    return (
      <section className="sv-settings-page">
        <button
          className="sv-settings-back"
          onClick={goBack}
          type="button"
        >
          ← Back to Settings
        </button>

        <div className="sv-settings-heading">
          <span className="sv-settings-eyebrow">
            PREFERENCES / PRIVACY & SECURITY
          </span>
          <h1>Privacy & Security</h1>
          <p>Quick access to your existing account security modules.</p>
        </div>

        <div className="sv-settings-detail-list">
          <button
            type="button"
            className="sv-settings-detail-card"
            onClick={() => onNavigate?.("Devices & Sessions")}
          >
            <span className="sv-settings-detail-icon">⌘</span>
            <span>
              <strong>Devices & Sessions</strong>
              <small>Review active sessions and manage device access.</small>
            </span>
            <span className="sv-settings-arrow">→</span>
          </button>

          <button
            type="button"
            className="sv-settings-detail-card"
            onClick={() => onNavigate?.("Password Manager")}
          >
            <span className="sv-settings-detail-icon">⚿</span>
            <span>
              <strong>Password Manager</strong>
              <small>Open your existing password management module.</small>
            </span>
            <span className="sv-settings-arrow">→</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="sv-settings-page">
      <div className="sv-settings-heading">
        <span className="sv-settings-eyebrow">PREFERENCES</span>
        <h1>Make SecureVault yours</h1>
        <p>
          Manage your workspace appearance, navigation and security
          preferences.
        </p>
      </div>

      <div className="sv-settings-home-grid">
        <button
          type="button"
          className="sv-settings-home-card"
          onClick={() => openSection("appearance")}
        >
          <span className="sv-settings-home-icon">◐</span>
          <span className="sv-settings-home-label">DISPLAY</span>
          <strong>Appearance</strong>
          <p>
            Choose from six workspace themes. Current: {selectedTheme.name}.
          </p>
          <span className="sv-settings-card-link">Customize theme →</span>
        </button>

        <button
          type="button"
          className="sv-settings-home-card"
          onClick={() => openSection("navigation")}
        >
          <span className="sv-settings-home-icon">▤</span>
          <span className="sv-settings-home-label">LAYOUT</span>
          <strong>Navigation</strong>
          <p>
            Manage the workspace sidebar and its expanded or collapsed view.
          </p>
          <span className="sv-settings-card-link">Manage navigation →</span>
        </button>

        <button
          type="button"
          className="sv-settings-home-card"
          onClick={() => openSection("privacy")}
        >
          <span className="sv-settings-home-icon">♢</span>
          <span className="sv-settings-home-label">PREFERENCES</span>
          <strong>Privacy & Security</strong>
          <p>
            Access your existing device sessions and password security tools.
          </p>
          <span className="sv-settings-card-link">Open security settings →</span>
        </button>
      </div>

      <div className="sv-settings-info">
        <span>i</span>
        <p>
          Your theme and sidebar preferences are saved automatically
          on this device.
        </p>
      </div>
    </section>
  );
}
