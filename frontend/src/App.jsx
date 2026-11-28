 //App.jsx


import { useEffect, useState } from "react";
import "./index.css";
import WorkspaceShell from "./components/WorkspaceShell.jsx";
import RecipientShare from "./pages/RecipientShare.jsx";

const API = "http://localhost:4000/api";

const passwordRules = [
  ["At least 12 characters", (value) => value.length >= 12],
  ["One uppercase letter", (value) => /[A-Z]/.test(value)],
  ["One lowercase letter", (value) => /[a-z]/.test(value)],
  ["One number", (value) => /[0-9]/.test(value)],
  ["One special character", (value) => /[^A-Za-z0-9]/.test(value)],
];

async function api(path, body, method = "POST") {
  const response = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: body
      ? { "Content-Type": "application/json" }
      : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(
      result.message || `Request failed (${response.status})`
    );
  }

  return result;
}

function ShieldIcon({ size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2.5 20 5.7v5.2c0 5.2-3.3 8.6-8 10.6-4.7-2-8-5.4-8-10.6V5.7L12 2.5Z" />
      <path d="m8.5 12 2.2 2.2 4.9-5" />
    </svg>
  );
}

function Icon({ type, size = 18 }) {
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

  const paths = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="15" r="4" />
        <path d="m11 12 9-9 2 2-3 3 2 2-3 3-2-2-3 3" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    eyeoff: (
      <>
        <path d="m3 3 18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.8M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4-.8" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    lock: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 1 1 8 0v3" />
      </>
    ),
    activity: (
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
      </>
    ),
  };

  return <svg {...common}>{paths[type] || paths.lock}</svg>;
}

function Brand() {
  return (
    <div className="brand">
      <div className="brand-icon">
        <ShieldIcon size={25} />
      </div>
      <div className="brand-name">
        securevault<span>.</span>
        <small>PERSONAL SECURITY PLATFORM</small>
      </div>
    </div>
  );
}

function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  maxLength,
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <label className="field">
      <span className="field-label">{label}</span>

      <span className="input-wrap">
        <span className="input-icon">
          <Icon
            type={
              isPassword
                ? "key"
                : type === "email"
                  ? "mail"
                  : "lock"
            }
          />
        </span>

        <input
          type={isPassword ? (visible ? "text" : "password") : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            placeholder ||
            (isPassword ? "Enter your password" : "you@company.com")
          }
          autoComplete={autoComplete}
          maxLength={maxLength}
          required
        />

        {isPassword && (
          <button
            type="button"
            className="show-password"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            <Icon type={visible ? "eyeoff" : "eye"} />
          </button>
        )}
      </span>
    </label>
  );
}

function PasswordRules({ value }) {
  return (
    <div className="rules">
      {passwordRules.map(([label, test]) => {
        const valid = test(value);

        return (
          <span
            key={label}
            className={valid ? "rule valid" : "rule"}
          >
            <Icon type="check" size={12} />
            {label}
          </span>
        );
      })}
    </div>
  );
}

function Notice({ notice }) {
  if (!notice) return null;

  return (
    <div
      className={`notice ${notice.type}`}
      role={notice.type === "error" ? "alert" : "status"}
    >
      <span className="notice-symbol">
        {notice.type === "success" ? (
          <Icon type="check" />
        ) : (
          "!"
        )}
      </span>
      <span>{notice.text}</span>
    </div>
  );
}


