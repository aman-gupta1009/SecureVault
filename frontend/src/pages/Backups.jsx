import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api"
).replace(/\/+$/, "");

const styles = `
.sv-page {
  width: 100%;
  min-width: 0;
  padding: 20px 22px 28px;
  color: var(--sv-text);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin: 24px 0;
}
.sv-page .sv-stat { padding: 19px; }
.sv-page .sv-stat-label {
  color: var(--sv-text-muted);
  font-size: 12px;
}
.sv-page .sv-stat-value {
  margin-top: 12px;
  font-size: 27px;
  font-weight: 750;
  letter-spacing: -.7px;
}
.sv-page .sv-stat-foot {
  margin-top: 8px;
  color: var(--sv-text-muted);
  font-size: 11px;
}
.sv-page .sv-button {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 13px;
  border: 1px solid var(--sv-border);
  border-radius: 9px;
  background: var(--sv-surface-raised);
  color: var(--sv-text);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: 160ms ease;
}
.sv-page .sv-button:hover:not(:disabled) {
  border-color: var(--sv-accent);
}
.sv-page .sv-button-primary {
  background: var(--sv-accent);
  border-color: var(--sv-accent);
  color: var(--sv-accent-text);
}
.sv-page .sv-button-danger:hover:not(:disabled) {
  border-color: #dc6262;
  color: #dc6262;
}
.sv-page .sv-button:disabled {
  opacity: .45;
  cursor: not-allowed;
}
.sv-page .sv-badge {
  display: inline-flex;
  align-items: center;
  padding: 6px 9px;
  border-radius: 99px;
  background: var(--sv-success-bg);
  color: var(--sv-success-text);
  font-size: 10px;
  font-weight: 800;
}
.sv-page .sv-table-wrap { overflow-x: auto; }
.sv-page .sv-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  white-space: nowrap;
}
.sv-page .sv-table th {
  padding: 13px 14px;
  color: var(--sv-text-muted);
  background: var(--sv-surface-raised);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .8px;
  text-transform: uppercase;
}
.sv-page .sv-table td {
  padding: 15px 14px;
  border-top: 1px solid var(--sv-border);
  font-size: 12px;
}
.sv-page .sv-notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--sv-border);
  border-radius: 13px;
  background: var(--sv-surface-raised);
}
.sv-page .sv-message {
  margin: 16px 0;
  padding: 12px 14px;
  border: 1px solid var(--sv-border);
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
}
.sv-page .sv-message-error { color: #e58a8a; }
.sv-page .sv-message-success { color: var(--sv-success-text); }
.sv-page .sv-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sv-page .sv-search {
  min-height: 40px;
  width: min(100%, 280px);
  padding: 0 12px;
  border: 1px solid var(--sv-border);
  border-radius: 9px;
  background: var(--sv-input-bg);
  color: var(--sv-text);
  outline: none;
  font-size: 12px;
}
.sv-page .sv-search:focus { border-color: var(--sv-accent); }

/* SecureVault native-style confirmation replacement */
.sv-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(3, 8, 7, .72);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(7px);
  animation: sv-confirm-fade-in 140ms ease-out;
}
.sv-confirm-dialog {
  width: min(100%, 440px);
  overflow: hidden;
  border: 1px solid var(--sv-border);
  border-radius: 18px;
  background: var(--sv-surface);
  color: var(--sv-text);
  box-shadow: 0 24px 80px rgba(0, 0, 0, .48);
  animation: sv-confirm-rise-in 160ms ease-out;
}
.sv-confirm-top {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 21px 14px;
}
.sv-confirm-icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--sv-border);
  border-radius: 12px;
  background: var(--sv-surface-raised);
  color: var(--sv-accent);
  font-size: 19px;
  font-weight: 800;
}
.sv-confirm-icon-danger {
  color: #e58a8a;
  background: rgba(190, 65, 65, .10);
  border-color: rgba(220, 98, 98, .25);
}
.sv-confirm-kicker {
  margin: 0 0 4px;
  color: var(--sv-accent);
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.sv-confirm-title {
  margin: 0;
  font-size: 16px;
  font-weight: 760;
  letter-spacing: -.25px;
}
.sv-confirm-description {
  margin: 0;
  padding: 0 21px 20px 73px;
  color: var(--sv-text-muted);
  font-size: 12px;
  line-height: 1.75;
  white-space: pre-line;
}
.sv-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  padding: 14px 20px;
  border-top: 1px solid var(--sv-border);
  background: var(--sv-surface-raised);
}
.sv-confirm-actions .sv-button { min-width: 94px; }
.sv-confirm-danger {
  background: #b94c4c;
  border-color: #b94c4c;
  color: #fff;
}
.sv-confirm-danger:hover:not(:disabled) {
  background: #a83e3e;
  border-color: #a83e3e;
}
@keyframes sv-confirm-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes sv-confirm-rise-in {
  from { opacity: 0; transform: translateY(8px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (max-width: 900px) {
  .sv-page .sv-actions { flex-wrap: wrap; }
}
@media (max-width: 650px) {
  .sv-page { padding: 16px 14px 22px; }
  .sv-page .sv-grid { grid-template-columns: 1fr; }
  .sv-page .sv-stat { padding: 15px; }
  .sv-confirm-description { padding-left: 21px; }
}
`;

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes) {
  const size = Number(bytes || 0);

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getBackupId(backup) {
  return backup.backup_id;
}

function getStatusLabel(status) {
  const value = String(status || "UNKNOWN").toUpperCase();

  if (value === "COMPLETED") return "Completed";
  if (value === "DELETED") return "Deleted";

  return value.replaceAll("_", " ");
}

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("Server returned an invalid response.");
  }

  if (!response.ok || result?.success === false) {
    throw new Error(
      result?.message || `Request failed with status ${response.status}.`
    );
  }

  return result;
}

