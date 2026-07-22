import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';
import FareSelectionModal from '../components/FareSelectionModal';
import BookingDrawer from '../components/BookingDrawer';
import FlightCardSkeleton from '../components/FlightCardSkeleton';
import { useDebounce } from '../hooks/useDebounce';
function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const PROMOS = [
  { icon: '💳', title: 'Giảm 200K', desc: 'Thanh toán qua thẻ tín dụng' },
  { icon: '🎁', title: 'Ưu đãi mới', desc: 'Tài khoản lần đầu đặt vé' },
  { icon: '⚡', title: 'Giữ chỗ nhanh', desc: 'Ghế khóa real-time 5 phút' },
];

export default function FlightListPage() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [departureCity, setDepartureCity] = useState('');
  const [arrivalCity, setArrivalCity] = useState('');
  const [date, setDate] = useState('');

  // State điều khiển modal chọn vé — thay cho việc điều hướng route
  const [selectedFlightId, setSelectedFlightId] = useState(null);

  const handleBookingDone = () => {
    setSelectedFlightId(null);
    fetchFlights({ departureCity, arrivalCity, date }); // load lại để cập nhật ghế đã đặt
  };

  const navigate = useNavigate();

  const debouncedDeparture = useDebounce(departureCity);
  const debouncedArrival = useDebounce(arrivalCity);

  const fetchFlights = async (filters = {}) => {
    setLoading(true);
    try {
      const params = {};
      if (filters.departureCity) params.departureCity = filters.departureCity;
      if (filters.arrivalCity) params.arrivalCity = filters.arrivalCity;
      if (filters.date) params.date = filters.date;

      const res = await apiClient.get('/flights', { params });
      setFlights(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlights({ departureCity: debouncedDeparture, arrivalCity: debouncedArrival, date });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDeparture, debouncedArrival, date]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchFlights({ departureCity, arrivalCity, date });
  };

  const handleReset = () => {
    setDepartureCity('');
    setArrivalCity('');
    setDate('');
    fetchFlights();
  };

  const uniqueDestinations = [
    ...new Map(flights.map((f) => [f.arrivalCity, f])).values(),
  ].slice(0, 5);

  const handleQuickSelect = (city) => {
    setArrivalCity(city);
    fetchFlights({ departureCity, arrivalCity: city, date });
  };

  // Sau khi chọn hạng vé trong modal, mới điều hướng sang trang chọn ghế
  const handleFareContinue = (fareClassId) => {
    navigate(`/flights/${selectedFlightId}/seats?fareClassId=${fareClassId}`);
  };

  return (
    <div className="page-container">
      <Navbar />

      <div className="hero-banner">
        <div className="hero-title">Tìm & đặt vé máy bay nhanh chóng</div>
        <div className="hero-subtitle">Đặt chỗ real-time — ghế được giữ ngay khi bạn chọn</div>
      </div>

      <div className="search-bar-card">
        <form className="search-bar-inner" onSubmit={handleSearch}>
          <div className="search-field">
            <label className="search-field-label">Điểm đi</label>
            <input
              className="search-field-input"
              placeholder="VD: Hà Nội"
              value={departureCity}
              onChange={(e) => setDepartureCity(e.target.value)}
            />
          </div>
          <div className="search-field">
            <label className="search-field-label">Điểm đến</label>
            <input
              className="search-field-input"
              placeholder="VD: Đà Nẵng"
              value={arrivalCity}
              onChange={(e) => setArrivalCity(e.target.value)}
            />
          </div>
          <div className="search-field">
            <label className="search-field-label">Ngày khởi hành</label>
            <input
              className="search-field-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" style={{ height: 42 }} type="submit">
            Tìm chuyến bay
          </button>
          {(departureCity || arrivalCity || date) && (
            <button
              className="btn btn-secondary"
              style={{ height: 42 }}
              type="button"
              onClick={handleReset}
            >
              Xóa lọc
            </button>
          )}
        </form>
      </div>

      <div className="promo-strip" style={{ marginTop: 32 }}>
        {PROMOS.map((p, i) => (
          <div key={i} className="promo-chip">
            <div className="promo-icon">{p.icon}</div>
            <div className="promo-text">
              <strong>{p.title}</strong>
              {p.desc}
            </div>
          </div>
        ))}
      </div>

      {uniqueDestinations.length > 0 && (
        <>
          <div className="section-title">Điểm đến có chuyến bay</div>
          <div className="section-subtitle">Bấm vào để lọc nhanh theo điểm đến</div>
          <div className="destination-grid">
            {uniqueDestinations.map((f) => (
              <div
                key={f.arrivalCity}
                className="destination-card"
                onClick={() => handleQuickSelect(f.arrivalCity)}
              >
                <div className="destination-info" style={{ padding: 16 }}>
                  <div className="destination-name">{f.arrivalCity}</div>
                  <div className="destination-price">
                    từ {Number(f.price).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">Chuyến bay sẵn có</div>
      <div className="section-subtitle">
        {loading ? 'Đang tìm kiếm...' : `${flights.length} chuyến bay phù hợp`}
      </div>

      <div className="flight-list">
        {loading && <FlightCardSkeleton />}

        {!loading && flights.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: '#6b7280' }}>
            Không tìm thấy chuyến bay phù hợp với bộ lọc.
          </div>
        )}

        {flights.map((flight) => (
          <div key={flight.id} className="flight-card">
            <div className="flight-route">
              <div className="flight-code-badge">{flight.flightCode}</div>
              <div>
                <div className="flight-cities">
                  {flight.departureCity} → {flight.arrivalCity}
                </div>
                <div className="flight-time">
                  Khởi hành: {formatTime(flight.departureTime)} · Đến:{' '}
                  {formatTime(flight.arrivalTime)}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div className="flight-price">
                <div className="flight-price-label">Giá vé</div>
                {Number(flight.price).toLocaleString('vi-VN')} đ
              </div>
              {/* Bấm vào đây giờ MỞ MODAL, không điều hướng route */}
              <button
                className="btn btn-primary"
                onClick={() => setSelectedFlightId(flight.id)}
              >
                Chọn ghế
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 40 }} />

      {/* Modal chỉ render khi có flight được chọn */}
      {selectedFlightId && (
          <BookingDrawer
            flightId={selectedFlightId}
            onClose={() => setSelectedFlightId(null)}
            onDone={handleBookingDone}
          />
        )}
    </div>
  );
}