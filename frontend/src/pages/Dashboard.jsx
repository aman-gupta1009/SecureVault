
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:4000/api";

const css = `
.sv-overview {
  width: 100%;
  min-width: 0;
  color: var(--sv-text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.sv-overview * { box-sizing: border-box; }

.sv-overview .ov-eyebrow {
  color: var(--sv-accent);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.7px;
  text-transform: uppercase;
}
.sv-overview .ov-heading {
  margin: 8px 0;
  font-size: clamp(25px, 3vw, 33px);
  line-height: 1.2;
  font-weight: 780;
  letter-spacing: -1px;
}
.sv-overview .ov-muted {
  color: var(--sv-text-muted);
  font-size: 12px;
  line-height: 1.7;
}
.sv-overview .ov-card {
  min-width: 0;
  border: 1px solid var(--sv-border);
  border-radius: 16px;
  background: var(--sv-surface);
  box-shadow: var(--sv-shadow);
}
.sv-overview .ov-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 23px;
}
.sv-overview .ov-stat {
  padding: 18px;
  transition: border-color 160ms ease, transform 160ms ease;
}
.sv-overview .ov-stat-button {
  display: block;
  width: 100%;
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.sv-overview .ov-stat-button:hover {
  border-color: var(--sv-accent);
  transform: translateY(-2px);
}
.sv-overview .ov-stat-button:focus-visible {
  outline: 2px solid var(--sv-accent);
  outline-offset: 3px;
}
.sv-overview .ov-stat-button .ov-stat-note::after {
  content: " · Open";
  color: var(--sv-accent);
  font-weight: 700;
}
.sv-overview .ov-stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.sv-overview .ov-stat-icon,
.sv-overview .ov-security-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--sv-border);
  border-radius: 12px;
  background: var(--sv-surface-raised);
  color: var(--sv-accent);
  font-size: 19px;
}
.sv-overview .ov-stat-label {
  margin: 17px 0 7px;
  color: var(--sv-text-muted);
  font-size: 12px;
}
.sv-overview .ov-stat-value {
  font-size: clamp(21px, 2vw, 28px);
  font-weight: 780;
  letter-spacing: -.7px;
  overflow-wrap: anywhere;
}
.sv-overview .ov-stat-note {
  margin: 8px 0 0;
  color: var(--sv-text-muted);
  font-size: 10px;
  line-height: 1.6;
}
.sv-overview .ov-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 99px;
  background: var(--sv-success-bg);
  color: var(--sv-success-text);
  font-size: 9px;
  font-weight: 800;
}
.sv-overview .ov-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.sv-overview .ov-section-heading h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 750;
}
.sv-overview .ov-button,
.sv-overview .ov-text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--sv-border);
  border-radius: 10px;
  background: var(--sv-surface-raised);
  color: var(--sv-text);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.sv-overview .ov-button:hover,
.sv-overview .ov-text-button:hover {
  border-color: var(--sv-accent);
}
.sv-overview .ov-text-button {
  min-height: 30px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--sv-accent);
}
.sv-overview .ov-content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(260px, 1fr);
  gap: 16px;
  margin-top: 18px;
}
  /* Quick Actions - Full Width */
.sv-overview .ov-content-grid > section:nth-child(3) {
  grid-column: 1 / -1;
  width: 100%;
}
.sv-overview .ov-panel { padding: 19px; }
.sv-overview .ov-search {
  width: 100%;
  min-height: 41px;
  padding: 0 12px;
  margin-bottom: 13px;
  border: 1px solid var(--sv-border);
  border-radius: 10px;
  background: var(--sv-input-bg);
  color: var(--sv-text);
  outline: none;
  font: inherit;
  font-size: 11px;
}
.sv-overview .ov-search:focus { border-color: var(--sv-accent); }
.sv-overview .ov-table-wrap { overflow-x: auto; }
.sv-overview .ov-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  white-space: nowrap;
}
.sv-overview .ov-table th {
  padding: 12px 9px;
  border-bottom: 1px solid var(--sv-border);
  background: var(--sv-surface-raised);
  color: var(--sv-text-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .8px;
  text-transform: uppercase;
}
.sv-overview .ov-table td {
  padding: 13px 9px;
  border-bottom: 1px solid var(--sv-border);
  font-size: 11px;
}
.sv-overview .ov-table tbody tr:last-child td { border-bottom: 0; }
.sv-overview .ov-file-name {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.sv-overview .ov-file-icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 36px;
  flex-shrink: 0;
  border: 1px solid var(--sv-border);
  border-radius: 9px;
  background: var(--sv-surface-raised);
  color: var(--sv-accent);
  font-size: 9px;
  font-weight: 800;
}
.sv-overview .ov-file-label {
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 650;
}
.sv-overview .ov-security-banner,
.sv-overview .ov-note {
  padding: 17px;
  border: 1px solid var(--sv-border);
  border-radius: 13px;
  background: var(--sv-surface-raised);
}
.sv-overview .ov-security-icon { margin-bottom: 13px; }
.sv-overview .ov-activity {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 14px 0;
  border-bottom: 1px solid var(--sv-border);
}
.sv-overview .ov-activity:last-child { border-bottom: 0; }
.sv-overview .ov-activity-icon,
.sv-overview .ov-action-icon {
  display: grid;
  place-items: center;
  width: 35px;
  height: 35px;
  flex-shrink: 0;
  border: 1px solid var(--sv-border);
  border-radius: 10px;
  background: var(--sv-surface-raised);
  color: var(--sv-accent);
}
.sv-overview .ov-activity-body { flex: 1; min-width: 0; }
.sv-overview .ov-activity-body strong {
  display: block;
  margin: 1px 0 5px;
  font-size: 11px;
  font-weight: 750;
}
.sv-overview .ov-activity-body p {
  margin: 0;
  color: var(--sv-text-muted);
  font-size: 10px;
  line-height: 1.6;
}
.sv-overview .ov-actions { display: grid; gap: 9px; }
.sv-overview .ov-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 49px;
  padding: 0 13px;
  border: 1px solid var(--sv-border);
  border-radius: 11px;
  background: var(--sv-surface-raised);
  color: var(--sv-text);
  text-align: left;
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.sv-overview .ov-action:hover { border-color: var(--sv-accent); }
.sv-overview .ov-action-label {
  display: flex;
  align-items: center;
  gap: 10px;
}
.sv-overview .ov-action-icon {
  width: 30px;
  height: 30px;
}
.sv-overview .ov-note {
  margin-top: 17px;
  color: var(--sv-text-muted);
  font-size: 10px;
  line-height: 1.7;
}
.sv-overview .ov-empty {
  padding: 25px 12px;
  text-align: center;
  color: var(--sv-text-muted);
  font-size: 11px;
  line-height: 1.7;
}
.sv-overview .ov-error { color: #f59e9e; }
@media (max-width: 1050px) {
  .sv-overview .ov-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sv-overview .ov-content-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 560px) {
  .sv-overview .ov-stats { grid-template-columns: minmax(0, 1fr); }
  .sv-overview .ov-stat { padding: 15px; }
  .sv-overview .ov-panel { padding: 14px; }
  .sv-overview .ov-file-label { max-width: 125px; }
}
`;

