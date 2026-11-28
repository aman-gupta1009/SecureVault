
import { useCallback, useEffect, useState } from "react";

import Dashboard from "../pages/Dashboard.jsx";
import Files from "../pages/Files.jsx";
import Backups from "../pages/Backups.jsx";
import PasswordManager from "../pages/PasswordManager.jsx";
import Notifications from "../pages/Notifications.jsx";
import DevicesSessions from "../pages/DevicesSessions.jsx";
import Settings from "../pages/Settings.jsx";
import Security from "../pages/Security.jsx";
import SecureSharing from "../pages/SecureSharing.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import WorkspaceSection from "../pages/WorkspaceSection.jsx";

const API_BASE = "http://localhost:4000/api";

const groups = [
  {
    label: "WORKSPACE",
    items: [
      ["Overview", "grid"],
      ["My Files", "files"],
      ["Smart Organization", "folders"],
      ["Backups", "backup"],
      ["Secure Sharing", "share"],
    ],
  },
  {
    label: "SECURITY",
    items: [
      ["Password Manager", "key"],
      ["Notifications", "bell"],
      ["Devices & Sessions", "devices"],
    ],
  },
];

function Glyph({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const shapes = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    files: (
      <>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H10l2 2h5.5A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z" />
        <path d="M4 9h16" />
      </>
    ),
    folders: (
      <>
        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
        <path d="M3 10h18" />
      </>
    ),
    backup: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" />
      </>
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 9-9 2 2-3 3 2 2-3 3-2-2-3 3" />
      </>
    ),
    bell: (
      <>
        <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    devices: (
      <>
        <rect x="3" y="4" width="13" height="12" rx="2" />
        <path d="M7 20h5M9.5 16v4" />
        <rect x="17" y="8" width="4" height="12" rx="1" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path
          d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z"
          transform="translate(-1 -1) scale(1.08)"
        />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    panel: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
      </>
    ),
  };

  return <svg {...common}>{shapes[name] || shapes.grid}</svg>;
}

