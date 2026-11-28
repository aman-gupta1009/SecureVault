
import { useCallback, useEffect, useState } from "react";
import "./PasswordManager.css";
import BrandLogo from "../components/BrandLogo.jsx";

const API_BASE = "http://localhost:4000/api";

const EMPTY_FORM = {
  websiteName: "",
  accountIdentifier: "",
  password: "",
};

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return { response, data };
}

function ConfirmModal({
  dialog,
  onCancel,
  onConfirm,
  busy,
}) {
  if (!dialog) return null;

  return (
    <div
      className="pm-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel();
        }
      }}
    >
      <section
        className="pm-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="pm-modal-title"
        aria-describedby="pm-modal-description"
      >
        <div
          className={`pm-modal-icon ${
            dialog.danger ? "pm-modal-icon-danger" : "pm-modal-icon-accent"
          }`}
          aria-hidden="true"
        >
          {dialog.danger ? "!" : "◆"}
        </div>

        <div className="pm-modal-content">
          <h2 id="pm-modal-title">{dialog.title}</h2>

          <p id="pm-modal-description">{dialog.message}</p>

          {dialog.detail && (
            <div className="pm-modal-detail">
              {dialog.detail}
            </div>
          )}
        </div>

        <div className="pm-modal-actions">
          <button
            type="button"
            className="pm-secondary-button"
            onClick={onCancel}
            disabled={busy}
          >
            {dialog.cancelLabel || "Cancel"}
          </button>

          <button
            type="button"
            className={
              dialog.danger
                ? "pm-danger-confirm-button"
                : "pm-primary-button"
            }
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? "Please wait..." : dialog.confirmLabel || "Confirm"}
          </button>
        </div>
      </section>
    </div>
  );
}

