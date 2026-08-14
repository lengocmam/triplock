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

function airportCode(city) {
  return city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3).toUpperCase();
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTimeShort(dateStr) {
  return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function formatDuration(dep, arr) {
  const mins = Math.round((new Date(arr) - new Date(dep)) / 60000);
  return `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`;
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
    apiClient.get('/bookings/my-bookings').then((res) => setBookings(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { loadBookings(); }, []);

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Bạn chắc chắn muốn hủy vé này?')) return;
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
  groups.sort((a, b) => new Date(b[0].createdAt) - new Date(a[0].createdAt));

  return (
    <div className="page-container">
      <Navbar />
      <div style={{ maxWidth: 760, margin: '30px auto', padding: '0 24px' }}>
        <h2 style={{ marginBottom: 22, fontFamily: 'var(--font-display)' }}>🎫 Vé của tôi</h2>

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
            <div className={`ticket-card ${isPrintTarget ? 'ticket-printing' : ''}`} key={first.bookingCode || first.id}>
              <div className="boarding-pass">
                <div className="bp-main">
                  <div className="bp-header">
                    <div className="bp-airline">✈️ TripLock Air · {flight.flightCode}</div>
                    <span className={`bp-status-tag bp-status-${status}`}>{STATUS_LABEL[status] || status}</span>
                  </div>

                  <div className="bp-route-row">
                    <div className="bp-city-block">
                      <div className="bp-city-code">{airportCode(flight.departureCity)}</div>
                      <div className="bp-city-name">{flight.departureCity}</div>
                    </div>
                    <div className="bp-route-mid">
                      <div className="bp-route-duration">{formatDuration(flight.departureTime, flight.arrivalTime)}</div>
                      <div className="bp-route-line"><span className="bp-route-plane">✈️</span></div>
                    </div>
                    <div className="bp-city-block" style={{ textAlign: 'right' }}>
                      <div className="bp-city-code">{airportCode(flight.arrivalCity)}</div>
                      <div className="bp-city-name">{flight.arrivalCity}</div>
                    </div>
                  </div>

                  <div className="bp-details-grid">
                    <div>
                      <div className="bp-detail-label">Ngày bay</div>
                      <div className="bp-detail-value">{formatDateShort(flight.departureTime)}</div>
                    </div>
                    <div>
                      <div className="bp-detail-label">Giờ bay</div>
                      <div className="bp-detail-value">{formatTimeShort(flight.departureTime)}</div>
                    </div>
                    <div>
                      <div className="bp-detail-label">Hạng vé</div>
                      <div className="bp-detail-value">{first.fareClass?.name}</div>
                    </div>
                    <div>
                      <div className="bp-detail-label">Số vé</div>
                      <div className="bp-detail-value">{group.length}</div>
                    </div>
                  </div>

                  <div className="bp-passengers">
                    {group.map((b) => (
                      <div className="bp-passenger-row" key={b.id}>
                        <span className="bp-passenger-name">{b.passengerName || '—'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="bp-passenger-seat">Ghế {b.seat.seatNumber}</span>
                          {status === 'confirmed' && (
                            <button
                              className="btn btn-danger print-hide"
                              style={{ padding: '3px 10px', fontSize: 11 }}
                              disabled={cancellingId === b.id}
                              onClick={() => handleCancel(b.id)}
                            >
                              {cancellingId === b.id ? '...' : 'Hủy'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bp-stub">
                  <div className="bp-stub-code">{first.bookingCode || '— — —'}</div>
                  <div className="bp-stub-gate">
                    <div className="bp-stub-gate-label">Ghế</div>
                    <div className="bp-stub-gate-value">{group[0].seat.seatNumber}</div>
                  </div>
                  <div className="bp-barcode" />
                </div>
              </div>

              {status === 'confirmed' && (
                <div className="bp-actions">
                  <button
                    className="btn btn-secondary print-hide"
                    style={{ flex: 1 }}
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}