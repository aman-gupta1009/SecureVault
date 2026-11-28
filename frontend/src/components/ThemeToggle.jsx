
import { useTheme } from "../ThemeContext.jsx";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme !== "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        minHeight: 40,
        padding: "0 13px",
        border: "1px solid var(--sv-border)",
        borderRadius: 10,
        background: "var(--sv-surface)",
        color: "var(--sv-text)",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 650,
        transition: "background 180ms ease, color 180ms ease",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 17 }}>
        {isDark ? "☼" : "☾"}
      </span>
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
