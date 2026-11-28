
import { useCallback, useEffect, useState } from "react";
import "./DevicesSessions.css";
import SecureVaultDialog from "../components/SecureVaultDialog.jsx";

const API_BASE = "http://localhost:4000/api";

function getBrowserName(userAgent = "") {
  const ua = userAgent.toLowerCase();

  if (ua.includes("edg/")) return "Microsoft Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/") && !ua.includes("chromium")) return "Google Chrome";
  if (ua.includes("firefox/")) return "Mozilla Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";

  return "Unknown browser";
}

function getOperatingSystem(userAgent = "") {
  const ua = userAgent.toLowerCase();

  if (ua.includes("windows")) return "Windows";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "iOS";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("linux")) return "Linux";

  return "Unknown operating system";
}

function formatDate(value) {
  if (!value) return "Unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function DeviceIcon({ userAgent = "" }) {
  const os = getOperatingSystem(userAgent);

  if (os === "Android" || os === "iOS") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <path d="M10 18.5h4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 16v5M3 12h18" />
    </svg>
  );
}

function getDeviceDetails(session) {
  const browser = getBrowserName(session.userAgent);
  const operatingSystem = getOperatingSystem(session.userAgent);

  return {
    browser,
    operatingSystem,
    title:
      browser === "Unknown browser"
        ? session.deviceName || "Unknown device"
        : browser,
  };
}

