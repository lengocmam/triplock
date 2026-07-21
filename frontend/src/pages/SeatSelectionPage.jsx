import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import { useSocket } from '../hooks/useSocket';
import Navbar from '../components/Navbar';

export default function SeatSelectionPage() {
  const { flightId } = useParams();
  const [searchParams] = useSearchParams();
  const fareClassId = searchParams.get('fareClassId');
  const navigate = useNavigate();
  const socketRef = useSocket();

  const [flight, setFlight] = useState(null);
  const [seats, setSeats] = useState([]);
  const [myBooking, setMyBooking] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const countdownRef = useRef(null);

  useEffect(() => {
    if (!fareClassId) {
      navigate(`/flights/${flightId}/fares`);
    }
  }, [fareClassId, flightId, navigate]);

  useEffect(() => {
    apiClient.get(`/flights/${flightId}`).then((res) => {
      setFlight(res.data);
      setSeats(res.data.seats);
    });
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

  useEffect(() => {
    if (!myBooking) return;
    const expiresAt = new Date(myBooking.lockExpiresAt).getTime();

    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        setMyBooking(null);
        setError('Đã hết thời gian giữ chỗ, vui lòng chọn lại');
      }
    }, 1000);

    return () => clearInterval(countdownRef.current);
  }, [myBooking]);

  const handleSelectSeat = async (seat) => {
    if (seat.status !== 'available' || myBooking || !fareClassId) return;
    setError('');
    try {
      const res = await apiClient.post(`/bookings/lock-seat/${seat.id}`, { fareClassId });
      setMyBooking(res.data);
      setSeats((prev) => prev.map((s) => (s.id === seat.id ? { ...s, status: 'locked' } : s)));
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể giữ ghế này');
    }
  };

  const handleConfirm = async () => {
    if (!myBooking) return;
    try {
      await apiClient.post(`/bookings/confirm/${myBooking.id}`);
      alert('Đặt vé thành công!');
      navigate('/flights');
    } catch (err) {
      setError(err.response?.data?.message || 'Xác nhận thất bại');
    }
  };

  const handleCancel = async () => {
    if (!myBooking) return;
    await apiClient.post(`/bookings/cancel/${myBooking.id}`);
    setSeats((prev) =>
      prev.map((s) => (s.id === myBooking.seat.id ? { ...s, status: 'available' } : s)),
    );
    setMyBooking(null);
  };

  if (!flight) {
    return (
      <div className="page-container">
        <Navbar />
        <div style={{ textAlign: 'center', padding: 60 }}>Đang tải...</div>
      </div>
    );
  }

  // Nhóm ghế theo số hàng (1, 2, 3...) để render đúng sơ đồ khoang máy bay
  const seatsByRow = {};
  seats.forEach((seat) => {
    const rowNum = parseInt(seat.seatNumber);
    if (!seatsByRow[rowNum]) seatsByRow[rowNum] = {};
    const letter = seat.seatNumber.replace(String(rowNum), '');
    seatsByRow[rowNum][letter] = seat;
  });
  const rowNumbers = Object.keys(seatsByRow).map(Number).sort((a, b) => a - b);
  const LEFT_COLS = ['A', 'B', 'C'];
  const RIGHT_COLS = ['D', 'E', 'F'];

  const getSeatClass = (seat) => {
    if (!seat) return '';
    if (myBooking?.seat?.id === seat.id) return 'seat-mine';
    return `seat-${seat.status}`;
  };

  return (
    <div className="page-container">
      <Navbar />

      <div style={{ maxWidth: 600, margin: '30px auto', padding: '0 24px' }}>
        <div className="card">
          <h2 style={{ marginBottom: 4 }}>
            {flight.flightCode}: {flight.departureCity} → {flight.arrivalCity}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 20 }}>Chọn ghế ngồi</p>

          {error && <p className="error-text">{error}</p>}

          {myBooking && (
            <div className="booking-banner">
              Bạn đang giữ ghế <strong>{myBooking.seat.seatNumber}</strong> — còn{' '}
              <strong>{countdown}s</strong> để xác nhận
              <div className="booking-banner-actions">
                <button className="btn btn-primary" onClick={handleConfirm}>
                  Xác nhận đặt vé
                </button>
                <button className="btn btn-secondary" onClick={handleCancel}>
                  Hủy giữ chỗ
                </button>
              </div>
            </div>
          )}

          <div className="cabin-wrapper">
            <div className="cabin-nose" />

            {rowNumbers.map((rowNum) => (
              <div className="cabin-row" key={rowNum}>
                <div className="cabin-row-number">{rowNum}</div>

                {LEFT_COLS.map((col) => {
                  const seat = seatsByRow[rowNum][col];
                  return (
                    <button
                      key={col}
                      className={`cabin-seat ${getSeatClass(seat)}`}
                      onClick={() => seat && handleSelectSeat(seat)}
                      disabled={!seat || seat.status !== 'available'}
                      title={seat?.seatNumber}
                    >
                      {col}
                    </button>
                  );
                })}

                <div className="cabin-aisle-gap" />

                {RIGHT_COLS.map((col) => {
                  const seat = seatsByRow[rowNum][col];
                  return (
                    <button
                      key={col}
                      className={`cabin-seat ${getSeatClass(seat)}`}
                      onClick={() => seat && handleSelectSeat(seat)}
                      disabled={!seat || seat.status !== 'available'}
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
            <span><span className="cabin-legend-dot" style={{ background: '#0071eb' }}></span>Ghế của bạn</span>
            <span><span className="cabin-legend-dot" style={{ background: '#f5a623' }}></span>Đang giữ</span>
            <span><span className="cabin-legend-dot" style={{ background: '#b0b8c1' }}></span>Đã đặt</span>
          </div>
        </div>
      </div>
    </div>
  );
}