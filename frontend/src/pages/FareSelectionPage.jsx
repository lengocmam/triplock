import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Navbar from '../components/Navbar';

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return {
    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }),
  };
}

function airportCode(city) {
  // Lấy 3 ký tự đầu viết hoa làm mã sân bay giả lập, chỉ để hiển thị
  return city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3).toUpperCase();
}

export default function FareSelectionPage() {
  const { flightId } = useParams();
  const navigate = useNavigate();

  const [flight, setFlight] = useState(null);
  const [fares, setFares] = useState([]);
  const [selectedFareId, setSelectedFareId] = useState(null);

  useEffect(() => {
    apiClient.get(`/flights/${flightId}`).then((res) => setFlight(res.data));
    apiClient.get(`/flights/${flightId}/fares`).then((res) => setFares(res.data));
  }, [flightId]);

  const handleContinue = () => {
    if (!selectedFareId) return;
    navigate(`/flights/${flightId}/seats?fareClassId=${selectedFareId}`);
  };

  if (!flight || fares.length === 0) {
    return (
      <div className="page-container">
        <Navbar />
        <div style={{ textAlign: 'center', padding: 60 }}>Đang tải...</div>
      </div>
    );
  }

  const dep = formatDateTime(flight.departureTime);
  const arr = formatDateTime(flight.arrivalTime);
  const durationMin = Math.round(
    (new Date(flight.arrivalTime) - new Date(flight.departureTime)) / 60000,
  );
  const durationText = `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`;

  return (
    <div className="page-container">
      <Navbar />

      <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 24px' }}>
        <h2 style={{ marginBottom: 16 }}>Chọn loại vé</h2>

        <div className="fare-header-card">
          <div className="fare-header-route">
            <span className="flight-code-badge">{flight.flightCode}</span>
            <span>
              {flight.departureCity} → {flight.arrivalCity}
            </span>
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

        <div className="fare-grid">
          {fares.map((fare) => (
            <div
              key={fare.id}
              className={`fare-card ${selectedFareId === fare.id ? 'fare-selected' : ''}`}
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
                  <span
                    className={`fare-feature-icon ${
                      fare.checkedBaggageKg > 0 ? 'fare-feature-yes' : 'fare-feature-no'
                    }`}
                  >
                    {fare.checkedBaggageKg > 0 ? '✓' : '✕'}
                  </span>
                  {fare.checkedBaggageKg > 0
                    ? `Hành lý ký gửi ${fare.checkedBaggageKg}kg`
                    : 'Không có hành lý ký gửi'}
                </div>
                <div className="fare-feature">
                  <span
                    className={`fare-feature-icon ${
                      fare.changeable ? 'fare-feature-yes' : 'fare-feature-no'
                    }`}
                  >
                    {fare.changeable ? '✓' : '✕'}
                  </span>
                  {fare.changeable ? 'Được đổi lịch (có phí)' : 'Không áp dụng đổi lịch'}
                </div>
                <div className="fare-feature">
                  <span
                    className={`fare-feature-icon ${
                      fare.refundable ? 'fare-feature-yes' : 'fare-feature-no'
                    }`}
                  >
                    {fare.refundable ? '✓' : '✕'}
                  </span>
                  {fare.refundable ? 'Được hoàn vé' : 'Không hoàn vé'}
                </div>
              </div>

              <div className="fare-note">{fare.note}</div>

              <button
                className={`btn ${selectedFareId === fare.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedFareId(fare.id)}
              >
                {selectedFareId === fare.id ? 'Đã chọn' : 'Chọn'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button
            className="btn btn-primary"
            style={{ padding: '12px 32px', fontSize: 15 }}
            disabled={!selectedFareId}
            onClick={handleContinue}
          >
            Tiếp tục chọn ghế →
          </button>
        </div>
      </div>
    </div>
  );
}