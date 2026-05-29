import {useState, useEffect, useRef, useCallback} from 'react';
import {Bell, Check, CheckCheck, Megaphone, X} from 'lucide-react';
import api from '../services/api';
import './NotificationBell.css';

const PRIORITY_COLORS = {
  urgent: '#ef4444',
  important: '#f59e0b',
  normal: '#3b82f6',
};

const AUDIENCE_LABELS = {
  all: 'Everyone',
  student: 'Students',
  company: 'Companies',
};

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/announcements?limit=30');
      if (res.data?.success) {
        setNotifications(res.data.data || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('[NOTIFICATIONS] Fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and every 60s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Re-fetch when panel opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/announcements/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? {...n, isRead: true} : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('[NOTIFICATIONS] Mark-read error:', err.message);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/announcements/read-all');
      setNotifications((prev) => prev.map((n) => ({...n, isRead: true})));
      setUnreadCount(0);
    } catch (err) {
      console.error('[NOTIFICATIONS] Mark-all-read error:', err.message);
    }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="ntf-bell-wrap" ref={panelRef}>
      <button
        className="ntf-bell-btn"
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="ntf-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="ntf-panel">
          <div className="ntf-panel-header">
            <h4>Notifications</h4>
            <div className="ntf-header-actions">
              {unreadCount > 0 && (
                <button className="ntf-mark-all" onClick={handleMarkAllRead} title="Mark all as read">
                  <CheckCheck size={14} /> Read All
                </button>
              )}
              <button className="ntf-close" onClick={() => setOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="ntf-panel-body">
            {loading && !notifications.length && (
              <div className="ntf-empty">Loading...</div>
            )}
            {!loading && !notifications.length && (
              <div className="ntf-empty">
                <Megaphone size={28} />
                <span>No notifications yet</span>
              </div>
            )}
            {notifications.map((n) => (
              <div
                key={n._id}
                className={`ntf-item ${n.isRead ? 'read' : 'unread'}`}
                onClick={() => !n.isRead && handleMarkRead(n._id)}
              >
                <div
                  className="ntf-priority-dot"
                  style={{background: PRIORITY_COLORS[n.priority] || PRIORITY_COLORS.normal}}
                />
                <div className="ntf-item-content">
                  <div className="ntf-item-title">
                    {n.title}
                    {n.priority === 'urgent' && <span className="ntf-urgent-tag">URGENT</span>}
                    {n.priority === 'important' && <span className="ntf-important-tag">IMPORTANT</span>}
                  </div>
                  <p className="ntf-item-msg">{n.message}</p>
                  <div className="ntf-item-meta">
                    <span>{formatTime(n.createdAt)}</span>
                    <span className="ntf-audience-tag">{AUDIENCE_LABELS[n.audience] || n.audience}</span>
                    <span>by {n.createdBy}</span>
                  </div>
                </div>
                {!n.isRead && (
                  <button className="ntf-read-btn" title="Mark as read" onClick={(e) => { e.stopPropagation(); handleMarkRead(n._id); }}>
                    <Check size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