function SecureVaultIntro() {
  return (
    <div className="sv-intro" role="status" aria-label="Opening SecureVault">
      <style>{`
        .sv-intro {
          position: fixed;
          inset: 0;
          z-index: 99999;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: var(--sv-page-bg, #080d0a);
          color: var(--sv-text, #edf8f0);
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
          animation: sv-intro-out 450ms ease 1.25s forwards;
        }

        .sv-intro-glow {
          position: absolute;
          width: min(75vw, 440px);
          aspect-ratio: 1;
          border-radius: 50%;
          background: var(--sv-accent, #83edb0);
          opacity: .08;
          filter: blur(85px);
          animation: sv-glow-pulse 1.6s ease-in-out infinite alternate;
        }

        .sv-intro-content {
          position: relative;
          display: flex;
          align-items: center;
          flex-direction: column;
          padding: 24px;
          animation: sv-logo-reveal 650ms cubic-bezier(.2,.8,.2,1) both;
        }

        .sv-intro-emblem {
          width: 94px;
          height: 94px;
          display: grid;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--sv-accent, #83edb0) 55%, transparent);
          border-radius: 28px;
          background: var(--sv-surface, #0d1711);
          color: var(--sv-accent, #83edb0);
          box-shadow: 0 0 0 9px color-mix(in srgb, var(--sv-accent, #83edb0) 5%, transparent),
                      0 0 55px color-mix(in srgb, var(--sv-accent, #83edb0) 17%, transparent);
          animation: sv-emblem-pulse 1.6s ease-in-out infinite;
        }

        .sv-intro-brand {
          margin-top: 28px;
          font-size: clamp(27px, 5vw, 37px);
          font-weight: 800;
          letter-spacing: -1.6px;
        }

        .sv-intro-brand span {
          color: var(--sv-accent, #83edb0);
        }

        .sv-intro-tagline {
          margin-top: 10px;
          color: var(--sv-text-muted, #91a99a);
          font-size: 11px;
          letter-spacing: 2px;
          text-align: center;
          text-transform: uppercase;
        }

        .sv-intro-progress {
          width: 145px;
          height: 3px;
          margin-top: 32px;
          overflow: hidden;
          border-radius: 10px;
          background: var(--sv-border, #23372a);
        }

        .sv-intro-progress span {
          display: block;
          width: 100%;
          height: 100%;
          transform: scaleX(0);
          transform-origin: left;
          background: var(--sv-accent, #83edb0);
          animation: sv-progress 1.15s ease-out forwards;
        }

        .sv-intro-caption {
          margin-top: 12px;
          color: var(--sv-text-muted, #91a99a);
          font-size: 9px;
          letter-spacing: 1.7px;
        }

        @keyframes sv-logo-reveal {
          from { opacity: 0; transform: translateY(14px) scale(.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes sv-emblem-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.035); }
        }

        @keyframes sv-glow-pulse {
          from { opacity: .04; transform: scale(.9); }
          to { opacity: .12; transform: scale(1.08); }
        }

        @keyframes sv-progress {
          to { transform: scaleX(1); }
        }

        @keyframes sv-intro-out {
          to { opacity: 0; visibility: hidden; pointer-events: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .sv-intro, .sv-intro-content, .sv-intro-emblem,
          .sv-intro-glow, .sv-intro-progress span {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>

      <div className="sv-intro-glow" />

      <div className="sv-intro-content">
        <div className="sv-intro-emblem">
          <ShieldIcon size={52} />
        </div>

        <div className="sv-intro-brand">
          securevault<span>.</span>
        </div>

        <div className="sv-intro-tagline">
          Your files. Your control.
        </div>

        <div className="sv-intro-progress">
          <span />
        </div>

        <div className="sv-intro-caption">
          PREPARING YOUR SECURE WORKSPACE
        </div>
      </div>
    </div>
  );
}

function AuthApp()  {
  const [showIntro, setShowIntro] = useState(true);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [user, setUser] = useState(null);
  const [activePage, setActivePage] = useState("Overview");
  const [resendWait, setResendWait] = useState(0);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    setShowIntro(false);
  }, 1700);

  return () => window.clearTimeout(timer);
}, []);

  useEffect(() => {
    if (resendWait <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setResendWait((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendWait]);

  function go(nextMode) {
    setMode(nextMode);
    setNotice(null);
    setPassword("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  }

  async function submit(event) {
    event.preventDefault();
    setNotice(null);

    if (!email.trim()) {
      setNotice({ type: "error", text: "Enter your email address." });
      return;
    }

    if (
      (mode === "register" || mode === "reset") &&
      !passwordRules.every(([, test]) =>
        test(mode === "register" ? password : newPassword)
      )
    ) {
      setNotice({
        type: "error",
        text: "Please meet every password requirement.",
      });
      return;
    }

    if (mode === "reset" && newPassword !== confirmPassword) {
      setNotice({
        type: "error",
        text: "The new passwords do not match.",
      });
      return;
    }

    if (
      ["verify-registration", "verify-recovery", "reset"].includes(mode) &&
      !/^\d{6}$/.test(otp)
    ) {
      setNotice({
        type: "error",
        text: "Enter the 6-digit code from your email.",
      });
      return;
    }

    setBusy(true);

    try {
      if (mode === "login") {
        await api("/auth/login", {
          email: email.trim(),
          password,
        });

        const result = await api("/auth/me", undefined, "GET");
        setUser(result.data || { email });
      } else if (mode === "register") {
        const result = await api("/auth/register", {
          email: email.trim(),
          password,
        });

        setNotice({
          type: "success",
          text: result.message || "Check your inbox for the verification code.",
        });
        setMode("verify-registration");
      } else if (mode === "verify-registration") {
        const result = await api("/auth/verify-otp", {
          email: email.trim(),
          otp,
        });

        setNotice({
          type: "success",
          text: result.message || "Email verified. You can sign in.",
        });
        setMode("login");
        setPassword("");
        setOtp("");
      } else if (mode === "forgot") {
        const result = await api("/auth/forgot-password", {
          email: email.trim(),
        });

        setNotice({
          type: "success",
          text:
            result.message ||
            "If an eligible account exists, recovery instructions will be sent.",
        });
        setMode("verify-recovery");
      } else if (mode === "verify-recovery") {
        const result = await api("/auth/verify-reset-otp", {
          email: email.trim(),
          otp,
        });

        setNotice({
          type: "success",
          text: result.message || "Code verified. Choose a new password.",
        });
        setMode("reset");
      } else if (mode === "reset") {
        const result = await api("/auth/reset-password", {
          email: email.trim(),
          otp,
          newPassword,
        });

        setNotice({
          type: "success",
          text: result.message || "Password reset. Please sign in.",
        });
        setMode("login");
        setPassword("");
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Unable to complete the request.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || resendWait > 0) return;

    setBusy(true);
    setNotice(null);

    try {
      const path =
        mode === "verify-registration"
          ? "/auth/resend-otp"
          : "/auth/forgot-password";

      const result = await api(path, { email: email.trim() });

      setNotice({
        type: "success",
        text: result.message || "If eligible, a new code has been requested.",
      });

      setResendWait(60);
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Could not request another code.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);

    try {
      await api("/auth/logout", {});
      setUser(null);
      go("login");
      setNotice({ type: "success", text: "You have signed out." });
    } catch (error) {
      setNotice({
        type: "error",
        text: error.message || "Sign out failed.",
      });
    } finally {
      setBusy(false);
    }
  }

  const screens = {
    login: [
      "WELCOME BACK",
      "Access your vault.",
      "Sign in to your private security workspace.",
      "Sign in securely",
    ],
    register: [
      "CREATE YOUR ACCOUNT",
      "Start with security.",
      "Create an account for your private workspace.",
      "Create account",
    ],
    "verify-registration": [
      "EMAIL VERIFICATION",
      "Check your inbox.",
      `Enter the 6-digit code sent to ${email}.`,
      "Verify email",
    ],
    forgot: [
      "ACCOUNT RECOVERY",
      "Let's get you back in.",
      "Recovery instructions are sent only if an eligible account exists.",
      "Send recovery code",
    ],
    "verify-recovery": [
      "RECOVERY VERIFICATION",
      "Confirm it's you.",
      `Enter the recovery code sent to ${email}.`,
      "Verify recovery code",
    ],
    reset: [
      "NEW CREDENTIALS",
      "Re-secure your account.",
      "Choose a strong new password to finish recovery.",
      "Reset password",
    ],
  };

  const [eyebrow, title, description, submitText] = screens[mode];

  if (showIntro) {
  return <SecureVaultIntro />;
}

if (user) {
  return (
    <WorkspaceShell
      user={user}
      busy={busy}
      onSignOut={signOut}
      activePage={activePage}
      onNavigate={setActivePage}
    />
  );
}

  return (
    <main className="page">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />
      <div className="grid-overlay" />

      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          <span className="online">
            <i /> SECURITY SERVICES ONLINE
          </span>
          <span className="separator" />
          <span className="edition">PRIVATE / ACCESS CONTROL</span>
        </div>
      </header>

      <div className="layout">
        <section className="story">
          <div className="story-meta">
            <span>SECURE ACCESS GATEWAY</span>
            <span>SV / 01.0</span>
          </div>

          <div className="hero-visual">
            <div className="orbit orbit-a" />
            <div className="orbit orbit-b" />
            <div className="orbit orbit-c" />
            <div className="cross cross-x" />
            <div className="cross cross-y" />

            <div className="halo">
              <div className="hero-shield">
                <ShieldIcon size={49} />
              </div>
            </div>

            <span className="float-tag tag-top">
              <i /> ACCESS LAYER <b>01</b>
            </span>

            <span className="float-tag tag-bottom">
              <Icon type="lock" size={14} /> PRIVATE BY DESIGN
            </span>

            <span className="node node-a" />
            <span className="node node-b" />
            <span className="node node-c" />

            <div className="telemetry telemetry-a">
              <small>AUTH STATUS</small>
              <strong><i /> READY</strong>
            </div>

            <div className="telemetry telemetry-b">
              <small>SECURITY MODEL</small>
              <strong>SESSION BASED</strong>
            </div>
          </div>

          <div className="story-copy">
            <div className="micro">
              <span className="micro-line" />
              YOUR DATA. YOUR BOUNDARIES.
            </div>

            <h1>
              Security that
              <br />
              starts with <em>you.</em>
            </h1>

            <p>
              A private workspace for the files that matter. Designed around
              deliberate access, clear controls, and privacy at its core.
            </p>
          </div>

          <div className="principles">
            <div>
              <span className="principle-icon">
                <Icon type="lock" />
              </span>
              <span>
                <strong>Controlled access</strong>
                <small>Authenticated sessions</small>
              </span>
            </div>

            <div>
              <span className="principle-icon">
                <Icon type="key" />
              </span>
              <span>
                <strong>Vault-first design</strong>
                <small>Dedicated security layer</small>
              </span>
            </div>

            <div>
              <span className="principle-icon">
                <Icon type="activity" />
              </span>
              <span>
                <strong>Security focused</strong>
                <small>Intentional access UX</small>
              </span>
            </div>
          </div>

          <footer className="story-footer">
            <span>SECUREVAULT © {new Date().getFullYear()}</span>
            <span>PRIVACY IS THE DEFAULT <b>◆</b></span>
          </footer>
        </section>

        <section className="auth-column">
          <div className="auth-card">
            <div className="card-top">
              <div className="card-symbol">
                <ShieldIcon />
              </div>
              <span className="step">
                SECURE ACCESS{" "}
                <b>
                  /
                  {mode === "login"
                    ? "01"
                    : mode === "register"
                      ? "02"
                      : "03"}
                </b>
              </span>
            </div>

            <div className="heading">
              <div className="eyebrow">{eyebrow}</div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>

            <Notice notice={notice} />

            <form className="form" onSubmit={submit}>
              <Input
                label="Email address"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                maxLength={255}
              />

              {["login", "register"].includes(mode) && (
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              )}

              {mode === "register" && <PasswordRules value={password} />}

              {["verify-registration", "verify-recovery", "reset"].includes(
                mode
              ) && (
                <label className="field">
                  <span className="field-label">
                    6-digit verification code
                  </span>

                  <span className="input-wrap">
                    <span className="input-icon">
                      <Icon type="lock" />
                    </span>

                    <input
                      className="otp"
                      value={otp}
                      onChange={(event) =>
                        setOtp(
                          event.target.value.replace(/\D/g, "").slice(0, 6)
                        )
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      pattern="[0-9]{6}"
                      minLength={6}
                      maxLength={6}
                      required
                    />
                  </span>
                </label>
              )}

              {mode === "reset" && (
                <>
                  <Input
                    label="New password"
                    type="password"
                    value={newPassword}
                    onChange={setNewPassword}
                    autoComplete="new-password"
                  />

                  <PasswordRules value={newPassword} />

                  <Input
                    label="Confirm new password"
                    type="password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                  />
                </>
              )}

              {mode === "login" && (
                <div className="form-options">
                  <label className="remember">
                    <input type="checkbox" />
                    <span>Remember this device</span>
                  </label>

                  <button
                    type="button"
                    className="text-link"
                    onClick={() => go("forgot")}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button className="submit" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <span className="spinner" />
                    Securing request…
                  </>
                ) : (
                  <>
                    {submitText}
                    <Icon type="arrow" />
                  </>
                )}
              </button>

              {["verify-registration", "verify-recovery"].includes(mode) && (
                <button
                  className="resend"
                  type="button"
                  disabled={busy || resendWait > 0}
                  onClick={resend}
                >
                  {resendWait > 0
                    ? `Request another code in ${resendWait}s`
                    : "Didn't receive a code? Request again"}
                </button>
              )}
            </form>

            <div className="switch">
              {mode === "login" && (
                <>
                  New to SecureVault?{" "}
                  <button type="button" onClick={() => go("register")}>
                    Create an account <Icon type="arrow" size={13} />
                  </button>
                </>
              )}

              {mode === "register" && (
                <>
                  Already registered?{" "}
                  <button type="button" onClick={() => go("login")}>
                    Sign in <Icon type="arrow" size={13} />
                  </button>
                </>
              )}

              {mode === "verify-registration" && (
                <>
                  Wrong email?{" "}
                  <button type="button" onClick={() => go("register")}>
                    Go back <Icon type="arrow" size={13} />
                  </button>
                </>
              )}

              {mode === "forgot" && (
                <>
                  Remember your password?{" "}
                  <button type="button" onClick={() => go("login")}>
                    Back to sign in <Icon type="arrow" size={13} />
                  </button>
                </>
              )}

              {mode === "verify-recovery" && (
                <>
                  Need to restart?{" "}
                  <button type="button" onClick={() => go("forgot")}>
                    Go back <Icon type="arrow" size={13} />
                  </button>
                </>
              )}

              {mode === "reset" && (
                <>
                  Changed your mind?{" "}
                  <button type="button" onClick={() => go("login")}>
                    Back to sign in <Icon type="arrow" size={13} />
                  </button>
                </>
              )}
            </div>

            <div className="trust-note">
              <Icon type="lock" size={14} />
              <span>
                Never share your password or one-time code with anyone.
              </span>
            </div>
          </div>

          <div className="auth-foot">
            <span>SECUREVAULT / IDENTITY</span>
            <span>SECURITY · PRIVACY · CONTROL</span>
          </div>
        </section>
      </div>
    </main>
  );
}
export default function App() {
  const match = window.location.pathname.match(
    /^\/share\/([^/]+)\/?$/
  );

  if (match) {
    let shareToken = "";

    try {
      shareToken = decodeURIComponent(match[1]);
    } catch {
      shareToken = "";
    }

    return <RecipientShare shareToken={shareToken} />;
  }

  return <AuthApp />;
}
