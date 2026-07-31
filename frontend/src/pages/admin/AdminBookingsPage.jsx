import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import * as XLSX from 'xlsx';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadBookings = (p) => {
    setLoading(true);
    apiClient
      .get(`/admin/bookings?page=${p}&limit=20`)
      .then((res) => {
        setBookings(res.data.items);
        setTotalPages(res.data.totalPages);
        setTotalCount(res.data.totalCount);
        setPage(res.data.page);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings(1);
  }, []);

  const exportExcel = () => {
    const data = bookings.map((b) => ({
      'Mã đặt chỗ': b.bookingCode,
      'Hành khách': b.passengerName,
      'Chuyến bay': `${b.seat.flight.flightCode}: ${b.seat.flight.departureCity} → ${b.seat.flight.arrivalCity}`,
      'Ghế': b.seat.seatNumber,
      'Hạng vé': b.fareClass.name,
      'Giá': Number(b.fareClass.price),
      'Mã giao dịch': b.payment?.transactionCode || '',
      'Ngày đặt': new Date(b.createdAt).toLocaleString('vi-VN'),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bookings');
    XLSX.writeFile(wb, `bao-cao-dat-ve-trang${page}-${Date.now()}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Đơn đặt vé ({totalCount.toLocaleString('vi-VN')} tổng)</h2>
        <button className="btn btn-secondary" onClick={exportExcel}>📥 Xuất Excel (trang hiện tại)</button>
      </div>

      <div className="admin-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}>Đang tải...</div>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã đặt chỗ</th>
                  <th>Hành khách</th>
                  <th>Chuyến bay</th>
                  <th>Ghế</th>
                  <th>Hạng vé</th>
                  <th>Mã giao dịch</th>
                  <th>Thời gian</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td><strong>{b.bookingCode}</strong></td>
                    <td>{b.passengerName}</td>
                    <td>{b.seat.flight.flightCode}: {b.seat.flight.departureCity} → {b.seat.flight.arrivalCity}</td>
                    <td>{b.seat.seatNumber}</td>
                    <td>{b.fareClass.name}</td>
                    <td>{b.payment?.transactionCode || '—'}</td>
                    <td>{new Date(b.createdAt).toLocaleString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => loadBookings(page - 1)}>
                ← Trước
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Trang {page} / {totalPages}
              </span>
              <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => loadBookings(page + 1)}>
                Sau →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}