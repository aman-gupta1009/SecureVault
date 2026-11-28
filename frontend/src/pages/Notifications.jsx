
import { useCallback, useEffect, useState } from "react";
import "./Notifications.css";

const API_BASE = "http://localhost:4000/api";
const PAGE_SIZE = 20;

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

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function categoryLabel(category) {
  const labels = {
    SECURITY: "Security",
    BACKUP: "Backup",
    ACCOUNT: "Account",
  };

  return labels[category] || category || "General";
}

function severityLabel(severity) {
  return String(severity || "INFO").toLowerCase();
}

function NotificationIcon({ category }) {
  const icons = {
    SECURITY: "◈",
    BACKUP: "↻",
    ACCOUNT: "◎",
  };

  return (
    <span className={`nt-icon nt-icon-${String(category || "general").toLowerCase()}`}>
      {icons[category] || "●"}
    </span>
  );
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [overallTotal, setOverallTotal] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [filter, setFilter] = useState("ALL");
  const [category, setCategory] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadNotifications = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      if (filter === "UNREAD") {
        params.set("unreadOnly", "true");
      }

      if (category !== "ALL") {
        params.set("category", category);
      }

      const [filteredResult, overallResult] = await Promise.all([
  apiRequest(`/notifications?${params.toString()}`),
  apiRequest("/notifications?page=1&limit=1"),
]);

const { response, data } = filteredResult;

if (overallResult.response.ok && overallResult.data.success) {
  setOverallTotal(
    Number(overallResult.data.data?.pagination?.total) || 0
  );
}
      if (response.status === 401) {
        setNotifications([]);
        setError("Your session has expired. Please sign in again.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load notifications.");
      }

      const result = data.data || {};

      setNotifications(
        Array.isArray(result.notifications) ? result.notifications : []
      );

      setPagination(
        result.pagination || {
          page,
          limit: PAGE_SIZE,
          total: 0,
          totalPages: 0,
        }
      );
    } catch (err) {
      setError(err.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [filter, category]);

  const notifyShell = useCallback(() => {
    window.dispatchEvent(new Event("securevault:notifications-updated"));
  }, []);

  useEffect(() => {
    loadNotifications(1);
  }, [loadNotifications]);

  useEffect(() => {
    const refresh = () => loadNotifications(pagination.page);

    window.addEventListener("securevault:notifications-updated", refresh);

    return () => {
      window.removeEventListener("securevault:notifications-updated", refresh);
    };
  }, [loadNotifications, pagination.page]);

  async function handleMarkRead(notificationId) {
    setActionLoading(String(notificationId));
    setError("");
    setNotice("");

    try {
      const { response, data } = await apiRequest(
        `/notifications/${notificationId}/read`,
        { method: "PATCH" }
      );

      if (response.status === 401) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to mark notification as read.");
      }

      setNotice("Notification marked as read.");
      await loadNotifications(pagination.page);
      notifyShell();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  }

  async function handleMarkAllRead() {
    setActionLoading("all");
    setError("");
    setNotice("");

    try {
      const { response, data } = await apiRequest(
        "/notifications/read-all",
        { method: "PATCH" }
      );

      if (response.status === 401) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to mark all as read.");
      }

      setNotice(
        `${data.data?.updatedCount ?? 0} notification(s) marked as read.`
      );

      await loadNotifications(1);
      notifyShell();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  }

  async function handleDelete(notificationId) {
    setActionLoading(`delete-${notificationId}`);
    setError("");
    setNotice("");

    try {
      const { response, data } = await apiRequest(
        `/notifications/${notificationId}`,
        { method: "DELETE" }
      );

      if (response.status === 401) {
        setError("Your session has expired. Please sign in again.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete notification.");
      }

      const nextPage =
        notifications.length === 1 && pagination.page > 1
          ? pagination.page - 1
          : pagination.page;

      setNotice("Notification deleted.");
      await loadNotifications(nextPage);
      notifyShell();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading("");
    }
  }

  function changeFilter(value) {
    setFilter(value);
    setNotice("");
  }

  function changeCategory(value) {
    setCategory(value);
    setNotice("");
  }

  const unreadOnPage = notifications.filter(
    (item) => !item.is_read
  ).length;

  return (
    <section className="nt-page">
      <div className="nt-heading">
        <div>
          <div className="nt-eyebrow">ALERTS &amp; UPDATES</div>
          <h1>Notifications</h1>
          <p>
            Review your security alerts, backup updates and account activity.
          </p>
        </div>

        <button
          type="button"
          className="nt-mark-all"
          onClick={handleMarkAllRead}
          disabled={actionLoading !== "" || unreadOnPage === 0}
        >
          {actionLoading === "all" ? "Updating..." : "Mark all as read"}
        </button>
      </div>

      <div className="nt-summary">
        <div className="nt-summary-card">
          <span className="nt-summary-label">Total notifications</span>
          <strong>{overallTotal}</strong>
        </div>

        <div className="nt-summary-card">
          <span className="nt-summary-label">Unread on this page</span>
          <strong>{unreadOnPage}</strong>
        </div>

        <div className="nt-summary-card">
          <span className="nt-summary-label">Current page</span>
          <strong>
            {pagination.totalPages > 0 ? pagination.page : 0}
            <small> / {pagination.totalPages}</small>
          </strong>
        </div>
      </div>

      <div className="nt-toolbar">
        <div className="nt-filter-tabs">
          <button
            type="button"
            className={filter === "ALL" ? "active" : ""}
            onClick={() => changeFilter("ALL")}
          >
            All
          </button>

          <button
            type="button"
            className={filter === "UNREAD" ? "active" : ""}
            onClick={() => changeFilter("UNREAD")}
          >
            Unread
          </button>
        </div>

        <select
          className="nt-category-select"
          value={category}
          onChange={(event) => changeCategory(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="ALL">All categories</option>
          <option value="SECURITY">Security</option>
          <option value="BACKUP">Backup</option>
          <option value="ACCOUNT">Account</option>
        </select>

        <button
          type="button"
          className="nt-refresh"
          onClick={() => loadNotifications(pagination.page)}
          disabled={loading}
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="nt-message nt-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="nt-message nt-success" role="status">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="nt-state">
          <span className="nt-spinner" />
          <p>Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="nt-empty">
          <div className="nt-empty-icon">♧</div>
          <h3>No notifications found</h3>
          <p>
            {filter === "UNREAD"
              ? "You're all caught up. There are no unread notifications matching this filter."
              : "There are no notifications matching your selected filters."}
          </p>
        </div>
      ) : (
        <div className="nt-list">
          {notifications.map((item) => (
            <article
              className={`nt-item ${item.is_read ? "is-read" : "is-unread"}`}
              key={item.notification_id}
            >
              <NotificationIcon category={item.category} />

              <div className="nt-item-content">
                <div className="nt-item-topline">
                  <div className="nt-item-title-row">
                    <h3>{item.title}</h3>
                    {!item.is_read && (
                      <span className="nt-unread-dot" title="Unread" />
                    )}
                  </div>

                  <span className={`nt-severity nt-severity-${severityLabel(item.severity)}`}>
                    {item.severity || "INFO"}
                  </span>
                </div>

                <p className="nt-item-message">{item.message}</p>

                <div className="nt-item-meta">
                  <span>{categoryLabel(item.category)}</span>
                  <span className="nt-meta-dot">•</span>
                  <time>{formatDate(item.created_at)}</time>
                </div>
              </div>

              <div className="nt-item-actions">
                {!item.is_read && (
                  <button
                    type="button"
                    className="nt-action-button"
                    onClick={() => handleMarkRead(item.notification_id)}
                    disabled={actionLoading !== ""}
                  >
                    {actionLoading === String(item.notification_id)
                      ? "Saving..."
                      : "Mark read"}
                  </button>
                )}

                <button
                  type="button"
                  className="nt-delete-button"
                  onClick={() => handleDelete(item.notification_id)}
                  disabled={actionLoading !== ""}
                  aria-label={`Delete notification: ${item.title}`}
                  title="Delete notification"
                >
                  {actionLoading === `delete-${item.notification_id}`
                    ? "..."
                    : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="nt-pagination">
          <span>
            Showing page {pagination.page} of {pagination.totalPages}
          </span>

          <div>
            <button
              type="button"
              onClick={() => loadNotifications(pagination.page - 1)}
              disabled={loading || pagination.page <= 1}
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() => loadNotifications(pagination.page + 1)}
              disabled={
                loading || pagination.page >= pagination.totalPages
              }
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