function PasswordManager() {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [updatingId, setUpdatingId] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { response, data } = await apiRequest(
        "/password-manager"
      );

      if (response.status === 423) {
        setCredentials([]);
        setRevealedPasswords({});
        setError(
          "Your vault is locked. Unlock SecureVault to access saved passwords."
        );
        return;
      }

      if (response.status === 401) {
        setCredentials([]);
        setRevealedPasswords({});
        setError(
          "Your session has expired. Please sign in again."
        );
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load saved credentials."
        );
      }

      setCredentials(
        Array.isArray(data.credentials)
          ? data.credentials
          : []
      );
    } catch (err) {
      setError(
        err.message || "Unable to connect to SecureVault."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  useEffect(() => {
    if (!confirmDialog) return;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !confirmBusy) {
        setConfirmDialog(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [confirmDialog, confirmBusy]);

  function showMessage(message) {
    setNotice(message);
    setError("");
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function openConfirmation(dialog) {
    setConfirmBusy(false);
    setConfirmDialog(dialog);
  }

  function closeConfirmation() {
    if (confirmBusy) return;

    setConfirmDialog(null);
  }

  async function executeConfirmation() {
    if (!confirmDialog?.onConfirm || confirmBusy) return;

    setConfirmBusy(true);

    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } catch (err) {
      setError(
        err.message || "The requested action could not be completed."
      );
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function replaceExistingPassword(credentialId, password) {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const updateResult = await apiRequest(
        `/password-manager/${credentialId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            password,
            confirmPasswordUpdate: true,
          }),
        }
      );

      if (updateResult.response.status === 423) {
        throw new Error(
          "Your vault is locked. Unlock it before updating passwords."
        );
      }

      if (updateResult.response.status === 401) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      if (
        !updateResult.response.ok ||
        !updateResult.data.success
      ) {
        throw new Error(
          updateResult.data.message || "Password update failed."
        );
      }

      setForm(EMPTY_FORM);
      setShowForm(false);
      setUpdatingId(null);
      setNewPassword("");

      setRevealedPasswords((current) => {
        const next = { ...current };
        delete next[credentialId];
        return next;
      });

      showMessage("Saved password updated successfully.");

      await loadCredentials();
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        websiteName: form.websiteName.trim(),
        accountIdentifier: form.accountIdentifier.trim(),
        password: form.password,
      };

      const { response, data } = await apiRequest(
        "/password-manager",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 423) {
        throw new Error(
          "Your vault is locked. Unlock it before saving credentials."
        );
      }

      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      if (
        response.status === 409 &&
        data.status === "update_confirmation_required"
      ) {
        const pendingPassword = form.password;
        const pendingCredentialId = data.credentialId;

        openConfirmation({
          title: "Replace saved password?",
          message:
            "This website and username already have a saved password, but the password you entered is different.",
          detail:
            "If you continue, the existing password will be replaced. The old password will not be retained. Cancel will keep the existing password unchanged.",
          confirmLabel: "Update password",
          cancelLabel: "Keep existing",
          danger: false,
          onConfirm: () =>
            replaceExistingPassword(
              pendingCredentialId,
              pendingPassword
            ),
        });

        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to save this credential."
        );
      }

      setForm(EMPTY_FORM);
      setShowForm(false);

      if (data.status === "already_saved") {
        showMessage(
          "This account is already saved. No duplicate was created."
        );
      } else {
        showMessage("Credential saved securely.");
      }

      await loadCredentials();
    } catch (err) {
      setError(
        err.message || "Unable to save credential."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleReveal(credentialId) {
    if (
      Object.prototype.hasOwnProperty.call(
        revealedPasswords,
        credentialId
      )
    ) {
      setRevealedPasswords((current) => {
        const next = { ...current };
        delete next[credentialId];
        return next;
      });

      return;
    }

    setError("");
    setNotice("");

    try {
      const { response, data } = await apiRequest(
        `/password-manager/${credentialId}/reveal`,
        {
          method: "POST",
        }
      );

      if (response.status === 423) {
        throw new Error(
          "Your vault is locked. Unlock it to reveal passwords."
        );
      }

      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to reveal password."
        );
      }

      setRevealedPasswords((current) => ({
        ...current,
        [credentialId]: data.password,
      }));
    } catch (err) {
      setError(
        err.message || "Unable to reveal password."
      );
    }
  }

  async function copyToClipboard(value, label) {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable.");
      }

      await navigator.clipboard.writeText(value);
      showMessage(`${label} copied to clipboard.`);
    } catch {
      setError(
        "Clipboard access failed. Check your browser permissions."
      );
    }
  }

  function startPasswordUpdate(credentialId) {
    setUpdatingId(credentialId);
    setNewPassword("");
    setError("");
    setNotice("");
  }

  function requestPasswordUpdate(credentialId) {
    if (!newPassword) {
      setError("Enter the new password first.");
      return;
    }

    const pendingPassword = newPassword;

    openConfirmation({
      title: "Confirm password change",
      message:
        "Are you sure you want to replace the currently saved password?",
      detail:
        "The old password will not be retained. This change will affect the saved login in SecureVault.",
      confirmLabel: "Replace password",
      cancelLabel: "Go back",
      danger: false,
      onConfirm: () =>
        replaceExistingPassword(
          credentialId,
          pendingPassword
        ),
    });
  }

  function deleteCredential(credentialId, websiteName) {
    openConfirmation({
      title: "Delete saved login?",
      message: `Do you want to delete the saved login for ${websiteName}?`,
      detail:
        "This action cannot be undone. The saved credential will be permanently removed from your Password Manager.",
      confirmLabel: "Delete login",
      cancelLabel: "Keep login",
      danger: true,
      onConfirm: async () => {
        setError("");
        setNotice("");

        const { response, data } = await apiRequest(
          `/password-manager/${credentialId}`,
          {
            method: "DELETE",
          }
        );

        if (response.status === 423) {
          throw new Error(
            "Your vault is locked. Unlock it before deleting credentials."
          );
        }

        if (response.status === 401) {
          throw new Error(
            "Your session has expired. Please sign in again."
          );
        }

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to delete credential."
          );
        }

        setCredentials((current) =>
          current.filter(
            (item) =>
              String(item.credentialId) !== String(credentialId)
          )
        );

        setRevealedPasswords((current) => {
          const next = { ...current };
          delete next[credentialId];
          return next;
        });

        if (String(updatingId) === String(credentialId)) {
          setUpdatingId(null);
          setNewPassword("");
        }

        showMessage("Credential deleted successfully.");
      },
    });
  }

  const filteredCredentials = credentials.filter((item) => {
    const query = search.trim().toLowerCase();

    if (!query) return true;

    return (
      item.websiteName?.toLowerCase().includes(query) ||
      item.websiteOrigin?.toLowerCase().includes(query) ||
      item.accountIdentifier?.toLowerCase().includes(query)
    );
  });

  return (
    <section className="pm-page">
      <div className="pm-header">
        <div>
          <div className="pm-eyebrow">SECURITY TOOLS</div>

          <h1>Password Manager</h1>

          <p>
            Keep your website and application login credentials
            protected inside SecureVault.
          </p>
        </div>

        <button
          type="button"
          className="pm-primary-button"
          onClick={() => {
            setShowForm((current) => !current);
            setError("");
            setNotice("");
          }}
        >
          <span aria-hidden="true">＋</span>
          {showForm ? "Close form" : "Add password"}
        </button>
      </div>

      <div className="pm-security-note">
        <span className="pm-security-icon">◆</span>

        <div>
          <strong>Encrypted credential storage</strong>

          <p>
            Passwords are encrypted before being stored.
            Your vault must remain unlocked to access
            saved credentials.
          </p>
        </div>
      </div>

      {error && (
        <div className="pm-alert pm-alert-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="pm-alert pm-alert-success" role="status">
          {notice}
        </div>
      )}

      {showForm && (
        <form className="pm-form-card" onSubmit={handleSave}>
          <div className="pm-form-heading">
            <div>
              <h2>Save a new login</h2>

              <p>
                Enter the website or application name
                and its account details.
              </p>
            </div>
          </div>

          <div className="pm-form-grid">
            <label className="pm-field">
              <span>Website / Application Name</span>

              <input
                type="text"
                value={form.websiteName}
                onChange={(event) =>
                  updateForm("websiteName", event.target.value)
                }
                placeholder="e.g. Instagram, Gmail, Facebook"
                maxLength={150}
                required
              />
            </label>

            <label className="pm-field">
              <span>Username / Email</span>

              <input
                type="text"
                value={form.accountIdentifier}
                onChange={(event) =>
                  updateForm("accountIdentifier", event.target.value)
                }
                placeholder="Enter username or email"
                maxLength={320}
                autoComplete="off"
                required
              />
            </label>

            <label className="pm-field">
              <span>Password</span>

              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  updateForm("password", event.target.value)
                }
                placeholder="Enter account password"
                maxLength={4096}
                autoComplete="new-password"
                required
              />
            </label>
          </div>

          <div className="pm-form-actions">
            <button
              type="button"
              className="pm-secondary-button"
              onClick={() => {
                setShowForm(false);
                setForm(EMPTY_FORM);
              }}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="pm-primary-button"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save securely"}
            </button>
          </div>
        </form>
      )}

      <div className="pm-list-toolbar">
        <div>
          <h2>Saved passwords</h2>

          <span>{credentials.length} saved accounts</span>
        </div>

        <div className="pm-search">
          <span aria-hidden="true">⌕</span>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search websites or accounts"
            aria-label="Search saved passwords"
          />
        </div>
      </div>

      {loading ? (
        <div className="pm-empty-state">
          <div className="pm-loading-indicator" />

          <p>Loading your saved credentials...</p>
        </div>
      ) : filteredCredentials.length === 0 ? (
        <div className="pm-empty-state">
          <div className="pm-empty-icon">⌑</div>

          <h3>
            {credentials.length === 0
              ? "No passwords saved yet"
              : "No matching accounts"}
          </h3>

          <p>
            {credentials.length === 0
              ? "Add your first website or application login to get started."
              : "Try searching with another website name or username."}
          </p>

          {credentials.length === 0 && (
            <button
              type="button"
              className="pm-primary-button"
              onClick={() => setShowForm(true)}
            >
              Add your first password
            </button>
          )}
        </div>
      ) : (
        <div className="pm-credential-list">
          {filteredCredentials.map((item) => {
            const id = item.credentialId;

            const isRevealed =
              Object.prototype.hasOwnProperty.call(
                revealedPasswords,
                id
              );

            const websiteOrigin =
              item.entrySource === "manual"
                ? null
                : item.websiteOrigin;

            return (
              <article className="pm-credential-card" key={id}>
                <div className="pm-credential-main">
                  <BrandLogo
                    websiteName={item.websiteName}
                    websiteOrigin={websiteOrigin}
                  />

                  <div className="pm-credential-info">
                    <h3>{item.websiteName}</h3>

                    <span>
                      {websiteOrigin || "Manual entry"}
                    </span>

                    <strong>{item.accountIdentifier}</strong>
                  </div>
                </div>

                <div className="pm-credential-password">
                  <span>Password</span>

                  <div className="pm-password-value">
                    <code>
                      {isRevealed
                        ? revealedPasswords[id]
                        : "••••••••••••"}
                    </code>

                    <button
                      type="button"
                      className="pm-icon-button"
                      onClick={() => toggleReveal(id)}
                      title={isRevealed ? "Hide password" : "Reveal password"}
                      aria-label={isRevealed ? "Hide password" : "Reveal password"}
                    >
                      {isRevealed ? "Hide" : "Show"}
                    </button>

                    {isRevealed && (
                      <button
                        type="button"
                        className="pm-icon-button"
                        onClick={() =>
                          copyToClipboard(revealedPasswords[id], "Password")
                        }
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>

                <div className="pm-credential-actions">
                  <button
                    type="button"
                    className="pm-secondary-button pm-small-button"
                    onClick={() =>
                      copyToClipboard(item.accountIdentifier, "Username")
                    }
                  >
                    Copy username
                  </button>

                  <button
                    type="button"
                    className="pm-secondary-button pm-small-button"
                    onClick={() => startPasswordUpdate(id)}
                  >
                    Change password
                  </button>

                  <button
                    type="button"
                    className="pm-danger-button"
                    onClick={() => deleteCredential(id, item.websiteName)}
                  >
                    Delete
                  </button>
                </div>

                {String(updatingId) === String(id) && (
                  <div className="pm-update-panel">
                    <label className="pm-field">
                      <span>New password</span>

                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) =>
                          setNewPassword(event.target.value)
                        }
                        placeholder="Enter replacement password"
                        maxLength={4096}
                        autoComplete="new-password"
                      />
                    </label>

                    <div className="pm-update-actions">
                      <button
                        type="button"
                        className="pm-secondary-button"
                        onClick={() => {
                          setUpdatingId(null);
                          setNewPassword("");
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="pm-primary-button"
                        onClick={() => requestPasswordUpdate(id)}
                        disabled={saving}
                      >
                        Confirm update
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="pm-footer-note">
        <span>SecureVault Password Manager</span>

        <span>
          Passwords are hidden until you choose to reveal them.
        </span>
      </div>

      <ConfirmModal
        dialog={confirmDialog}
        onCancel={closeConfirmation}
        onConfirm={executeConfirmation}
        busy={confirmBusy}
      />
    </section>
  );
}

export default PasswordManager;
