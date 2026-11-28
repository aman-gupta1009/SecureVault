
import { useCallback, useEffect, useRef, useState } from "react";
import "./RecipientShare.css";

const API =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function readJsonResponse(response) {
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || `Request failed (${response.status})`
    );
  }

  return result;
}

async function recipientJsonRequest(path, body, sessionToken) {
  const response = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    credentials: "omit",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(sessionToken
        ? { Authorization: `Bearer ${sessionToken}` }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  return readJsonResponse(response);
}

async function getBinaryResponse(path, sessionToken) {
  const response = await fetch(`${API}${path}`, {
    method: "GET",
    credentials: "omit",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Unable to load file (${response.status})`
    );
  }

  return response.blob();
}

function formatBytes(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(value) {
  if (!value) return "No expiry";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString();
}

function AccessLimit({ label, used, remaining, maximum }) {
  if (maximum === null || maximum === undefined) return null;

  return (
    <div className="recipient-limit">
      <span>{label}</span>
      <strong>
        {remaining} remaining
      </strong>
      <small>
        {used} of {maximum} used
      </small>
    </div>
  );
}

export default function RecipientShare({ shareToken }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [shareInfo, setShareInfo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewType, setPreviewType] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState(null);

  const previewUrlRef = useRef("");

  const showError = (message) => {
    setNotice({ type: "error", text: message });
  };

  const showSuccess = (message) => {
    setNotice({ type: "success", text: message });
  };

  const clearPreviewUrl = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = "";
    }

    setPreviewUrl("");
    setPreviewType("");
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const requestOtp = async (event) => {
    event.preventDefault();
    setNotice(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const result = await recipientJsonRequest(
        `/shares/access/${encodeURIComponent(shareToken)}/request-otp`,
        { email: cleanEmail }
      );

      setEmail(cleanEmail);
      setOtpSent(true);
      showSuccess(
        result.message ||
          "If the share details are valid, an OTP has been sent."
      );
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setNotice(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!/^\d{6}$/.test(cleanOtp)) {
      showError("Enter the six-digit OTP.");
      return;
    }

    setLoading(true);

    try {
      const result = await recipientJsonRequest(
        `/shares/access/${encodeURIComponent(shareToken)}/verify-otp`,
        {
          email: cleanEmail,
          otp: cleanOtp,
        }
      );

      const newSessionToken = result.data?.sessionToken;

      if (!newSessionToken) {
        throw new Error(
          "Verification succeeded, but the recipient session token was not returned."
        );
      }

      setSessionToken(newSessionToken);
      setRecipientEmail(
        result.data?.recipientEmail || cleanEmail
      );

      const infoResult = await recipientJsonRequest(
        `/shares/access/${encodeURIComponent(shareToken)}`,
        null,
        newSessionToken
      );

      setShareInfo(infoResult.data);
      showSuccess("Email verified. Your shared file is ready.");
    } catch (error) {
      setSessionToken("");
      setShareInfo(null);
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionToken || !shareInfo) return undefined;

    let cancelled = false;
    let createdUrl = "";

    const loadPreview = async () => {
      setPreviewLoading(true);
      setNotice(null);
      clearPreviewUrl();

      try {
        const blob = await getBinaryResponse(
          `/shares/access/${encodeURIComponent(shareToken)}/preview`,
          sessionToken
        );

        if (cancelled) return;

        createdUrl = URL.createObjectURL(blob);
        previewUrlRef.current = createdUrl;

        setPreviewType(
          blob.type || shareInfo.mimeType || "application/octet-stream"
        );
        setPreviewUrl(createdUrl);
      } catch (error) {
        if (!cancelled) {
          showError(error.message);
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;

      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);

        if (previewUrlRef.current === createdUrl) {
          previewUrlRef.current = "";
        }
      }
    };
  }, [sessionToken, shareInfo, shareToken, clearPreviewUrl]);

  const downloadFile = async () => {
    if (!sessionToken || shareInfo?.permissionType !== "DOWNLOAD") {
      return;
    }

    setDownloading(true);
    setNotice(null);

    try {
      const blob = await getBinaryResponse(
        `/shares/access/${encodeURIComponent(shareToken)}/download`,
        sessionToken
      );

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = shareInfo.fileName || "shared-file";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      showSuccess("Your download has started.");
    } catch (error) {
      showError(error.message);
    } finally {
      setDownloading(false);
    }
  };

  const isViewOnly = shareInfo?.permissionType === "VIEW";
  const isImage = previewType.startsWith("image/");
  const isPdf = previewType === "application/pdf";
  const isText = previewType.startsWith("text/");

  const watermarkText = shareInfo?.watermarkEnabled
    ? `${shareInfo.watermark?.recipientEmail || recipientEmail} • SECUREVAULT`
    : "";

  if (!shareToken) {
    return (
      <main className="recipient-page">
        <section className="recipient-card">
          <h1>Invalid sharing link</h1>
          <p>This sharing link is missing its access token.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="recipient-page">
      <header className="recipient-header">
        <div className="recipient-brand">
          <span className="recipient-brand-icon">S</span>
          <span>SecureVault</span>
        </div>
        <span className="recipient-secure-label">
          <span className="recipient-secure-dot" />
          SECURE FILE SHARING
        </span>
      </header>

      <section className="recipient-card">
        {!sessionToken ? (
          <>
            <div className="recipient-icon">🔐</div>

            <p className="recipient-eyebrow">
              PRIVATE FILE ACCESS
            </p>

            <h1>Verify your email</h1>

            <p className="recipient-description">
              The owner has shared a protected file with you.
              Verify your email address to access it securely.
            </p>

            {!otpSent ? (
              <form onSubmit={requestOtp} className="recipient-form">
                <label htmlFor="recipient-email">
                  Recipient email address
                </label>

                <input
                  id="recipient-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={255}
                />

                <button
                  className="recipient-primary-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Sending OTP..." : "Send verification code"}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="recipient-form">
                <label htmlFor="recipient-otp">
                  Six-digit verification code
                </label>

                <input
                  id="recipient-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  required
                  maxLength={6}
                />

                <p className="recipient-help">
                  Enter the code sent to <strong>{email}</strong>.
                </p>

                <button
                  className="recipient-primary-button"
                  type="submit"
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? "Verifying..." : "Verify and open file"}
                </button>

                <button
                  className="recipient-text-button"
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                    setNotice(null);
                  }}
                >
                  Change email address
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <div className="recipient-file-heading">
              <div>
                <p className="recipient-eyebrow">
                  VERIFIED SHARED FILE
                </p>
                <h1>{shareInfo?.fileName || "Shared file"}</h1>
                <p className="recipient-description">
                  Shared with {recipientEmail}
                </p>
              </div>

              <span
                className={`recipient-permission ${
                  isViewOnly ? "view-only" : "download"
                }`}
              >
                {isViewOnly ? "VIEW ONLY" : "DOWNLOAD"}
              </span>
            </div>

            {shareInfo && (
              <>
                <div className="recipient-file-meta">
                  <div>
                    <span>File size</span>
                    <strong>{formatBytes(shareInfo.fileSize)}</strong>
                  </div>
                  <div>
                    <span>Expires</span>
                    <strong>{formatDate(shareInfo.expiresAt)}</strong>
                  </div>
                </div>

                <div className="recipient-limits">
                  <AccessLimit
                    label="File opens"
                    used={shareInfo.openCount}
                    remaining={shareInfo.remainingOpens}
                    maximum={shareInfo.maxOpens}
                  />

                  {!isViewOnly && (
                    <AccessLimit
                      label="Downloads"
                      used={shareInfo.downloadCount}
                      remaining={shareInfo.remainingDownloads}
                      maximum={shareInfo.maxDownloads}
                    />
                  )}
                </div>

                {isViewOnly && (
                  <div className="recipient-view-warning">
                    <strong>View-only access</strong>
                    <span>
                      Downloading is disabled for this share. Browser-level
                      restrictions cannot guarantee prevention of screenshots
                      or external screen recording.
                    </span>
                  </div>
                )}

                <div
                  className="recipient-preview"
                  onContextMenu={
                    isViewOnly
                      ? (event) => event.preventDefault()
                      : undefined
                  }
                >
                  {previewLoading ? (
                    <div className="recipient-preview-message">
                      <span className="recipient-spinner" />
                      Loading secure preview...
                    </div>
                  ) : previewUrl ? (
                    <div className="recipient-preview-content">
                      {isImage ? (
                        <img
                          src={previewUrl}
                          alt={shareInfo.fileName}
                          draggable="false"
                        />
                      ) : isPdf ? (
                        <iframe
                          title="Shared PDF preview"
                          src={previewUrl}
                          className="recipient-pdf-frame"
                        />
                      ) : isText ? (
                        <iframe
                          title="Shared text preview"
                          src={previewUrl}
                          className="recipient-text-frame"
                        />
                      ) : (
                        <div className="recipient-preview-message">
                          <div className="recipient-file-symbol">FILE</div>
                          <strong>Preview not available</strong>
                          <span>
                            This file type cannot be displayed in the browser.
                          </span>
                        </div>
                      )}

                      {shareInfo.watermarkEnabled && (
                        <div
                          className="recipient-watermark"
                          aria-hidden="true"
                        >
                          {Array.from({ length: 12 }, (_, index) => (
                            <span key={index}>{watermarkText}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="recipient-preview-message">
                      <strong>Preview could not be loaded</strong>
                      <span>
                        The share may have expired, been revoked, or reached
                        an access limit.
                      </span>
                    </div>
                  )}
                </div>

                <div className="recipient-actions">
                  {!isViewOnly && (
                    <button
                      type="button"
                      className="recipient-primary-button"
                      onClick={downloadFile}
                      disabled={
                        downloading ||
                        shareInfo.remainingDownloads === 0
                      }
                    >
                      {downloading ? "Preparing download..." : "Download file"}
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {notice && (
          <div
            className={`recipient-notice ${notice.type}`}
            role="status"
          >
            {notice.text}
          </div>
        )}

        <div className="recipient-footer-note">
          <span>🔒</span>
          Access is protected by email verification and share permissions.
        </div>
      </section>

      <footer className="recipient-page-footer">
        SECUREVAULT · PRIVATE FILE SHARING
      </footer>
    </main>
  );
}