export default function Backups() {
  const [backups, setBackups] = useState([]);
  const [search, setSearch] = useState("");
  const [integrityFilter, setIntegrityFilter] = useState("All");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [busyAction, setBusyAction] = useState("");

  const [verifiedIds, setVerifiedIds] = useState(() => new Set());
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const showMessage = (text, type = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const loadBackups = useCallback(async () => {
    setLoading(true);

    try {
      const result = await apiRequest("/backups");
      const records = Array.isArray(result.data) ? result.data : [];

      setBackups(records);
      setMessage("");
      setMessageType("");
      return records;
    } catch (error) {
      setBackups([]);
      showMessage(error.message || "Unable to load backups.", "error");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const createBackup = async () => {
    if (creating) return;

    setCreating(true);
    showMessage("Creating and verifying backup...", "success");

    try {
      const result = await apiRequest("/backups", {
        method: "POST",
      });

      const created = result.data || {};
      const refreshedRecords = await loadBackups();

      const matchingBackup = refreshedRecords.find(
        (item) => item.backup_name === created.backupName
      );

      if (matchingBackup?.backup_id) {
        setVerifiedIds((previous) => {
          const next = new Set(previous);
          next.add(matchingBackup.backup_id);
          return next;
        });
      }

      showMessage(
        `Backup created successfully. ${created.fileCount ?? 0} file(s), ${formatSize(created.totalSize)}. Integrity: ${created.integrity || "Verified"}.`,
        "success"
      );
    } catch (error) {
      showMessage(error.message || "Backup creation failed.", "error");
    } finally {
      setCreating(false);
    }
  };

  const verifyBackup = async (backupId) => {
    setBusyId(backupId);
    setBusyAction("verify");

    try {
      const result = await apiRequest(`/backups/${backupId}/verify`);
      const integrity = result.data?.integrity || "VERIFIED";

      if (integrity === "VERIFIED") {
        setVerifiedIds((previous) => {
          const next = new Set(previous);
          next.add(backupId);
          return next;
        });
      }

      showMessage(
        `Backup #${backupId}: integrity ${integrity}.`,
        integrity === "VERIFIED" ? "success" : "error"
      );
    } catch (error) {
      showMessage(error.message || "Backup verification failed.", "error");
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  };

  const performRestoreBackup = async (backupId) => {
    setBusyId(backupId);
    setBusyAction("restore");

    try {
      const result = await apiRequest(`/backups/${backupId}/restore`, {
        method: "POST",
      });

      const data = result.data || {};

      showMessage(
        `Restore completed. Restored: ${data.restoredCount ?? 0}, skipped: ${data.skippedCount ?? 0}.`,
        "success"
      );
    } catch (error) {
      showMessage(error.message || "Backup restore failed.", "error");
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  };

  const requestRestoreBackup = (backupId) => {
    setConfirmation({
      tone: "normal",
      icon: "↻",
      kicker: "Vault recovery",
      title: `Restore backup #${backupId}?`,
      description:
        "This operation restores missing files and metadata into your SecureVault. It does not download files to a Windows folder.",
      confirmLabel: "Restore Backup",
      onConfirm: () => performRestoreBackup(backupId),
    });
  };

  const performDeleteBackup = async (backupId) => {
    setBusyId(backupId);
    setBusyAction("delete");

    try {
      const result = await apiRequest(`/backups/${backupId}`, {
        method: "DELETE",
      });

      setVerifiedIds((previous) => {
        const next = new Set(previous);
        next.delete(backupId);
        return next;
      });

      await loadBackups();

      showMessage(
        result.message || `Backup #${backupId} deleted.`,
        "success"
      );
    } catch (error) {
      showMessage(error.message || "Backup deletion failed.", "error");
      await loadBackups();
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  };

  const requestDeleteBackup = (backupId) => {
    setConfirmation({
      tone: "danger",
      icon: "!",
      kicker: "Permanent action",
      title: `Delete backup #${backupId}?`,
      description:
        "This backup will be permanently deleted from SecureVault. This action cannot be undone.",
      confirmLabel: "Delete Backup",
      onConfirm: () => performDeleteBackup(backupId),
    });
  };

  const cancelConfirmation = () => setConfirmation(null);

  const confirmPendingAction = async () => {
    if (!confirmation?.onConfirm) return;

    const action = confirmation.onConfirm;
    setConfirmation(null);
    await action();
  };

  const filteredBackups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return backups.filter((backup) => {
      const id = String(backup.backup_id ?? "");
      const name = String(backup.backup_name ?? "");

      const matchesSearch =
        !query ||
        name.toLowerCase().includes(query) ||
        id.toLowerCase().includes(query);

      const integrity = verifiedIds.has(backup.backup_id)
        ? "Verified"
        : "Not checked";

      const matchesIntegrity =
        integrityFilter === "All" || integrity === integrityFilter;

      return matchesSearch && matchesIntegrity;
    });
  }, [backups, search, integrityFilter, verifiedIds]);

  const completedCount = backups.filter(
    (backup) => String(backup.status).toUpperCase() === "COMPLETED"
  ).length;

  const totalFiles = backups
    .filter((backup) => String(backup.status).toUpperCase() === "COMPLETED")
    .reduce((sum, backup) => sum + Number(backup.file_count || 0), 0);

  const verifiedCount = backups.filter((backup) =>
    verifiedIds.has(backup.backup_id)
  ).length;

  return (
    <section className="sv-page">
      <style>{styles}</style>

      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 15,
        }}
      >
        <div>
          <div className="sv-eyebrow">Resilience & recovery</div>
          <h1 className="sv-heading">Backup Center</h1>
          <p className="sv-muted">
            Create, verify, restore and manage your SecureVault backups.
          </p>
        </div>

        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button
            type="button"
            className="sv-button"
            onClick={loadBackups}
            disabled={loading || creating}
          >
            {loading ? "Loading..." : "↻ Refresh"}
          </button>

          <button
            type="button"
            className="sv-button sv-button-primary"
            onClick={createBackup}
            disabled={creating || loading}
          >
            {creating ? "Creating backup..." : "+ Create Backup"}
          </button>
        </div>
      </header>

      {message && (
        <div
          className={`sv-message ${
            messageType === "error"
              ? "sv-message-error"
              : "sv-message-success"
          }`}
          role="status"
        >
          {message}
        </div>
      )}

      <div className="sv-grid">
        <div className="sv-card sv-stat">
          <div className="sv-stat-label">Total backup records</div>
          <div className="sv-stat-value">{loading ? "—" : backups.length}</div>
          <div className="sv-stat-foot">Live records from backend</div>
        </div>

        <div className="sv-card sv-stat">
          <div className="sv-stat-label">Completed backups</div>
          <div className="sv-stat-value">{loading ? "—" : completedCount}</div>
          <div className="sv-stat-foot">
            {loading
              ? "Loading..."
              : `${totalFiles} files across completed backups`}
          </div>
        </div>

        <div className="sv-card sv-stat">
          <div className="sv-stat-label">Verified this session</div>
          <div className="sv-stat-value">{loading ? "—" : verifiedCount}</div>
          <div className="sv-stat-foot">
            Verification is not permanently stored by the current backend
          </div>
        </div>
      </div>

      <div className="sv-notice">
        <span
          aria-hidden="true"
          style={{ color: "var(--sv-accent)", fontSize: 19 }}
        >
          ◈
        </span>

        <div>
          <div style={{ fontSize: 13, fontWeight: 750 }}>
            Backup integrity and recovery
          </div>

          <p className="sv-muted" style={{ margin: "5px 0 0" }}>
            Newly created backups are verified by the backend. For older
            backups, use Verify before relying on them. Restore puts missing
            files and metadata back into SecureVault; it does not save files
            directly to a Windows folder.
          </p>
        </div>
      </div>

      <section
        className="sv-card"
        style={{ marginTop: 22, overflow: "hidden" }}
      >
        <div
          style={{
            padding: 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 15 }}>Backup history</h2>
            <p className="sv-muted" style={{ margin: "5px 0 0" }}>
              Actual backup records retrieved from your backend.
            </p>
          </div>

          <div style={{ color: "var(--sv-text-muted)", fontSize: 11 }}>
            {filteredBackups.length} record(s)
          </div>
        </div>

        <div
          style={{
            padding: "0 18px 17px",
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <input
            aria-label="Search backups"
            className="sv-search"
            placeholder="Search backup name or ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            aria-label="Filter by integrity"
            className="sv-search"
            style={{ width: "auto" }}
            value={integrityFilter}
            onChange={(event) => setIntegrityFilter(event.target.value)}
          >
            <option value="All">All integrity statuses</option>
            <option value="Verified">Verified</option>
            <option value="Not checked">Not checked</option>
          </select>
        </div>

        <div className="sv-table-wrap">
          <table className="sv-table">
            <thead>
              <tr>
                <th>Backup</th>
                <th>Date</th>
                <th>Files</th>
                <th>Size</th>
                <th>Status</th>
                <th>Integrity</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                filteredBackups.map((backup) => {
                  const id = getBackupId(backup);
                  const status = String(backup.status || "").toUpperCase();
                  const isDeleted = status === "DELETED";
                  const isCompleted = status === "COMPLETED";
                  const isBusy = busyId === id;

                  const integrity = verifiedIds.has(id)
                    ? "Verified"
                    : "Not checked";

                  return (
                    <tr key={id}>
                      <td>
                        <div style={{ fontWeight: 750 }}>
                          {backup.backup_name || `Backup #${id}`}
                        </div>
                        <div
                          style={{
                            color: "var(--sv-text-muted)",
                            marginTop: 5,
                            fontSize: 10,
                          }}
                        >
                          ID: {id}
                        </div>
                      </td>

                      <td>{formatDate(backup.created_at)}</td>
                      <td>{Number(backup.file_count || 0)}</td>
                      <td>{formatSize(backup.total_size)}</td>

                      <td>
                        <span
                          className="sv-badge"
                          style={
                            isDeleted
                              ? {
                                  background: "var(--sv-surface-raised)",
                                  color: "var(--sv-text-muted)",
                                }
                              : undefined
                          }
                        >
                          {getStatusLabel(backup.status)}
                        </span>
                      </td>

                      <td>
                        <span
                          className="sv-badge"
                          style={
                            integrity !== "Verified"
                              ? {
                                  background: "var(--sv-surface-raised)",
                                  color: "var(--sv-text-muted)",
                                }
                              : undefined
                          }
                        >
                          {integrity}
                        </span>
                      </td>

                      <td>
                        <div className="sv-actions">
                          <button
                            type="button"
                            className="sv-button"
                            disabled={!isCompleted || isBusy || creating}
                            onClick={() => verifyBackup(id)}
                            title="Verify backup integrity"
                          >
                            {isBusy && busyAction === "verify"
                              ? "Checking..."
                              : "Verify"}
                          </button>

                          <button
                            type="button"
                            className="sv-button"
                            disabled={!isCompleted || isBusy || creating}
                            onClick={() => requestRestoreBackup(id)}
                            title="Restore into SecureVault"
                          >
                            {isBusy && busyAction === "restore"
                              ? "Restoring..."
                              : "Restore"}
                          </button>

                          <button
                            type="button"
                            className="sv-button sv-button-danger"
                            disabled={isDeleted || isBusy || creating}
                            onClick={() => requestDeleteBackup(id)}
                            title="Permanently delete backup"
                          >
                            {isBusy && busyAction === "delete"
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {loading && (
            <div
              style={{
                padding: 30,
                textAlign: "center",
                color: "var(--sv-text-muted)",
                fontSize: 12,
              }}
            >
              Loading backup records from backend...
            </div>
          )}

          {!loading && filteredBackups.length === 0 && (
            <div
              style={{
                padding: 30,
                textAlign: "center",
                color: "var(--sv-text-muted)",
                fontSize: 12,
              }}
            >
              {backups.length === 0
                ? "No backup records found. Use Create Backup to create your first backup."
                : "No matching backup records."}
            </div>
          )}
        </div>

        <div
          style={{
            padding: 15,
            borderTop: "1px solid var(--sv-border)",
            color: "var(--sv-text-muted)",
            fontSize: 11,
          }}
        >
          Backup records and operations are connected to the authenticated
          backend. Verification status is shown only for the current page
          session.
        </div>
      </section>

      {confirmation && (
        <div
          className="sv-confirm-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelConfirmation();
            }
          }}
        >
          <div
            className="sv-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sv-confirm-title"
            aria-describedby="sv-confirm-description"
          >
            <div className="sv-confirm-top">
              <div
                className={`sv-confirm-icon ${
                  confirmation.tone === "danger"
                    ? "sv-confirm-icon-danger"
                    : ""
                }`}
                aria-hidden="true"
              >
                {confirmation.icon}
              </div>

              <div>
                <p className="sv-confirm-kicker">{confirmation.kicker}</p>
                <h2 className="sv-confirm-title" id="sv-confirm-title">
                  {confirmation.title}
                </h2>
              </div>
            </div>

            <p
              className="sv-confirm-description"
              id="sv-confirm-description"
            >
              {confirmation.description}
            </p>

            <div className="sv-confirm-actions">
              <button
                type="button"
                className="sv-button"
                onClick={cancelConfirmation}
              >
                Cancel
              </button>

              <button
                type="button"
                autoFocus
                className={`sv-button ${
                  confirmation.tone === "danger"
                    ? "sv-confirm-danger"
                    : "sv-button-primary"
                }`}
                onClick={confirmPendingAction}
              >
                {confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
