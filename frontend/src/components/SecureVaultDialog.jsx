
import { useEffect } from "react";
import "./SecureVaultDialog.css";

export default function SecureVaultDialog({
  open,
  title = "Are you sure?",
  description = "",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  busy = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) {
        onCancel?.();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return (
    <div
      className="sv-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onCancel?.();
        }
      }}
    >
      <section
        className="sv-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sv-dialog-title"
        aria-describedby="sv-dialog-description"
      >
        <div className="sv-dialog-top">
          <div className={`sv-dialog-icon ${variant}`}>
            {variant === "danger" ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3 2.8 19a1.4 1.4 0 0 0 1.2 2h16a1.4 1.4 0 0 0 1.2-2L12 3Z" />
                <path d="M12 9v5M12 17.5h.01" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3 20 6v5c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-3Z" />
                <path d="m8.5 12 2.2 2.2 4.8-5" />
              </svg>
            )}
          </div>

          <button
            type="button"
            className="sv-dialog-close"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close dialog"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="sv-dialog-content">
          <span className="sv-dialog-eyebrow">SECUREVAULT SECURITY</span>

          <h2 id="sv-dialog-title">{title}</h2>

          <p id="sv-dialog-description">{description}</p>
        </div>

        <div className="sv-dialog-actions">
          <button
            type="button"
            className="sv-dialog-cancel"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            className={`sv-dialog-confirm ${variant}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <span className="sv-dialog-spinner" />}
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>

        <div className="sv-dialog-footer">
          <span className="sv-dialog-footer-dot" />
          Your account security is protected by SecureVault
        </div>
      </section>
    </div>
  );
}
