import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';
import { useToast } from '../context/ToastContext';

const STATUS_LABEL = {
  confirmed: 'Đã xác nhận',
  pending: 'Chờ thanh toán',
  expired: 'Đã hết hạn',
  cancelled: 'Đã hủy',
};

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [printingCode, setPrintingCode] = useState(null);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const loadBookings = () => {
    setLoading(true);
    apiClient
      .get('/bookings/my-bookings')
      .then((res) => setBookings(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Bạn chắc chắn muốn hủy vé này? Hành động này không thể hoàn tác.')) {
      return;
    }
    setCancellingId(bookingId);
    try {
      await apiClient.post(`/bookings/cancel-confirmed/${bookingId}`);
      addToast('Đã hủy vé thành công', 'success');
      loadBookings();
    } catch (err) {
      addToast(err.response?.data?.message || 'Hủy vé thất bại', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  const groups = [];
  const seenCodes = new Set();
  bookings.forEach((b) => {
    const groupKey = b.bookingCode || b.id;
    if (seenCodes.has(groupKey)) return;
    seenCodes.add(groupKey);
    const sameGroup = b.bookingCode ? bookings.filter((x) => x.bookingCode === b.bookingCode) : [b];
    groups.push(sameGroup);
  });
  groups.sort((a, b) => new Date(b[0].createdAt).getTime() - new Date(a[0].createdAt).getTime());

  return (
    <div className="page-container">
      <Navbar />

      <div style={{ maxWidth: 700, margin: '30px auto', padding: '0 24px' }}>
        <h2 style={{ marginBottom: 20 }}>Vé của tôi</h2>

        {loading && <div style={{ textAlign: 'center', padding: 40 }}>Đang tải...</div>}

        {!loading && groups.length === 0 && (
          <div className="empty-state card">
            <div className="empty-state-icon">🎫</div>
            <p>Bạn chưa có vé nào</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/flights')}>
              Tìm chuyến bay ngay
            </button>
          </div>
        )}

        {groups.map((group) => {
          const first = group[0];
          const flight = first.seat.flight;
          const status = first.status;
          const isPrintTarget = printingCode === (first.bookingCode || first.id);

          return (
            <div
              className={`ticket-card ${isPrintTarget ? 'ticket-printing' : ''}`}
              key={first.bookingCode || first.id}
            >
              <div className="ticket-header">
                <div className="ticket-code">
                  Mã đặt chỗ
                  <strong>{first.bookingCode || 'Chưa hoàn tất'}</strong>
                </div>
                <div className={`ticket-status ticket-status-${status}`}>
                  {STATUS_LABEL[status] || status}
                </div>
              </div>

              <div className="ticket-body">
                <div className="ticket-route-row">
                  <span className="flight-code-badge">{flight.flightCode}</span>
                  <strong style={{ fontSize: 16 }}>
                    {flight.departureCity} → {flight.arrivalCity}
                  </strong>
                </div>

                <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 14 }}>
                  Khởi hành: {formatDateTime(flight.departureTime)}
                </p>

                <div>
                  {group.map((b) => (
                    <div className="ticket-passenger-row" key={b.id}>
                      <span>
                        {b.passengerName || '(Chưa có tên khách)'} · Ghế <strong>{b.seat.seatNumber}</strong>
                        <span style={{ color: '#9aa5b1' }}> · {b.fareClass?.name}</span>
                      </span>
                      {status === 'confirmed' && (
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancel(b.id)}
                        >
                          {cancellingId === b.id ? 'Đang hủy...' : 'Hủy vé'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {status === 'confirmed' && (
                  <button
                    className="btn btn-secondary print-hide"
                    style={{ marginTop: 14, width: '100%' }}
                    onClick={() => {
                      setPrintingCode(first.bookingCode || first.id);
                      setTimeout(() => {
                        window.print();
                        setPrintingCode(null);
                      }, 100);
                    }}
                  >
                    🖨️ In vé điện tử
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}