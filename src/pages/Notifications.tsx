import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPersonId, getJSON, postJSON, patchJSON } from "../api/client";

const Notifications: React.FC = () => {
  const [personId, setPersonId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Array<any>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const navigate = useNavigate();

  // Fetch the personId on mount
  useEffect(() => {
    const id = getPersonId();
    setPersonId(id);
  }, []);

  // Fetch notifications
  useEffect(() => {
    if (!personId) return;

    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getJSON<{
          data: Array<any>;
          total: number;
          skip: number;
          limit: number;
        }>(
          `/person/${personId}/notifications?skip=${skip}&limit=${limit}`
        );
        setNotifications(prev => [...prev, ...response.data]);
        setHasMore(response.data.length === limit);
        setLoading(false);
      } catch (err) {
        setError("Failed to load notifications");
        setLoading(false);
        console.error(err);
      }
    };

    // Fetch the unread count
    const fetchUnreadCount = async () => {
      try {
        const response = await getJSON<{ unread_count: number }>(
          `/person/${personId}/notifications/unread-count`
        );
        setUnreadCount(response.unread_count);
      } catch (err) {
        console.error("Failed to fetch unread count:", err);
      }
    };

    if (skip === 0) {
      setNotifications([]);
    }
    fetchNotifications();
    fetchUnreadCount();
  }, [personId, skip, limit]);

  const handleLoadMore = () => {
    if (!hasMore || loading) return;
    setSkip(prev => prev + limit);
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await patchJSON(
        `/person/${personId}/notifications/${notificationId}`,
        { is_read: true }
      );
      // Update the local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      // We don't have a bulk endpoint, so we'll mark each one as read
      // In a real app, we would have a bulk endpoint.
      const unreadNotifications = notifications.filter(n => !n.is_read);
      for (const notification of unreadNotifications) {
        await patchJSON(
          `/person/${personId}/notifications/${notification.id}`,
          { is_read: true }
        );
      }
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const handleArchive = async (notificationId: number) => {
    try {
      await patchJSON(
        `/person/${personId}/notifications/${notificationId}`,
        { archived_at: new Date().toISOString() }
      );
      // Remove the notification from the list (or mark as archived)
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error("Failed to archive notification:", err);
    }
  };

  if (loading && notifications.length === 0) {
    return <div className="flex h-[200px] items-center justify-center">Loading notifications...</div>;
  }

  if (error) {
    return <div className="flex h-[200px] items-center justify-center">{error}</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            className={`px-3 py-1 rounded text-sm font-medium ${
              unreadCount === 0
                ? "bg-muted text-muted-foreground hover:bg-muted/80"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            Mark all as read ({unreadCount})
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {notifications.map((notification: any) => (
          <div
            key={notification.id}
            className={`flex items-start space-x-4 p-4 rounded-lg border ${
              !notification.is_read ? "bg-primary/5" : "bg-muted"
            }`}
          >
            <div className="flex-shrink-0">
              {/* Notification icon based on type */}
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* We'll use a generic bell icon for now */}
                <path
                  d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5h-9c-.83 0-1.5.67-1.5 1.5v3.68C7.64 4.36 6 6.92 6 10v5l-2 2v1h16v-1l-2-2z"
                  fill="currentColor"
                >
                  {/* Animate the bell if unread */}
                  {!notification.is_read && (
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 12 12"
                      to="10 12 12"
                      begin="0s"
                      dur="0.5s"
                      repeatCount="2"
                    />
                  )}
                </path>
              </svg>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between items-start">
                <h2 className="font-semibold">{notification.title}</h2>
                <span className="text-xs text-muted-foreground">
                  {new Date(notification.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-sm">{notification.message}</p>
              {notification.related_entity_type && notification.related_entity_id && (
                <div className="mt-2">
                  <button
                    onClick={() => {
                      // Navigate to the related entity
                      // We'll need to map the type to a route
                      // For now, we'll just log
                      console.log("Navigate to related entity:", notification.related_entity_type, notification.related_entity_id);
                    }}
                    className="text-sm text-primary hover:underline"
                  >
                    View related {notification.related_entity_type}
                  </button>
                </div>
              )}
              <div className="flex justify-end space-x-2 mt-2">
                {!notification.is_read && (
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Mark as read
                  </button>
                )}
                {!notification.archived_at && (
                  <button
                    onClick={() => handleArchive(notification.id)}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={handleLoadMore}
          className="w-full px-4 py-2 mt-6 rounded border hover:bg-muted"
        >
          Load more
        </button>
      )}
    </div>
  );
};

export default Notifications;
