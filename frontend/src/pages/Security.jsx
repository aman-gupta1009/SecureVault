
import { useCallback, useEffect, useState } from "react";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api"
).replace(/\/$/, "");

const securityItems = [
  {
    id: "auth",
    icon: "◎",
    title: "Account authentication",
    description:
      "Email verification and password-based sign-in protect account access.",
  },
  {
    id: "vault",
    icon: "⬡",
    title: "Vault lock",
    description:
      "Check your live vault status and unlock your vault when needed.",
  },
  {
    id: "backup",
    icon: "◈",
    title: "Backup integrity",
    description:
      "Backup verification helps detect unexpected changes to backup data.",
  },
  {
    id: "sessions",
    icon: "⌘",
    title: "Session management",
    description:
      "Review account sessions and revoke access when necessary.",
  },
];

const styles = `
<CodeBlock language="css" editable>
.sv-page {
  color: var(--sv-text);
  width: 100%;
  min-width: 0;
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  padding: 20px 22px 28px;
}


.sv-page > header {
margin: 0 0 24px;
padding: 4px 2px 0;
}

.sv-page .sv-heading {
margin: 10px 0 8px;
font-size: clamp(25px, 3vw, 32px);
font-weight: 750;
letter-spacing: -1px;
line-height: 1.25;
}

.sv-page > header p {
margin: 0;
line-height: 1.7;
}

@media (max-width: 650px) {
.sv-page {
padding: 16px 14px 22px;
}

.sv-page > header {
margin-bottom: 20px;
}
}
</CodeBlock>
.sv-page * { box-sizing: border-box; }
.sv-page .sv-eyebrow {
  color: var(--sv-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.7px;
  text-transform: uppercase;
}
.sv-page .sv-heading {
  margin: 8px 0;
  font-size: clamp(25px, 3vw, 32px);
  font-weight: 750;
  letter-spacing: -1px;
}
.sv-page .sv-muted {
  color: var(--sv-text-muted);
  font-size: 13px;
  line-height: 1.7;
}
.sv-page .sv-card {
  min-width: 0;
  border: 1px solid var(--sv-border);
  border-radius: 17px;
  background: var(--sv-surface);
  box-shadow: var(--sv-shadow);
}
.sv-page .sv-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15px;
  margin: 24px 0;
}
.sv-page .sv-security-card {
  padding: 19px;
  transition: border-color 160ms ease, transform 160ms ease;
}
.sv-page .sv-security-card:hover {
  border-color: var(--sv-accent);
  transform: translateY(-2px);
}
.sv-page .sv-icon {
  display: grid;
  place-items: center;
  width: 43px;
  height: 43px;
  border: 1px solid var(--sv-border);
  border-radius: 12px;
  background: var(--sv-surface-raised);
  color: var(--sv-accent);
  font-size: 22px;
}
.sv-page .sv-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 9px;
  border: 1px solid var(--sv-border);
  border-radius: 99px;
  background: var(--sv-surface-raised);
  color: var(--sv-text-muted);
  font-size: 10px;
  font-weight: 800;
}
.sv-page .sv-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--sv-accent);
}
.sv-page .sv-button {
  min-height: 41px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 15px;
  border: 1px solid var(--sv-border);
  border-radius: 10px;
  background: var(--sv-surface-raised);
  color: var(--sv-text);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: 160ms ease;
}
.sv-page .sv-button:hover { border-color: var(--sv-accent); }
.sv-page .sv-button:disabled {
  opacity: .6;
  cursor: not-allowed;
}
.sv-page .sv-input {
  display: block;
  width: 100%;
  min-height: 43px;
  margin-top: 8px;
  padding: 10px 12px;
  border: 1px solid var(--sv-border);
  border-radius: 10px;
  outline: none;
  background: var(--sv-surface-raised);
  color: var(--sv-text);
  font: inherit;
  font-size: 13px;
}
.sv-page .sv-input:focus { border-color: var(--sv-accent); }
.sv-page .sv-notice {
  padding: 17px;
  border: 1px solid var(--sv-border);
  border-radius: 14px;
  background: var(--sv-surface-raised);
}
.sv-page .sv-alert {
  margin-top: 13px;
  padding: 12px;
  border: 1px solid var(--sv-border);
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.sv-page .sv-alert-error { border-color: #f87171; }
.sv-page .sv-alert-success { border-color: var(--sv-accent); }
@media (max-width: 650px) {
  .sv-page .sv-grid { grid-template-columns: 1fr; }
  .sv-page .sv-security-card { padding: 16px; }
}
`;

async function apiRequest(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Backend se connection nahi ho pa raha. Check karo ki backend port 4000 par running hai."
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok || body?.success === false) {
    throw new Error(
      body?.message ||
        body?.error ||
        `Request failed (${response.status}). Please try again.`
    );
  }

  return body;
}