function formatBytes(bytes) {
    const value = Number(bytes);

    if (!Number.isFinite(value) || value <= 0) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
        Math.floor(Math.log(value) / Math.log(1024)),
        units.length - 1
    );

    const formatted = value / Math.pow(1024, index);

    return `${formatted.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function getFileType(fileName = "") {
    const extension = String(fileName).split(".").pop();

    return extension && extension !== fileName
        ? extension.toUpperCase().slice(0, 5)
        : "FILE";
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

export default function Dashboard({
    user,
    onLogout,
    onNavigate,
    vaultStatus: initialVaultStatus
}) {
    const [search, setSearch] = useState("");
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState("");
    const [liveVaultStatus, setLiveVaultStatus] = useState(
        initialVaultStatus && initialVaultStatus !== "Unknown"
            ? initialVaultStatus
            : "Loading..."
    );
    const [files, setFiles] = useState([]);
    const [filesLoading, setFilesLoading] = useState(true);
    const [filesLocked, setFilesLocked] = useState(false);
    const [filesError, setFilesError] = useState("");

    const displayName =
        user?.name || user?.email?.split("@")[0] || "Vault User";

    const loadDashboardData = useCallback(async () => {
        // Fetch the actual lock state from the backend.
        try {
            const statusResponse = await fetch(
                `${API_BASE}/vault/status`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: { Accept: "application/json" }
                }
            );

            const statusPayload = await statusResponse.json();
            const isLocked = statusPayload.data?.isLocked ?? statusPayload.isLocked;

            if (!statusResponse.ok || !statusPayload.success || typeof isLocked !== "boolean") {
                throw new Error(
                    statusPayload.message || "Vault status unavailable."
                );
            }

            setLiveVaultStatus(isLocked ? "Locked" : "Unlocked");
        } catch (error) {
            setLiveVaultStatus("Unavailable");
        }

        // Statistics do not require the vault to be unlocked.
        try {
            const statsResponse = await fetch(
                `${API_BASE}/vault/files/count`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: { Accept: "application/json" }
                }
            );

            const statsPayload = await statsResponse.json();

            if (!statsResponse.ok || !statsPayload.success) {
                throw new Error(
                    statsPayload.message || "Unable to load vault statistics."
                );
            }

            setStats({
                total: Number(statsPayload.data?.total ?? 0),
                totalStorageBytes: Number(
                    statsPayload.data?.totalStorageBytes ?? 0
                )
            });

            setStatsError("");
        } catch (error) {
            setStatsError(error.message || "Statistics unavailable.");
        } finally {
            setStatsLoading(false);
        }

        // Recent files require an unlocked vault.
        try {
            const filesResponse = await fetch(
                `${API_BASE}/vault/files?page=1&limit=5&sortBy=date&sortOrder=desc`,
                {
                    method: "GET",
                    credentials: "include",
                    headers: { Accept: "application/json" }
                }
            );

            const filesPayload = await filesResponse.json();

            if (filesResponse.status === 423) {
                setLiveVaultStatus("Locked");
                setFiles([]);
                setFilesLocked(true);
                setFilesError("");
                return;
            }

            if (!filesResponse.ok || !filesPayload.success) {
                throw new Error(
                    filesPayload.message || "Unable to load recent files."
                );
            }

            setFiles(
                Array.isArray(filesPayload.data?.files)
                    ? filesPayload.data.files
                    : []
            );

            setLiveVaultStatus("Unlocked");
            setFilesLocked(false);
            setFilesError("");
        } catch (error) {
            setFilesError(error.message || "Recent files unavailable.");
        } finally {
            setFilesLoading(false);
        }
    }, []);

    useEffect(() => {
        loadDashboardData();

        const interval = window.setInterval(
            loadDashboardData,
            20000
        );

        const handleFocus = () => loadDashboardData();

        window.addEventListener("focus", handleFocus);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener("focus", handleFocus);
        };
    }, [loadDashboardData]);

    const visibleFiles = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) return files;

        return files.filter((file) =>
            String(file.originalName || "")
                .toLowerCase()
                .includes(query)
        );
    }, [files, search]);

    function navigate(page) {
        onNavigate?.(page);
    }

    return (
        <section className="sv-overview">
            <style>{css}</style>

            <header>
                <div className="ov-eyebrow">Secure workspace</div>
                <h1 className="ov-heading">
                    Welcome back, {displayName}
                </h1>
                <p className="ov-muted">
                    Your private workspace for files, backups and account security.
                </p>
            </header>

            <section className="ov-stats" aria-label="Workspace overview">
                <article className="ov-card ov-stat">
                    <div className="ov-stat-top">
                        <span className="ov-stat-icon">▤</span>
                        <span className="ov-pill">Live data</span>
                    </div>
                    <p className="ov-stat-label">Files in vault</p>
                    <div className="ov-stat-value">
                        {statsLoading
                            ? "..."
                            : statsError
                                ? "Unavailable"
                                : (stats?.total ?? 0).toLocaleString()}
                    </div>
                    <p className="ov-stat-note">
                        Actual files stored in your vault
                    </p>
                </article>

                <article className="ov-card ov-stat">
                    <div className="ov-stat-top">
                        <span className="ov-stat-icon">▣</span>
                        <span className="ov-pill">Live data</span>
                    </div>
                    <p className="ov-stat-label">Storage used</p>
                    <div className="ov-stat-value">
                        {statsLoading
                            ? "..."
                            : statsError
                                ? "Unavailable"
                                : formatBytes(stats?.totalStorageBytes ?? 0)}
                    </div>
                    <p className="ov-stat-note">
                        Total size of your stored files
                    </p>
                </article>

                <button
                    type="button"
                    className="ov-card ov-stat ov-stat-button"
                    onClick={() => navigate("Devices & Sessions")}
                    aria-label="Open Devices and Sessions security controls"
                >
                    <div className="ov-stat-top">
                        <span className="ov-stat-icon">⛨</span>
                        <span className="ov-pill">Account</span>
                    </div>
                    <p className="ov-stat-label">Security controls</p>
                    <div className="ov-stat-value" style={{ fontSize: 22 }}>
                        Account
                    </div>
                    <p className="ov-stat-note">
                        Review your security settings
                    </p>
                </button>

                <button
                    type="button"
                    className="ov-card ov-stat ov-stat-button"
                    onClick={() => navigate("Files")}
                    aria-label={`Vault is ${liveVaultStatus}. Open My Files to manage vault lock`}
                >
                    <div className="ov-stat-top">
                        <span className="ov-stat-icon">◷</span>
                        <span className="ov-pill">Vault</span>
                    </div>
                    <p className="ov-stat-label">Vault status</p>
                    <div className="ov-stat-value" style={{ fontSize: 22 }}>
                        {liveVaultStatus}
                    </div>
                    <p className="ov-stat-note">
                        Current lock state · Open My Files to manage
                    </p>
                </button>
            </section>

            <div className="ov-content-grid">
                <section className="ov-card ov-panel">
                    <div className="ov-section-heading">
                        <div>
                            <h2>Recent files</h2>
                            <p className="ov-muted" style={{ margin: "5px 0 0" }}>
                                Your latest stored files
                            </p>
                        </div>

                        <button
                            type="button"
                            className="ov-text-button"
                            onClick={() => navigate("Files")}
                        >
                            View files →
                        </button>
                    </div>

                    <input
                        type="search"
                        className="ov-search"
                        aria-label="Search vault files"
                        placeholder="Search your vault files..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />

                    <div className="ov-table-wrap">
                        <table className="ov-table">
                            <thead>
                                <tr>
                                    <th>File</th>
                                    <th>Type</th>
                                    <th>Size</th>
                                    <th>Added</th>
                                </tr>
                            </thead>

                            <tbody>
                                {visibleFiles.map((file) => (
                                    <tr key={file.fileId}>
                                        <td>
                                            <div className="ov-file-name">
                                                <span className="ov-file-icon">
                                                    {getFileType(file.originalName)}
                                                </span>
                                                <span
                                                    className="ov-file-label"
                                                    title={file.originalName}
                                                >
                                                    {file.originalName}
                                                </span>
                                            </div>
                                        </td>
                                        <td>{getFileType(file.originalName)}</td>
                                        <td>{formatBytes(file.fileSize)}</td>
                                        <td>{formatDate(file.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filesLoading && (
                            <div className="ov-empty">
                                Loading your vault files...
                            </div>
                        )}

                        {!filesLoading && filesLocked && (
                            <div className="ov-empty">
                                <strong>Vault is locked</strong>
                                <br />
                                Unlock your vault to view recent files.
                            </div>
                        )}

                        {!filesLoading && !filesLocked && filesError && (
                            <div className="ov-empty ov-error">
                                {filesError}
                            </div>
                        )}

                        {!filesLoading &&
                            !filesLocked &&
                            !filesError &&
                            visibleFiles.length === 0 && (
                                <div className="ov-empty">
                                    {search
                                        ? "No matching files found."
                                        : "Your vault is empty. Files you securely hide will appear here."}
                                </div>
                            )}
                    </div>

                    <p className="ov-muted" style={{ fontSize: 10, marginBottom: 0 }}>
                        Showing up to 5 recent files from your vault.
                    </p>
                </section>



                <section className="ov-card ov-panel">
                    <div className="ov-section-heading">
                        <h2>Workspace information</h2>
                    </div>

                    <div className="ov-activity">
                        <span className="ov-activity-icon">▤</span>
                        <div className="ov-activity-body">
                            <strong>Total files</strong>
                            <p>
                                {statsLoading
                                    ? "Loading..."
                                    : statsError
                                        ? "Unavailable"
                                        : `${stats?.total ?? 0} files stored`}
                            </p>
                        </div>
                    </div>

                    <div className="ov-activity">
                        <span className="ov-activity-icon">▣</span>
                        <div className="ov-activity-body">
                            <strong>Storage consumption</strong>
                            <p>
                                {statsLoading
                                    ? "Loading..."
                                    : statsError
                                        ? "Unavailable"
                                        : formatBytes(stats?.totalStorageBytes ?? 0)}
                            </p>
                        </div>
                    </div>

                    <div className="ov-activity">
                        <span className="ov-activity-icon">◷</span>
                        <div className="ov-activity-body">
                            <strong>Data source</strong>
                            <p>Live database records</p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="ov-button"
                        style={{ width: "100%", marginTop: 14 }}
                        onClick={loadDashboardData}
                    >
                        ↻ Refresh dashboard
                    </button>
                </section>

                <section className="ov-card ov-panel">
                    <div className="ov-section-heading">
                        <h2>Quick actions</h2>
                    </div>

                    <div className="ov-actions">
                        <button
                            type="button"
                            className="ov-action"
                            onClick={() => navigate("Files")}
                        >
                            <span className="ov-action-label">
                                <span className="ov-action-icon">▤</span>
                                Open file manager
                            </span>
                            <span>→</span>
                        </button>

                        <button
                            type="button"
                            className="ov-action"
                            onClick={() => navigate("Backups")}
                        >
                            <span className="ov-action-label">
                                <span className="ov-action-icon">◈</span>
                                Open backup center
                            </span>
                            <span>→</span>
                        </button>

                        <button
                            type="button"
                            className="ov-action"
                            onClick={() => navigate("Security")}
                        >
                            <span className="ov-action-label">
                                <span className="ov-action-icon">⛨</span>
                                Review security
                            </span>
                            <span>→</span>
                        </button>

                        {onLogout && (
                            <button
                                type="button"
                                className="ov-action"
                                onClick={onLogout}
                            >
                                <span className="ov-action-label">
                                    <span className="ov-action-icon">⇥</span>
                                    Sign out
                                </span>
                                <span>→</span>
                            </button>
                        )}
                    </div>

                    <div className="ov-note">
                        Keep your password and vault encryption keys private.
                        Never share recovery codes or secret keys with anyone.
                    </div>
                </section>
            </div>
        </section>
    );
}
