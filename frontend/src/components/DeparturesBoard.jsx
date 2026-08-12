import { useEffect, useState } from 'react';

function airportCode(city) {
  return city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 3).toUpperCase();
}

export default function DeparturesBoard({ flights }) {
  const [now, setNow] = useState(new Date());
  const [visibleRows, setVisibleRows] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Lấy 6 chuyến gần nhất, hiển thị dạng bảng bay -- dữ liệu thật, không giả lập
    setVisibleRows(flights.slice(0, 6));
  }, [flights]);

  return (
    <div className="departures-board">
      <div className="board-header">
        <span className="board-title">✈ Lịch bay hôm nay · TripLock</span>
        <span className="board-clock">
          {now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      <div className="board-rows">
        {visibleRows.length === 0 && (
          <div className="board-empty">— Chưa có dữ liệu chuyến bay —</div>
        )}
        {visibleRows.map((f, i) => {
          const isSoon = new Date(f.departureTime).getTime() - now.getTime() < 3 * 60 * 60 * 1000;
          return (
            <div className="board-row" key={f.id} style={{ animationDelay: `${i * 60}ms` }}>
              <span className="board-code board-flap" style={{ animationDelay: `${i * 60 + 100}ms` }}>
                {f.flightCode}
              </span>
              <span className="board-route board-flap" style={{ animationDelay: `${i * 60 + 150}ms` }}>
                {airportCode(f.departureCity)}
                <span className="arrow">→</span>
                {airportCode(f.arrivalCity)}
              </span>
              <span className="board-time board-flap" style={{ animationDelay: `${i * 60 + 200}ms` }}>
                {new Date(f.departureTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={`board-status ${isSoon ? 'boarding' : 'open'} board-flap`} style={{ animationDelay: `${i * 60 + 250}ms` }}>
                {isSoon ? 'Sắp bay' : 'Mở bán'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}