function getResponseData(body) {
  return body?.data ?? body?.result ?? body;
}

export default function Security({ onNavigate }) {
  const [expanded, setExpanded] = useState(null);
  const [vaultStatus, setVaultStatus] = useState("loading");
  const [vaultMessage, setVaultMessage] = useState("");
  const [vaultDetails, setVaultDetails] = useState(null);
  const [vaultPassword, setVaultPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadVaultStatus = useCallback(async () => {
    setRefreshing(true);
    setError("");
    setSuccess("");

    try {
      const body = await apiRequest("/vault/status");
      const data = getResponseData(body);

      if (typeof data?.isLocked !== "boolean") {
        throw new Error(
          "Vault status response mein isLocked field nahi mili. Backend response check karna hoga."
        );
      }

      setVaultDetails(data);
      setVaultStatus(data.isLocked ? "locked" : "unlocked");
      setVaultMessage(
        data.isLocked
          ? "Vault locked hai. Files use karne ke liye apna account password enter karke unlock karo."
          : "Vault unlocked hai. Ab protected file operations try kar sakte ho."
      );
    } catch (err) {
      setVaultStatus("error");
      setVaultDetails(null);
      setVaultMessage("Live vault status load nahi ho saka.");
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVaultStatus();
  }, [loadVaultStatus]);

  async function handleUnlock(event) {
    event.preventDefault();

    if (!vaultPassword) {
      setError("Unlock karne ke liye apna account password enter karo.");
      return;
    }

    setUnlocking(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest("/vault/unlock", {
        method: "POST",
        body: JSON.stringify({ password: vaultPassword }),
      });

      setVaultPassword("");
      setShowPassword(false);
      setSuccess("Unlock request successful. Vault status verify ho raha hai.");

      // Unlock response ke bajaye backend status se final state confirm karo.
      const body = await apiRequest("/vault/status");
      const data = getResponseData(body);

      if (typeof data?.isLocked !== "boolean") {
        throw new Error(
          "Unlock request ke baad live vault status verify nahi ho saka."
        );
      }

      setVaultDetails(data);
      setVaultStatus(data.isLocked ? "locked" : "unlocked");

      if (data.isLocked) {
        setSuccess("");
        setError(
          "Backend ne unlock request accept ki, lekin status abhi bhi locked hai. Backend vault-lock logic check karna hoga."
        );
      } else {
        setSuccess("Vault successfully unlocked!");
        setVaultMessage(
          "Vault unlocked hai. Ab My Files page par jaakar upload try karo."
        );
      }
    } catch (err) {
      setSuccess("");
      setError(err.message);
      await loadVaultStatus();
    } finally {
      setUnlocking(false);
    }
  }

  function getItemStatus(item) {
    if (item.id === "vault") {
      if (vaultStatus === "loading") return "Checking…";
      if (vaultStatus === "locked") return "Locked";
      if (vaultStatus === "unlocked") return "Unlocked";
      return "Unavailable";
    }

    if (item.id === "auth") return "Not audited";
    if (item.id === "backup") return "Not checked";
    return "Not checked";
  }

  return (
    <section className="sv-page">
      <style>{styles}</style>

      <header>
        <div className="sv-eyebrow">Protection & access control</div>
        <h1 className="sv-heading">Security Center</h1>
        <p className="sv-muted">
          Review the key protection areas for your SecureVault account.
        </p>
      </header>

      <div
        className="sv-notice"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 13,
          marginTop: 22,
        }}
      >
        <span
          aria-hidden="true"
          style={{ color: "var(--sv-accent)", fontSize: 21 }}
        >
          ⛨
        </span>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 750 }}>
            {vaultStatus === "loading"
              ? "Checking live vault status…"
              : vaultStatus === "locked"
                ? "Your vault is locked"
                : vaultStatus === "unlocked"
                  ? "Your vault is unlocked"
                  : "Vault status could not be checked"}
          </div>

          <p className="sv-muted" style={{ margin: "6px 0 0" }}>
            {vaultMessage ||
              "Vault status is retrieved from the SecureVault backend."}
          </p>

          <button
            type="button"
            className="sv-button"
            style={{ marginTop: 12 }}
            onClick={loadVaultStatus}
            disabled={refreshing}
          >
            {refreshing ? "Checking…" : "↻ Refresh vault status"}
          </button>
        </div>
      </div>

      <div className="sv-grid">
        {securityItems.map((item) => (
          <article className="sv-card sv-security-card" key={item.id}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div className="sv-icon" aria-hidden="true">
                {item.icon}
              </div>

              <span className="sv-status">
                <span className="sv-status-dot" />
                {getItemStatus(item)}
              </span>
            </div>

            <h2
              style={{
                margin: "19px 0 8px",
                fontSize: 16,
                fontWeight: 750,
                letterSpacing: "-.2px",
              }}
            >
              {item.title}
            </h2>

            <p className="sv-muted" style={{ margin: 0 }}>
              {item.description}
            </p>

            <button
              type="button"
              className="sv-button"
              style={{ marginTop: 18 }}
              aria-expanded={expanded === item.id}
              onClick={() => {
                setExpanded((current) =>
                  current === item.id ? null : item.id
                );
                setError("");
                setSuccess("");
              }}
            >
              {expanded === item.id ? "Hide details" : "View details"}
              <span aria-hidden="true">
                {expanded === item.id ? "↑" : "→"}
              </span>
            </button>

            {expanded === item.id && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid var(--sv-border)",
                  background: "var(--sv-surface-raised)",
                }}
              >
                {item.id === "vault" ? (
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 750,
                        marginBottom: 8,
                      }}
                    >
                      Live vault control
                    </div>

                    <p className="sv-muted" style={{ margin: "0 0 12px" }}>
                      {vaultStatus === "locked"
                        ? "Unlock karne ke liye apna SecureVault account password enter karo."
                        : vaultStatus === "unlocked"
                          ? "Vault abhi unlocked hai. Kaam complete hone par ise lock kar sakte ho."
                          : vaultStatus === "loading"
                            ? "Backend status load ho raha hai."
                            : "Pehle backend connection aur login session check karo."}
                    </p>

                    {vaultDetails && (
                      <div className="sv-muted" style={{ marginBottom: 12 }}>
                        {vaultDetails.lockedAt && (
                          <div>
                            Last locked:{" "}
                            {new Date(vaultDetails.lockedAt).toLocaleString()}
                          </div>
                        )}
                        {vaultDetails.unlockedAt && (
                          <div>
                            Last unlocked:{" "}
                            {new Date(
                              vaultDetails.unlockedAt
                            ).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}

                    {vaultStatus === "locked" && (
                      <form onSubmit={handleUnlock}>
                        <label
                          htmlFor="sv-vault-password"
                          className="sv-muted"
                        >
                          Account password
                        </label>

                        <input
                          id="sv-vault-password"
                          className="sv-input"
                          type={showPassword ? "text" : "password"}
                          value={vaultPassword}
                          onChange={(event) =>
                            setVaultPassword(event.target.value)
                          }
                          autoComplete="current-password"
                          placeholder="Enter your account password"
                          required
                        />

                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 10,
                            fontSize: 12,
                            color: "var(--sv-text-muted)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={showPassword}
                            onChange={(event) =>
                              setShowPassword(event.target.checked)
                            }
                          />
                          Show password
                        </label>

                        <button
                          type="submit"
                          className="sv-button"
                          style={{ marginTop: 12 }}
                          disabled={unlocking}
                        >
                          {unlocking ? "Unlocking…" : "Unlock Vault"}
                        </button>
                      </form>
                    )}

                    {vaultStatus === "unlocked" && (
                      <button
                        type="button"
                        className="sv-button"
                        onClick={() => onNavigate?.("Files")}
                      >
                        Open My Files →
                      </button>
                    )}

                    {vaultStatus === "error" && (
                      <button
                        type="button"
                        className="sv-button"
                        onClick={loadVaultStatus}
                        disabled={refreshing}
                      >
                        Retry connection
                      </button>
                    )}

                    {error && (
                      <div
                        role="alert"
                        className="sv-alert sv-alert-error"
                      >
                        {error}
                      </div>
                    )}

                    {success && (
                      <div
                        role="status"
                        className="sv-alert sv-alert-success"
                      >
                        {success}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="sv-muted" style={{ margin: 0 }}>
                    {item.id === "auth"
                      ? "This page has not performed a full account security audit."
                      : item.id === "backup"
                        ? "Open Backup Center to create or verify a backup. This card does not run an integrity check."
                        : "Live session information is not connected to this card yet."}
                  </p>
                )}
              </div>
            )}
          </article>
        ))}
      </div>

      <div className="sv-card" style={{ padding: 20 }}>
        <div className="sv-eyebrow">Recommended next step</div>

        <h2 style={{ margin: "9px 0", fontSize: 17, fontWeight: 750 }}>
          Review your vault workspace
        </h2>

        <p className="sv-muted" style={{ margin: "0 0 17px" }}>
          Unlock your vault before uploading or managing protected files.
          Security cards that are not connected to backend checks are not
          presented as completed security audits.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="sv-button"
            onClick={() => onNavigate?.("Overview")}
          >
            ← Overview
          </button>

          <button
            type="button"
            className="sv-button"
            onClick={() => onNavigate?.("Files")}
          >
            Open My Files →
          </button>

          <button
            type="button"
            className="sv-button"
            onClick={() => onNavigate?.("Backups")}
          >
            Backup Center →
          </button>
        </div>
      </div>
    </section>
  );
}
