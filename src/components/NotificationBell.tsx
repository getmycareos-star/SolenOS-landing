import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPersonId, getJSON } from '../api/client';

const NotificationBell: React.FC = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [personId, setPersonId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch the personId on mount
  useEffect(() => {
    const id = getPersonId();
    setPersonId(id);
  }, []);

  // Fetch the unread count periodically
  useEffect(() => {
    if (!personId) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await getJSON<{ unread_count: number }>(
          `/person/${personId}/notifications/unread-count`
        );
        setUnreadCount(response.unread_count);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    // Fetch immediately
    fetchUnreadCount();

    // Set up polling every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [personId]);

  const handleClick = () => {
    navigate('/notifications');
  };

  return (
    <button
      onClick={handleClick}
      className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-muted transition-colors"
      aria-label="Notifications"
    >
      {/* Bell icon */}
      <svg
        className="w-5 h-5 text-current"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5h-9c-.83 0-1.5.67-1.5 1.5v3.68C7.64 4.36 6 6.92 6 10v5l-2 2v1h16v-1l-2-2z"
          fill="currentColor"
        />
      </svg>
      {/* Unread badge */}
      {unreadCount > 0 && (
        <div
          className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-medium text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      )}
    </button>
  );
};

export default NotificationBell;