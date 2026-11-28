
import { useCallback, useEffect, useState } from "react";
import "./SecureSharing.css";

const API =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Request failed (${response.status})`);
  }

  return result;
}

function formatDate(value) {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function formatBytes(value = 0) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    4
  );

  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export default function SecureSharing() {
  const [files, setFiles] = useState([]);
  const [shares, setShares] = useState([]);
  const [selectedFile, setSelectedFile] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [permissionType, setPermissionType] = useState("VIEW");
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [maxOpens, setMaxOpens] = useState("");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [revokingId, setRevokingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const [fileResult, shareResult] = await Promise.all([
        request("/vault/files?page=1&limit=100"),
        request(`/shares?page=1&limit=100&status=${filter}`),
      ]);

      const fileData = fileResult.data || {};
      const shareData = shareResult.data || {};

      setFiles(Array.isArray(fileData.files) ? fileData.files : []);
      setShares(Array.isArray(shareData.shares) ? shareData.shares : []);

    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Unable to load sharing information.",
      });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateShare(event) {
    event.preventDefault();

    if (!selectedFile) {
      setNotice({
        type: "error",
        text: "Please select a file first.",
      });
      return;
    }

    if (!recipientEmail.trim()) {
      setNotice({
        type: "error",
        text: "Enter the recipient's email address.",
      });
      return;
    }

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      setNotice({
        type: "error",
        text: "Expiry must be a future date and time.",
      });
      return;
    }

    if (
      maxOpens &&
      (!Number.isInteger(Number(maxOpens)) ||
        Number(maxOpens) < 1 ||
        Number(maxOpens) > 10000)
    ) {
      setNotice({
        type: "error",
        text: "Maximum opens must be between 1 and 10000.",
      });
      return;
    }

    if (
      permissionType === "DOWNLOAD" &&
      maxDownloads &&
      (!Number.isInteger(Number(maxDownloads)) ||
        Number(maxDownloads) < 1 ||
        Number(maxDownloads) > 10000)
    ) {
      setNotice({
        type: "error",
        text: "Maximum downloads must be between 1 and 10000.",
      });
      return;
    }

    setCreating(true);
    setNotice(null);

    try {
      const result = await request("/shares", {
        method: "POST",
        body: JSON.stringify({
          fileId: Number(selectedFile),
          recipientEmail: recipientEmail.trim().toLowerCase(),
          permissionType,
          watermarkEnabled,
          expiresAt: expiresAt
            ? new Date(expiresAt).toISOString()
            : null,
          maxOpens: maxOpens ? Number(maxOpens) : null,
          maxDownloads:
            permissionType === "DOWNLOAD" && maxDownloads
              ? Number(maxDownloads)
              : null,
        }),
      });

      const share = result.data || {};

      if (share.invitationSent !== true) {
        throw new Error(
          "The server did not confirm that the invitation email was sent."
        );
      }

      setRecipientEmail("");
      setExpiresAt("");
      setMaxOpens("");
      setMaxDownloads("");
      setWatermarkEnabled(false);

      await loadData();

      setNotice({
        type: "success",
        text:
          result.message ||
          `Secure invitation sent successfully to ${share.recipientEmail || "the recipient"}.`,
      });

    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Could not send the share invitation.",
      });
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(shareId) {
    const confirmed = window.confirm(
      "Revoke this share? The recipient will no longer be able to access the file."
    );

    if (!confirmed) return;

    setRevokingId(shareId);
    setNotice(null);

    try {
      await request(`/shares/${shareId}`, {
        method: "DELETE",
      });

      setNotice({
        type: "success",
        text: "Share access has been revoked.",
      });

      await loadData();

    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Unable to revoke this share.",
      });
    } finally {
      setRevokingId(null);
    }
  }

  const activeShares = shares.filter(
    (share) => share.status === "ACTIVE"
  ).length;

  const totalDownloads = shares.reduce(
    (total, share) => total + Number(share.downloadCount || 0),
    0
  );

  return (
    <main className="secure-sharing-page">
      <header className="sharing-heading">
        <div>
          <span className="sharing-eyebrow">
            CONTROLLED FILE ACCESS
          </span>
          <h1>Secure Sharing</h1>
          <p>
            Share encrypted vault files with recipient verification,
            access restrictions and activity monitoring.
          </p>
        </div>

        <div className="sharing-heading-icon" aria-hidden="true">
          🔒
        </div>
      </header>

      {notice && (
        <div
          className={`sharing-notice ${notice.type}`}
          role="status"
          aria-live="polite"
        >
          <span>{notice.type === "success" ? "✓" : "!"}</span>
          {notice.text}

          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      <section className="sharing-stats">
        <article className="sharing-stat">
          <span>SHARES CREATED</span>
          <strong>{shares.length}</strong>
          <small>Total sharing records</small>
        </article>

        <article className="sharing-stat">
          <span>ACTIVE SHARES</span>
          <strong>{activeShares}</strong>
          <small>Currently available links</small>
        </article>

        <article className="sharing-stat">
          <span>DOWNLOADS</span>
          <strong>{totalDownloads}</strong>
          <small>Total recorded downloads</small>
        </article>
      </section>

      <section className="sharing-layout">
        <article className="sharing-panel create-share-panel">
          <div className="sharing-panel-heading">
            <div>
              <span className="sharing-eyebrow">NEW SHARE</span>
              <h2>Send a secure invitation</h2>
            </div>

            <span className="sharing-panel-symbol">＋</span>
          </div>

          <form onSubmit={handleCreateShare}>
            <label className="sharing-field">
              <span>Select vault file</span>

              <select
                value={selectedFile}
                onChange={(event) =>
                  setSelectedFile(event.target.value)
                }
                required
              >
                <option value="">Choose a file</option>

                {files.map((file) => (
                  <option key={file.fileId} value={file.fileId}>
                    {file.originalName} — {formatBytes(file.fileSize)}
                  </option>
                ))}
              </select>
            </label>

            <label className="sharing-field">
              <span>Recipient email address</span>

              <input
                type="email"
                value={recipientEmail}
                onChange={(event) =>
                  setRecipientEmail(event.target.value)
                }
                placeholder="recipient@example.com"
                maxLength={255}
                required
              />

              <small>
                The invitation will be sent to this email address.
                Only this address will be allowed to verify access.
              </small>
            </label>

            <div className="sharing-field">
              <span>Access permission</span>

              <div className="permission-options">
                <label
                  className={`permission-option ${
                    permissionType === "VIEW" ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="permission"
                    value="VIEW"
                    checked={permissionType === "VIEW"}
                    onChange={() => setPermissionType("VIEW")}
                  />

                  <span className="permission-icon">◉</span>

                  <span>
                    <strong>View only</strong>
                    <small>
                      Preview allowed, download disabled
                    </small>
                  </span>
                </label>

                <label
                  className={`permission-option ${
                    permissionType === "DOWNLOAD" ? "selected" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="permission"
                    value="DOWNLOAD"
                    checked={permissionType === "DOWNLOAD"}
                    onChange={() => setPermissionType("DOWNLOAD")}
                  />

                  <span className="permission-icon">⇩</span>

                  <span>
                    <strong>View & download</strong>
                    <small>
                      Recipient can preview and download
                    </small>
                  </span>
                </label>
              </div>
            </div>

            <div className="sharing-field">
              <span>Additional protections</span>

              <label className="sharing-toggle">
                <span>
                  <strong>Dynamic watermark</strong>

                  <small>
                    {permissionType === "DOWNLOAD"
                      ? "Apply recipient-specific watermark to downloaded files"
                      : "Display recipient details on the file preview"}
                  </small>
                </span>

                <input
                  type="checkbox"
                  checked={watermarkEnabled}
                  onChange={(event) =>
                    setWatermarkEnabled(event.target.checked)
                  }
                />
              </label>

              <label className="sharing-field nested-field">
                <span>Link expiry date and time</span>

                <input
                  type="datetime-local"
                  value={expiresAt}
                  min={new Date(
                    Date.now() -
                      new Date().getTimezoneOffset() * 60000
                  )
                    .toISOString()
                    .slice(0, 16)}
                  onChange={(event) =>
                    setExpiresAt(event.target.value)
                  }
                />

                <small>
                  Leave empty if the share should not expire automatically.
                </small>
              </label>

              <label className="sharing-field nested-field">
                <span>Maximum number of opens</span>

                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={maxOpens}
                  onChange={(event) =>
                    setMaxOpens(event.target.value)
                  }
                  placeholder="Unlimited"
                />

                <small>
                  Counts successful recipient openings, separately from downloads.
                </small>
              </label>

              {permissionType === "DOWNLOAD" && (
                <label className="sharing-field nested-field">
                  <span>Maximum number of downloads</span>

                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={maxDownloads}
                    onChange={(event) =>
                      setMaxDownloads(event.target.value)
                    }
                    placeholder="Unlimited"
                  />
                </label>
              )}
            </div>

            <div className="sharing-security-note">
              <span>ⓘ</span>

              <p>
                Email OTP verification is required before the recipient
                can access the shared file. The invitation email will
                contain the secure access link.
              </p>
            </div>

            <button
              className="sharing-primary-button"
              type="submit"
              disabled={creating || loading}
            >
              {creating ? "Sending invitation…" : "Send"}

              <span>{creating ? "…" : "→"}</span>
            </button>
          </form>
        </article>

        <aside className="sharing-panel protection-panel">
          <span className="sharing-eyebrow">
            SECURITY OVERVIEW
          </span>

          <h2>Access stays under your control.</h2>

          <p>
            Each share has its own permission settings and recipient
            verification.
          </p>

          <div className="protection-list">
            <div>
              <span>✓</span>
              <section>
                <strong>Recipient email verification</strong>
                <small>One-time password sent to the recipient</small>
              </section>
            </div>

            <div>
              <span>✓</span>
              <section>
                <strong>Expiry controls</strong>
                <small>Automatically disable access after expiry</small>
              </section>
            </div>

            <div>
              <span>✓</span>
              <section>
                <strong>Open and download limits</strong>
                <small>Separate limits for openings and downloads</small>
              </section>
            </div>

            <div>
              <span>✓</span>
              <section>
                <strong>Instant revocation</strong>
                <small>Disable an active share when needed</small>
              </section>
            </div>

            <div>
              <span>✓</span>
              <section>
                <strong>Activity monitoring</strong>
                <small>
                  Review recipient access and download events
                </small>
              </section>
            </div>
          </div>

          <div className="protection-warning">
            <strong>About screenshot protection</strong>

            <p>
              View-only mode can discourage ordinary downloading and
              screen capture, but no browser can guarantee prevention of
              screenshots, screen recording or external-camera capture.
            </p>
          </div>
        </aside>
      </section>

      <section className="sharing-panel shares-table-panel">
        <div className="sharing-panel-heading sharing-table-heading">
          <div>
            <span className="sharing-eyebrow">
              SHARE MANAGEMENT
            </span>

            <h2>Your shared files</h2>
          </div>

          <div className="sharing-table-controls">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="ALL">All shares</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRED">Expired</option>
              <option value="REVOKED">Revoked</option>
              <option value="LIMIT_REACHED">Limit reached</option>
            </select>

            <button
              type="button"
              className="sharing-refresh-button"
              onClick={loadData}
              disabled={loading}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="sharing-empty">
            Loading your shares…
          </div>
        ) : shares.length === 0 ? (
          <div className="sharing-empty">
            <span>🔒</span>
            <strong>No shares found</strong>

            <p>
              Send a secure invitation to share one of your vault files.
            </p>
          </div>
        ) : (
          <div className="sharing-table-scroll">
            <table className="sharing-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Recipient</th>
                  <th>Permission</th>
                  <th>Expiry</th>
                  <th>Downloads</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {shares.map((share) => (
                  <tr key={share.shareId}>
                    <td>
                      <strong>
                        {share.fileName || `File #${share.fileId}`}
                      </strong>

                      <small>{formatBytes(share.fileSize)}</small>
                    </td>

                    <td>
                      {share.recipientEmail || "Not specified"}
                    </td>

                    <td>
                      {share.permissionType === "VIEW"
                        ? "View only"
                        : "Download"}
                    </td>

                    <td>{formatDate(share.expiresAt)}</td>

                    <td>
                      {share.downloadCount || 0}
                      {share.maxDownloads
                        ? ` / ${share.maxDownloads}`
                        : ""}
                    </td>

                    <td>
                      <span
                        className={`sharing-status ${
                          (share.status || "ACTIVE").toLowerCase()
                        }`}
                      >
                        {(share.status || "ACTIVE").replaceAll(
                          "_",
                          " "
                        )}
                      </span>
                    </td>

                    <td>
                      {share.status !== "REVOKED" && (
                        <button
                          type="button"
                          className="sharing-revoke-button"
                          disabled={revokingId === share.shareId}
                          onClick={() => handleRevoke(share.shareId)}
                        >
                          {revokingId === share.shareId
                            ? "Revoking…"
                            : "Revoke"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
