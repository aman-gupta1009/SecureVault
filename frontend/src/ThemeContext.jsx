
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "securevault-theme";

export const THEME_OPTIONS = [
  {
    id: "dark",
    name: "Emerald Dark",
    description: "Graphite + emerald green",
    icon: "◈",
    colors: ["#1b3026", "#48d6a0", "#e2f4e9"],
    palette: {
      page: "#080d0b",
      surface: "#0d1711",
      raised: "#14221a",
      input: "#09110c",
      text: "#edf8f0",
      muted: "#91a99a",
      border: "#294034",
      accent: "#48d6a0",
      accentHover: "#70e6b4",
      accentText: "#07140c",
      successBg: "#10271a",
      successText: "#9af1b9",
      danger: "#ff9292",
    },
  },
  {
    id: "light",
    name: "Clean Light",
    description: "White + soft green",
    icon: "☼",
    colors: ["#ffffff", "#168c55", "#17392b"],
    palette: {
      page: "#f2f7f3",
      surface: "#ffffff",
      raised: "#eaf2ec",
      input: "#ffffff",
      text: "#17271d",
      muted: "#627668",
      border: "#d4e3d8",
      accent: "#168c55",
      accentHover: "#0f713d",
      accentText: "#ffffff",
      successBg: "#e7f7ed",
      successText: "#17683a",
      danger: "#c52f3b",
    },
  },
  {
    id: "midnight",
    name: "Midnight Blue",
    description: "Navy + electric blue",
    icon: "☾",
    colors: ["#202f4c", "#78a4ff", "#e4ecff"],
    palette: {
      page: "#0a1020",
      surface: "#111b30",
      raised: "#192641",
      input: "#0c1528",
      text: "#edf2ff",
      muted: "#9aaed0",
      border: "#2b3d5c",
      accent: "#78a4ff",
      accentHover: "#9bbaff",
      accentText: "#091326",
      successBg: "#172c42",
      successText: "#a8d4ff",
      danger: "#ff929d",
    },
  },
  {
    id: "purple",
    name: "Royal Purple",
    description: "Deep purple + lavender",
    icon: "✧",
    colors: ["#392b48", "#c69aff", "#f0e4ff"],
    palette: {
      page: "#120d19",
      surface: "#21182b",
      raised: "#2c2039",
      input: "#191221",
      text: "#f5edff",
      muted: "#b9a6cc",
      border: "#49365b",
      accent: "#c69aff",
      accentHover: "#d8baff",
      accentText: "#1b1027",
      successBg: "#30203d",
      successText: "#d9baff",
      danger: "#ff9aaa",
    },
  },
  {
    id: "ocean",
    name: "Ocean Teal",
    description: "Deep teal + aqua",
    icon: "≋",
    colors: ["#18343a", "#54d6d0", "#d9f7f4"],
    palette: {
      page: "#091719",
      surface: "#102326",
      raised: "#183135",
      input: "#0b1c1f",
      text: "#e8fbf9",
      muted: "#98c2bf",
      border: "#2b5051",
      accent: "#54d6d0",
      accentHover: "#7ce5df",
      accentText: "#08201f",
      successBg: "#153638",
      successText: "#9be9df",
      danger: "#ff9999",
    },
  },
  {
    id: "amber",
    name: "Warm Amber",
    description: "Charcoal + amber gold",
    icon: "☀",
    colors: ["#382d1e", "#e9ad55", "#fff0d4"],
    palette: {
      page: "#17130e",
      surface: "#241e16",
      raised: "#30271c",
      input: "#1c1711",
      text: "#fff5e5",
      muted: "#c1ad91",
      border: "#51412b",
      accent: "#e9ad55",
      accentHover: "#f5c477",
      accentText: "#241708",
      successBg: "#3a2e1b",
      successText: "#f4d49a",
      danger: "#ff9990",
    },
  },
];

function applyTheme(themeId) {
  const selected =
    THEME_OPTIONS.find((item) => item.id === themeId) ||
    THEME_OPTIONS[0];

  const root = document.documentElement;
  const p = selected.palette;

  root.dataset.theme = selected.id;
  root.style.colorScheme = selected.id === "light" ? "light" : "dark";

  const variables = {
    "--sv-page-bg": p.page,
    "--sv-surface": p.surface,
    "--sv-surface-raised": p.raised,
    "--sv-input-bg": p.input,
    "--sv-text": p.text,
    "--sv-text-muted": p.muted,
    "--sv-border": p.border,
    "--sv-accent": p.accent,
    "--sv-accent-hover": p.accentHover,
    "--sv-accent-text": p.accentText,
    "--sv-success-bg": p.successBg,
    "--sv-success-text": p.successText,
    "--sv-danger": p.danger,

    /* Compatibility with older module styles */
    "--text-primary": p.text,
    "--text-secondary": p.muted,
    "--text-muted": p.muted,
    "--border-color": p.border,
    "--surface-card": p.surface,
    "--surface-secondary": p.raised,
    "--surface-hover": p.raised,
    "--line": p.border,
    "--mint": p.accent,
    "--muted": p.muted,
  };

  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return THEME_OPTIONS.some((item) => item.id === saved)
        ? saved
        : "dark";
    } catch {
      return "dark";
    }
  });

  const setTheme = (nextTheme) => {
    if (THEME_OPTIONS.some((item) => item.id === nextTheme)) {
      setThemeState(nextTheme);
    }
  };

  useEffect(() => {
    applyTheme(theme);

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // App remains usable if storage is unavailable.
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((current) =>
      current === "light" ? "dark" : "light"
    );
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark: theme !== "light",
        themeOptions: THEME_OPTIONS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}
