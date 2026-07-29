import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';

const ACTION_ICON = {
  register: '🆕',
  login: '🔑',
  verify_otp: '✅',
  view_flight: '👀',
  lock_seat: '💺',
  cancel_lock: '↩️',
  confirm_booking: '🎫',
  cancel_booking: '❌',
  view_my_bookings: '📋',
};

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get('/activity-logs/my-logs')
      .then((res) => setLogs(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ maxWidth: 600, margin: '30px auto', padding: '0 24px' }}>
        <h2 style={{ marginBottom: 20 }}>Lịch sử hoạt động</h2>

        <div className="card">
          {loading && <div style={{ textAlign: 'center', padding: 30 }}>Đang tải...</div>}

          {!loading && logs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-secondary)' }}>
              Chưa có hoạt động nào được ghi nhận
            </div>
          )}

          {logs.map((log) => (
            <div className="activity-item" key={log.id}>
              <div className="activity-icon">{ACTION_ICON[log.action] || '📌'}</div>
              <div className="activity-content">
                <div className="activity-desc">{log.description}</div>
                <div className="activity-time">{formatTime(log.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}