function SummaryCard({ label, value, detail, icon }) {
  return (
    <div className="dss-summary-card">
      <div className="dss-summary-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

export default function DevicesSessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [actionId, setActionId] = useState(null);
  const [revokeOthersBusy, setRevokeOthersBusy] = useState(false);

  const [dialog, setDialog] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);

  const refreshSessions = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setRefreshing(true);
    }

    setError("");

    try {
      const response = await fetch(`${API_BASE}/device-sessions`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load device sessions."
        );
      }

      setSessions(
        Array.isArray(result.data?.sessions)
          ? result.data.sessions
          : []
      );
    } catch (err) {
      setError(
        err.message || "Something went wrong while loading sessions."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const closeDialog = useCallback(() => {
    if (!dialogBusy) {
      setDialog(null);
    }
  }, [dialogBusy]);

  const currentSession = sessions.find((session) => session.isCurrent);
  const otherSessions = sessions.filter((session) => !session.isCurrent);

  function requestRevokeSession(session) {
    if (session.isCurrent) {
      setError("Your current session cannot be revoked from this action.");
      return;
    }

    setError("");
    setNotice("");

    setDialog({
      type: "single",
      session,
      title: "Revoke this device session?",
      description:
        "This device will be signed out of SecureVault and will need to sign in again to access your account and vault.",
      confirmLabel: "Revoke Device",
    });
  }

  function requestRevokeOtherSessions() {
    if (otherSessions.length === 0) return;

    setError("");
    setNotice("");

    setDialog({
      type: "others",
      title: "Log out other devices?",
      description:
        `This will sign out ${otherSessions.length} other device session(s). ` +
        "Your current device will remain signed in. You can sign in again on those devices whenever needed.",
      confirmLabel: "Log Out Other Devices",
    });
  }

  async function confirmDialogAction() {
    if (!dialog || dialogBusy) return;

    const currentDialog = dialog;

    setDialogBusy(true);
    setError("");
    setNotice("");

    if (currentDialog.type === "single") {
      const session = currentDialog.session;
      setActionId(session.sessionId);

      try {
        const response = await fetch(
          `${API_BASE}/device-sessions/${encodeURIComponent(session.sessionId)}`,
          {
            method: "DELETE",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Unable to revoke this session."
          );
        }

        setNotice("Device session revoked successfully.");
        setDialog(null);
        await refreshSessions();
      } catch (err) {
        setError(err.message || "Unable to revoke this session.");
        setDialog(null);
      } finally {
        setActionId(null);
        setDialogBusy(false);
      }

      return;
    }

    if (currentDialog.type === "others") {
      setRevokeOthersBusy(true);

      try {
        const response = await fetch(
          `${API_BASE}/device-sessions/revoke-others`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Unable to revoke other sessions."
          );
        }

        const count = Number(result.data?.revokedCount) || 0;

        setNotice(
          count === 1
            ? "1 other device session has been signed out."
            : `${count} other device sessions have been signed out.`
        );

        setDialog(null);
        await refreshSessions();
      } catch (err) {
        setError(err.message || "Unable to revoke other sessions.");
        setDialog(null);
      } finally {
        setRevokeOthersBusy(false);
        setDialogBusy(false);
      }
    }
  }

  return (
    <>
      <section className="dss-page">
        <div className="dss-heading">
          <div>
            <span className="dss-eyebrow">ACCOUNT SECURITY</span>
            <h1>Devices &amp; Sessions</h1>
            <p>
              Review where your SecureVault account is signed in and manage
              access to your account.
            </p>
          </div>

          <button
            type="button"
            className="dss-refresh-button"
            onClick={() => refreshSessions(true)}
            disabled={refreshing || loading}
          >
            <span className={refreshing ? "dss-refresh-spin" : ""}>↻</span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="dss-message dss-error" role="alert">
            <span>!</span>
            {error}
          </div>
        )}

        {notice && (
          <div className="dss-message dss-success" role="status">
            <span>✓</span>
            {notice}
          </div>
        )}

        <div className="dss-summary-grid">
          <SummaryCard
            label="Active sessions"
            value={loading ? "—" : sessions.length}
            detail="Currently valid sign-ins"
            icon="◉"
          />

          <SummaryCard
            label="Other devices"
            value={loading ? "—" : otherSessions.length}
            detail="Sessions besides this device"
            icon="⌘"
          />

          <SummaryCard
            label="Current session"
            value={loading ? "—" : currentSession ? "Active" : "Not found"}
            detail="This browser session"
            icon="✓"
          />
        </div>

        <div className="dss-section-heading">
          <div>
            <span className="dss-eyebrow">SIGNED-IN DEVICES</span>
            <h2>Active sessions</h2>
            <p>
              Revoking a session prevents that device from making further
              authenticated requests.
            </p>
          </div>

          <button
            type="button"
            className="dss-revoke-all"
            onClick={requestRevokeOtherSessions}
            disabled={
              loading ||
              revokeOthersBusy ||
              otherSessions.length === 0
            }
          >
            {revokeOthersBusy ? "Signing out..." : "Log out other devices"}
          </button>
        </div>

        {loading ? (
          <div className="dss-state-card">
            <div className="dss-loader" />
            <strong>Loading your sessions</strong>
            <p>Checking active devices linked to your account.</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="dss-state-card">
            <div className="dss-state-icon">⌘</div>
            <strong>No active sessions found</strong>
            <p>
              Your active device sessions will appear here after you sign in.
            </p>
            <button
              type="button"
              className="dss-secondary-button"
              onClick={() => refreshSessions(true)}
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="dss-session-list">
            {sessions.map((session) => {
              const details = getDeviceDetails(session);
              const isBusy = actionId === session.sessionId;

              return (
                <article
                  className={`dss-session-card ${
                    session.isCurrent ? "dss-current-session" : ""
                  }`}
                  key={session.sessionId}
                >
                  <div className="dss-device-icon">
                    <DeviceIcon userAgent={session.userAgent} />
                  </div>

                  <div className="dss-session-main">
                    <div className="dss-session-title-row">
                      <h3>{details.title}</h3>

                      {session.isCurrent && (
                        <span className="dss-current-badge">
                          <i />
                          This device
                        </span>
                      )}
                    </div>

                    <p className="dss-device-subtitle">
                      {details.operatingSystem} · {details.browser}
                    </p>

                    <div className="dss-session-meta">
                      <span>
                        <small>IP address</small>
                        <strong>{session.ipAddress || "Unavailable"}</strong>
                      </span>

                      <span>
                        <small>Last activity</small>
                        <strong>{formatDate(session.lastActivityAt)}</strong>
                      </span>

                      <span>
                        <small>Signed in</small>
                        <strong>{formatDate(session.createdAt)}</strong>
                      </span>

                      <span>
                        <small>Session expires</small>
                        <strong>{formatDate(session.expiresAt)}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="dss-session-action">
                    {session.isCurrent ? (
                      <span className="dss-protected-label">
                        <span>✓</span>
                        Protected
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="dss-revoke-button"
                        onClick={() => requestRevokeSession(session)}
                        disabled={Boolean(actionId) || revokeOthersBusy}
                      >
                        {isBusy ? "Revoking..." : "Revoke"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="dss-security-note">
          <div className="dss-security-note-icon">盾</div>
          <div>
            <strong>Keep your account secure</strong>
            <p>
              If you notice a device you do not recognize, revoke its session
              and change your account password. Your current session is kept
              active when you use the other-device sign-out action.
            </p>
          </div>
        </div>

        <footer className="dss-footer">
          <span>SECUREVAULT ACCOUNT ACCESS</span>
          <span>{loading ? "SYNCING SESSIONS" : "SESSION STATUS UPDATED"}</span>
        </footer>
      </section>

      <SecureVaultDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        description={dialog?.description}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel="Cancel"
        variant="danger"
        busy={dialogBusy}
        onConfirm={confirmDialogAction}
        onCancel={closeDialog}
      />
    </>
  );
}
