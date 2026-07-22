import { useEffect, useState, useRef } from 'react';
import apiClient from '../api/client';
import { useSocket } from '../hooks/useSocket';

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return {
    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }),
  };
}
function airportCode(city) {
  return city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3).toUpperCase();
}

const STEPS = ['fare', 'seat', 'passenger', 'payment', 'success'];
const STEP_LABELS = {
  fare: '1. Chọn vé',
  seat: '2. Chọn ghế',
  passenger: '3. Thông tin khách',
  payment: '4. Thanh toán',
};

export default function BookingDrawer({ flightId, onClose, onDone }) {
  const socketRef = useSocket();
  const [step, setStep] = useState('fare');

  const [flight, setFlight] = useState(null);
  const [fares, setFares] = useState([]);
  const [selectedFareId, setSelectedFareId] = useState(null);
  const [passengerCount, setPassengerCount] = useState(1);

  const [seats, setSeats] = useState([]);
  // Danh sách các booking (ghế) MÌNH đang giữ trong lần mua này — có thể nhiều hơn 1
  const [myBookings, setMyBookings] = useState([]);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(null);

  // passengers: object dạng { [bookingId]: { name, phone } }
  const [passengers, setPassengers] = useState({});
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [confirmedBookings, setConfirmedBookings] = useState([]);

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient.get(`/flights/${flightId}`).then((res) => {
      setFlight(res.data);
      setSeats(res.data.seats);
    });
    apiClient.get(`/flights/${flightId}/fares`).then((res) => setFares(res.data));
  }, [flightId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('joinFlight', flightId);

    socket.on('seatLocked', ({ seatId }) => {
      setSeats((prev) => prev.map((s) => (s.id === seatId ? { ...s, status: 'locked' } : s)));
    });
    socket.on('seatBooked', ({ seatId }) => {
      setSeats((prev) => prev.map((s) => (s.id === seatId ? { ...s, status: 'booked' } : s)));
    });
    socket.on('seatReleased', ({ seatId }) => {
      setSeats((prev) => prev.map((s) => (s.id === seatId ? { ...s, status: 'available' } : s)));
    });

    return () => {
      socket.off('seatLocked');
      socket.off('seatBooked');
      socket.off('seatReleased');
    };
  }, [flightId, socketRef]);

  // Đếm ngược theo mốc hết hạn SỚM NHẤT trong các ghế đang giữ — vì ghế nào hết hạn trước sẽ mất trước
  useEffect(() => {
    if (myBookings.length === 0 || step === 'success') return;

    const earliestExpiry = Math.min(...myBookings.map((b) => new Date(b.lockExpiresAt).getTime()));

    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((earliestExpiry - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        setError('Đã hết thời gian giữ ghế, vui lòng chọn lại');
        setMyBookings([]);
        setStep('seat');
      }
    }, 1000);

    return () => clearInterval(countdownRef.current);
  }, [myBookings, step]);

  const handleClose = async () => {
    if (myBookings.length > 0 && step !== 'success') {
      await Promise.all(
        myBookings.map((b) => apiClient.post(`/bookings/cancel/${b.id}`).catch(() => {})),
      );
    }
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const selectedFare = fares.find((f) => f.id === selectedFareId);
  const totalPrice = selectedFare ? Number(selectedFare.price) * passengerCount : 0;

  // Chọn ghế: nếu đã chọn đủ số lượng thì không cho chọn thêm (trừ khi bỏ chọn 1 cái trước)
  const handleSelectSeat = async (seat) => {
    if (seat.status !== 'available') return;

    if (myBookings.length >= passengerCount) {
      setError(`Bạn chỉ được chọn tối đa ${passengerCount} ghế theo số hành khách đã chọn`);
      return;
    }

    setError('');
    try {
      const res = await apiClient.post(`/bookings/lock-seat/${seat.id}`, {
        fareClassId: selectedFareId,
      });
      setMyBookings((prev) => [...prev, res.data]);
      setSeats((prev) => prev.map((s) => (s.id === seat.id ? { ...s, status: 'locked' } : s)));
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể giữ ghế này');
    }
  };

  // Bấm vào ghế mình đang giữ để bỏ chọn (đổi ý muốn chọn ghế khác)
  const handleDeselectSeat = async (booking) => {
    await apiClient.post(`/bookings/cancel/${booking.id}`).catch(() => {});
    setMyBookings((prev) => prev.filter((b) => b.id !== booking.id));
    setSeats((prev) =>
      prev.map((s) => (s.id === booking.seat.id ? { ...s, status: 'available' } : s)),
    );
  };

  const handleSeatClick = (seat) => {
    const myBooking = myBookings.find((b) => b.seat.id === seat.id);
    if (myBooking) {
      handleDeselectSeat(myBooking);
    } else {
      handleSelectSeat(seat);
    }
  };

  const updatePassenger = (bookingId, field, value) => {
    setPassengers((prev) => ({
      ...prev,
      [bookingId]: { ...prev[bookingId], [field]: value },
    }));
  };

  const handleSubmitPassenger = (e) => {
    e.preventDefault();
    const missing = myBookings.some(
      (b) => !passengers[b.id]?.name?.trim() || !passengers[b.id]?.phone?.trim(),
    );
    if (missing) {
      setError('Vui lòng nhập đầy đủ thông tin cho tất cả hành khách');
      return;
    }
    setError('');
    setStep('payment');
  };

  const handlePay = async () => {
    if (myBookings.length === 0) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient.post('/bookings/confirm-multiple', {
        bookingIds: myBookings.map((b) => b.id),
        passengers: myBookings.map((b) => ({
          bookingId: b.id,
          passengerName: passengers[b.id].name,
          passengerPhone: passengers[b.id].phone,
        })),
      });
      setConfirmedBookings(res.data);
      setStep('success');
    } catch (err) {
      setError(err.response?.data?.message || 'Thanh toán thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  if (!flight || fares.length === 0) {
    return (
      <div className="modal-overlay" onClick={handleOverlayClick}>
        <div className="modal-drawer">
          <div style={{ textAlign: 'center', padding: 60 }}>Đang tải...</div>
        </div>
      </div>
    );
  }

  const dep = formatDateTime(flight.departureTime);
  const arr = formatDateTime(flight.arrivalTime);
  const durationMin = Math.round((new Date(flight.arrivalTime) - new Date(flight.departureTime)) / 60000);
  const durationText = `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;

  const seatsByRow = {};
  seats.forEach((seat) => {
    const rowNum = parseInt(seat.seatNumber);
    if (!seatsByRow[rowNum]) seatsByRow[rowNum] = {};
    seatsByRow[rowNum][seat.seatNumber.replace(String(rowNum), '')] = seat;
  });
  const rowNumbers = Object.keys(seatsByRow).map(Number).sort((a, b) => a - b);
  const LEFT_COLS = ['A', 'B', 'C'];
  const RIGHT_COLS = ['D', 'E', 'F'];

  const getSeatClass = (seat) => {
    if (!seat) return '';
    if (myBookings.some((b) => b.seat.id === seat.id)) return 'seat-mine';
    return `seat-${seat.status}`;
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-drawer">
        <div className="modal-header">
          <div className="modal-title">
            {flight.departureCity} ⇌ {flight.arrivalCity}
          </div>
          <button className="modal-close-btn" onClick={handleClose}>✕</button>
        </div>

        <div className="step-progress">
          {STEPS.filter((s) => s !== 'success').map((s, i) => (
            <div
              key={s}
              className={`step-item ${step === s ? 'step-active' : ''} ${STEPS.indexOf(step) > i ? 'step-done' : ''}`}
            >
              {STEP_LABELS[s]}
            </div>
          ))}
        </div>

        {error && <p className="error-text">{error}</p>}

        {/* BƯỚC 1: Chọn vé + số lượng hành khách */}
        {step === 'fare' && (
          <>
            <div className="fare-header-card">
              <div className="fare-header-route">
                <span className="flight-code-badge">{flight.flightCode}</span>
                <span style={{ color: '#6b7280', fontSize: 13 }}>{dep.date}</span>
              </div>
              <div className="fare-header-times">
                <div className="fare-time-block">
                  <div className="fare-time-value">{dep.time}</div>
                  <div className="fare-time-code">{airportCode(flight.departureCity)}</div>
                </div>
                <div className="fare-time-duration">
                  {durationText}
                  <div className="fare-time-line" />
                  Bay thẳng
                </div>
                <div className="fare-time-block">
                  <div className="fare-time-value">{arr.time}</div>
                  <div className="fare-time-code">{airportCode(flight.arrivalCity)}</div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="search-field-label">Số lượng hành khách</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`btn ${passengerCount === n ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ width: 44, padding: '10px 0' }}
                    onClick={() => setPassengerCount(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="fare-grid">
              {fares.map((fare) => (
                <div
                  key={fare.id}
                  className={`fare-card ${selectedFareId === fare.id ? 'fare-selected' : ''}`}
                  onClick={() => setSelectedFareId(fare.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="fare-name">{fare.name}</div>
                  <div className="fare-price">
                    {Number(fare.price).toLocaleString('vi-VN')} đ
                    <span className="fare-price-unit"> /khách</span>
                  </div>
                  <div className="fare-feature-list">
                    <div className="fare-feature">
                      <span className="fare-feature-icon fare-feature-yes">✓</span>
                      Hành lý xách tay {fare.carryOnKg}kg
                    </div>
                    <div className="fare-feature">
                      <span className={`fare-feature-icon ${fare.checkedBaggageKg > 0 ? 'fare-feature-yes' : 'fare-feature-no'}`}>
                        {fare.checkedBaggageKg > 0 ? '✓' : '✕'}
                      </span>
                      {fare.checkedBaggageKg > 0 ? `Hành lý ký gửi ${fare.checkedBaggageKg}kg` : 'Không có hành lý ký gửi'}
                    </div>
                    <div className="fare-feature">
                      <span className={`fare-feature-icon ${fare.changeable ? 'fare-feature-yes' : 'fare-feature-no'}`}>
                        {fare.changeable ? '✓' : '✕'}
                      </span>
                      {fare.changeable ? 'Được đổi lịch (có phí)' : 'Không áp dụng đổi lịch'}
                    </div>
                    <div className="fare-feature">
                      <span className={`fare-feature-icon ${fare.refundable ? 'fare-feature-yes' : 'fare-feature-no'}`}>
                        {fare.refundable ? '✓' : '✕'}
                      </span>
                      {fare.refundable ? 'Được hoàn vé' : 'Không hoàn vé'}
                    </div>
                  </div>
                  <div className="fare-note">{fare.note}</div>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              {selectedFare && (
                <div className="modal-footer-price">
                  Tổng ({passengerCount} khách)
                  <strong>{(Number(selectedFare.price) * passengerCount).toLocaleString('vi-VN')} đ</strong>
                </div>
              )}
              <button className="btn btn-primary" disabled={!selectedFareId} onClick={() => setStep('seat')}>
                Tiếp tục →
              </button>
            </div>
          </>
        )}

        {/* BƯỚC 2: Chọn ghế — chọn đúng số lượng passengerCount */}
        {step === 'seat' && (
          <>
            <div className="booking-banner" style={{ background: '#eef4ff', borderColor: '#0071eb' }}>
              Chọn <strong>{passengerCount}</strong> ghế — đã chọn{' '}
              <strong>{myBookings.length}/{passengerCount}</strong>
              {myBookings.length > 0 && (
                <>
                  {' '}— còn <strong>{countdown}s</strong>
                </>
              )}
            </div>

            <div className="cabin-wrapper">
              <div className="cabin-nose" />
              {rowNumbers.map((rowNum) => (
                <div className="cabin-row" key={rowNum}>
                  <div className="cabin-row-number">{rowNum}</div>
                  {LEFT_COLS.map((col) => {
                    const seat = seatsByRow[rowNum][col];
                    const isMine = seat && myBookings.some((b) => b.seat.id === seat.id);
                    return (
                      <button
                        key={col}
                        className={`cabin-seat ${getSeatClass(seat)}`}
                        onClick={() => seat && handleSeatClick(seat)}
                        disabled={!seat || (seat.status !== 'available' && !isMine)}
                        title={seat?.seatNumber}
                      >
                        {col}
                      </button>
                    );
                  })}
                  <div className="cabin-aisle-gap" />
                  {RIGHT_COLS.map((col) => {
                    const seat = seatsByRow[rowNum][col];
                    const isMine = seat && myBookings.some((b) => b.seat.id === seat.id);
                    return (
                      <button
                        key={col}
                        className={`cabin-seat ${getSeatClass(seat)}`}
                        onClick={() => seat && handleSeatClick(seat)}
                        disabled={!seat || (seat.status !== 'available' && !isMine)}
                        title={seat?.seatNumber}
                      >
                        {col}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="cabin-legend">
              <span><span className="cabin-legend-dot" style={{ background: '#12a150' }}></span>Trống</span>
              <span><span className="cabin-legend-dot" style={{ background: '#0071eb' }}></span>Ghế của bạn (bấm để bỏ chọn)</span>
              <span><span className="cabin-legend-dot" style={{ background: '#f5a623' }}></span>Đang giữ</span>
              <span><span className="cabin-legend-dot" style={{ background: '#b0b8c1' }}></span>Đã đặt</span>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStep('fare')}>← Quay lại</button>
              <button
                className="btn btn-primary"
                disabled={myBookings.length !== passengerCount}
                onClick={() => setStep('passenger')}
              >
                Tiếp tục →
              </button>
            </div>
          </>
        )}

        {/* BƯỚC 3: Thông tin từng hành khách — 1 form / ghế */}
        {step === 'passenger' && (
          <>
            <div className="booking-banner">
              Còn <strong>{countdown}s</strong> để hoàn tất thông tin
            </div>
            <form onSubmit={handleSubmitPassenger}>
              {myBookings.map((b, idx) => (
                <div key={b.id} className="card" style={{ marginBottom: 14 }}>
                  <div className="fare-name" style={{ marginBottom: 10 }}>
                    Hành khách {idx + 1} — Ghế {b.seat.seatNumber}
                  </div>
                  <input
                    className="form-input"
                    placeholder="Họ và tên (theo CCCD/Hộ chiếu)"
                    value={passengers[b.id]?.name || ''}
                    onChange={(e) => updatePassenger(b.id, 'name', e.target.value)}
                  />
                  <input
                    className="form-input"
                    placeholder="Số điện thoại"
                    value={passengers[b.id]?.phone || ''}
                    onChange={(e) => updatePassenger(b.id, 'phone', e.target.value)}
                  />
                </div>
              ))}
              <div className="modal-footer" style={{ position: 'static' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setStep('seat')}>
                  ← Quay lại
                </button>
                <button type="submit" className="btn btn-primary">Tiếp tục →</button>
              </div>
            </form>
          </>
        )}

        {/* BƯỚC 4: Thanh toán */}
        {step === 'payment' && (
          <>
            <div className="booking-banner">
              Còn <strong>{countdown}s</strong> để hoàn tất thanh toán
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              {myBookings.map((b, idx) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    paddingBottom: 8,
                    borderBottom: idx < myBookings.length - 1 ? '1px dashed #eef2f7' : 'none',
                  }}
                >
                  <span>
                    {passengers[b.id]?.name} — Ghế {b.seat.seatNumber}
                  </span>
                  <strong>{Number(selectedFare?.price).toLocaleString('vi-VN')} đ</strong>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #eef2f7' }}>
                <span>Tổng thanh toán ({myBookings.length} khách)</span>
                <strong style={{ color: '#0071eb', fontSize: 18 }}>
                  {totalPrice.toLocaleString('vi-VN')} đ
                </strong>
              </div>
            </div>

            <div className="fare-name" style={{ marginBottom: 10 }}>Phương thức thanh toán</div>
            {[
              { id: 'card', label: '💳 Thẻ tín dụng / ghi nợ' },
              { id: 'momo', label: '📱 Ví MoMo' },
              { id: 'zalopay', label: '🔵 ZaloPay' },
            ].map((m) => (
              <label
                key={m.id}
                className="fare-card"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: '14px 16px',
                  marginBottom: 10,
                  cursor: 'pointer',
                  borderColor: paymentMethod === m.id ? '#0071eb' : '#eef2f7',
                }}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === m.id}
                  onChange={() => setPaymentMethod(m.id)}
                  style={{ marginRight: 10 }}
                />
                {m.label}
              </label>
            ))}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStep('passenger')}>← Quay lại</button>
              <button className="btn btn-primary" disabled={submitting} onClick={handlePay}>
                {submitting ? 'Đang xử lý...' : `Thanh toán ${totalPrice.toLocaleString('vi-VN')} đ`}
              </button>
            </div>
          </>
        )}

        {/* BƯỚC 5: Thành công */}
        {step === 'success' && confirmedBookings.length > 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h3 style={{ marginBottom: 6 }}>Đặt {confirmedBookings.length} vé thành công!</h3>
            <p style={{ color: '#6b7280', marginBottom: 24 }}>
              Mã đặt chỗ: <strong style={{ color: '#0071eb' }}>{confirmedBookings[0].bookingCode}</strong>
              {' '}(dùng chung cho tất cả hành khách)
            </p>

            <div className="card" style={{ maxWidth: 420, margin: '0 auto', textAlign: 'left' }}>
              <div className="fare-header-route" style={{ marginBottom: 12 }}>
                <span className="flight-code-badge">{flight.flightCode}</span>
                <span>{flight.departureCity} → {flight.arrivalCity}</span>
              </div>
              {confirmedBookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    fontSize: 14,
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f2f5',
                  }}
                >
                  <strong>{b.passengerName}</strong> — Ghế {b.seat.seatNumber}
                </div>
              ))}
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 10 }}>
                Khởi hành: {dep.time} · {dep.date}
              </div>
            </div>

            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => onDone()}>
              Xong
            </button>
          </div>
        )}
      </div>
    </div>
  );
}