export default function WorkspaceShell({
  user,
  busy,
  onSignOut,
  activePage,
  onNavigate,
}) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return (
        localStorage.getItem("securevault-sidebar-collapsed") === "true"
      );
    } catch {
      return false;
    }
  });

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await fetch(
        `${API_BASE}/notifications/unread-count`,
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (response.status === 401) {
        setUnreadCount(0);
        return;
      }

      const data = await response.json();

      if (response.ok && data.success) {
        setUnreadCount(
          Math.max(0, Number(data.data?.unreadCount) || 0)
        );
      }
    } catch (error) {
      console.error("Unread notification count error:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "securevault-sidebar-collapsed",
        String(collapsed)
      );
    } catch {
      // Session-only state.
    }
  }, [collapsed]);

  useEffect(() => {
    refreshUnreadCount();

    const interval = window.setInterval(
      refreshUnreadCount,
      30000
    );

    window.addEventListener(
      "securevault:notifications-updated",
      refreshUnreadCount
    );

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(
        "securevault:notifications-updated",
        refreshUnreadCount
      );
    };
  }, [refreshUnreadCount]);

  function navigateTo(page) {
    if (page === "Files") {
      setSelectedCategory(null);
    }

    onNavigate(page);
  }

  function selectCategory(category) {
    setSelectedCategory(category);
    onNavigate("Files");
  }

  function renderPage() {
    if (activePage === "Overview") {
      return <Dashboard onNavigate={onNavigate} />;
    }

    if (activePage === "Files") {
      return (
        <Files
          onNavigate={navigateTo}
          categoryFilter={selectedCategory}
        />
      );
    }

    if (activePage === "Backups") {
      return <Backups onNavigate={onNavigate} />;
    }

    if (activePage === "Password Manager") {
      return <PasswordManager />;
    }

    if (activePage === "Notifications") {
      return <Notifications />;
    }

    if (activePage === "Devices & Sessions") {
      return <DevicesSessions />;
    }
    if (activePage === "Security") {
  return <Security onNavigate={navigateTo} />;
}
    if (activePage === "Settings") {
      return (
        <Settings
          onNavigate={navigateTo}
          sidebarCollapsed={collapsed}
          onToggleSidebar={() => setCollapsed((value) => !value)}
        />
      );
    }
    if (activePage === "Secure Sharing") {
  return <SecureSharing />;
}

    return (
      <WorkspaceSection
        page={activePage}
        onNavigate={navigateTo}
        onCategorySelect={selectCategory}
      />
    );
  }

  const title = activePage === "Files" ? "My Files" : activePage;

  return (
    <main className={`sv-workspace ${collapsed ? "is-collapsed" : ""}`}>
      <aside className="sv-workspace-sidebar">
        <div className="sv-workspace-brand-row">
          <div className="sv-workspace-brand-mark">
            <Glyph name="shield" size={22} />
          </div>

          <div className="sv-workspace-brand-copy">
            <strong>
              SecureVault<span>.</span>
            </strong>
            <small>PRIVATE WORKSPACE</small>
          </div>

          <button
            className="sv-sidebar-collapse"
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            <Glyph name={collapsed ? "chevron" : "panel"} size={17} />
          </button>
        </div>

        <div className="sv-sidebar-scroll">
          {groups.map((group) => (
            <div className="sv-nav-group" key={group.label}>
              <div className="sv-nav-group-label">{group.label}</div>

              <nav
                className="sv-workspace-nav"
                aria-label={group.label}
              >
                {group.items.map(([label, icon]) => {
                  const page =
                    label === "My Files" ? "Files" : label;

                  const active = activePage === page;

                  return (
                    <button
                      key={label}
                      type="button"
                      className={`sv-nav-item ${active ? "active" : ""}`}
                      onClick={() => navigateTo(page)}
                      title={collapsed ? label : undefined}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="sv-nav-icon">
                        <Glyph name={icon} />
                      </span>

                      <span className="sv-nav-text">{label}</span>

                      {label === "Notifications" && unreadCount > 0 && (
                        <span
                          className="sv-notification-badge"
                          aria-label={`${unreadCount} unread notifications`}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}

                      <span className="sv-nav-chevron">
                        <Glyph name="chevron" size={14} />
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="sv-sidebar-footer">
          <button
            type="button"
            className={`sv-nav-item ${activePage === "Settings" ? "active" : ""}`}
            onClick={() => navigateTo("Settings")}
            title={collapsed ? "Settings" : undefined}
            aria-current={activePage === "Settings" ? "page" : undefined}
          >
            <span className="sv-nav-icon">
              <Glyph name="settings" />
            </span>

            <span className="sv-nav-text">Settings</span>
            <span className="sv-nav-chevron">
              <Glyph name="chevron" size={14} />
            </span>
          </button>

          <div className="sv-profile-card">
            <div className="sv-avatar">
              {(user?.email || "U").slice(0, 1).toUpperCase()}
            </div>

            <div className="sv-profile-copy">
              <strong>Account</strong>
              <span>{user?.email || "Signed in"}</span>
            </div>

            <button
              className="sv-signout-icon"
              type="button"
              onClick={onSignOut}
              disabled={busy}
              title="Sign out"
              aria-label="Sign out"
            >
              <Glyph name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>

      <section className="sv-workspace-main">
        <header className="sv-workspace-topbar">
          <div className="sv-breadcrumb">
            <span>Workspace</span>
            <Glyph name="chevron" size={13} />
            <strong>
              {title}
              {activePage === "Files" && selectedCategory
                ? ` / ${selectedCategory}`
                : ""}
            </strong>
          </div>

          <div className="sv-topbar-actions">
            <span className="sv-session-indicator">
              <i />
              Secure session
            </span>

            <ThemeToggle />
          </div>
        </header>

        <div className="sv-workspace-content">
          {renderPage()}
        </div>
      </section>
    </main>
  );
}
