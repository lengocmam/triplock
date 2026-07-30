import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { useToast } from '../../context/ToastContext';

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const emptyForm = {
  flightCode: '',
  departureCity: '',
  arrivalCity: '',
  departureDate: '',
  departureHour: '08:00',
  durationHours: 2,
  price: '',
  seatCount: 24,
};

export default function AdminFlightsPage() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();
  const [editingFlight, setEditingFlight] = useState(null);
  const [editFares, setEditFares] = useState([]);

  const loadFlights = () => {
    setLoading(true);
    apiClient.get('/admin/flights').then((res) => setFlights(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFlights();
  }, []);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.flightCode || !form.departureCity || !form.arrivalCity || !form.departureDate || !form.price) {
      addToast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const departureTime = new Date(`${form.departureDate}T${form.departureHour}:00`);
      const arrivalTime = new Date(departureTime.getTime() + Number(form.durationHours) * 60 * 60 * 1000);

      await apiClient.post('/admin/flights', {
        flightCode: form.flightCode,
        departureCity: form.departureCity,
        arrivalCity: form.arrivalCity,
        departureTime,
        arrivalTime,
        price: Number(form.price),
        seatCount: Number(form.seatCount),
      });

      addToast('Đã thêm chuyến bay mới', 'success');
      setForm(emptyForm);
      setShowForm(false);
      loadFlights();
    } catch (err) {
      addToast(err.response?.data?.message || 'Thêm chuyến bay thất bại', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const openEdit = async (flight) => {
    setEditingFlight({ ...flight });
    const res = await apiClient.get(`/admin/flights/${flight.id}/fares`);
    setEditFares(res.data);
    };

    const saveFlightEdit = async () => {
    try {
        await apiClient.put(`/admin/flights/${editingFlight.id}`, {
        flightCode: editingFlight.flightCode,
        departureCity: editingFlight.departureCity,
        arrivalCity: editingFlight.arrivalCity,
        price: Number(editingFlight.price),
        });
        for (const fare of editFares) {
        await apiClient.put(`/admin/fare-classes/${fare.id}`, { price: Number(fare.price) });
        }
        addToast('Đã cập nhật chuyến bay', 'success');
        setEditingFlight(null);
        loadFlights();
    } catch (err) {
        addToast(err.response?.data?.message || 'Cập nhật thất bại', 'error');
    }
    };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Xóa chuyến bay ${code}? Hành động này không thể hoàn tác.`)) return;
    try {
      await apiClient.delete(`/admin/flights/${id}`);
      addToast('Đã xóa chuyến bay', 'success');
      loadFlights();
    } catch (err) {
      addToast(err.response?.data?.message || 'Xóa thất bại', 'error');
    }
  };

  const occupancyBadge = (rate) => {
    if (rate >= 80) return 'admin-badge-bad';
    if (rate >= 40) return 'admin-badge-warn';
    return 'admin-badge-good';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Quản lý chuyến bay</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Đóng' : '+ Thêm chuyến bay'}
        </button>
      </div>
        {editingFlight && (
            <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEditingFlight(null)}>
                <div className="modal-drawer" style={{ maxWidth: 480 }}>
                <div className="modal-header">
                    <div className="modal-title">Sửa chuyến bay {editingFlight.flightCode}</div>
                    <button className="modal-close-btn" onClick={() => setEditingFlight(null)}>✕</button>
                </div>

                <label className="search-field-label">Mã chuyến bay</label>
                <input className="form-input" value={editingFlight.flightCode}
                    onChange={(e) => setEditingFlight({ ...editingFlight, flightCode: e.target.value })} />

                <label className="search-field-label">Điểm đi</label>
                <input className="form-input" value={editingFlight.departureCity}
                    onChange={(e) => setEditingFlight({ ...editingFlight, departureCity: e.target.value })} />

                <label className="search-field-label">Điểm đến</label>
                <input className="form-input" value={editingFlight.arrivalCity}
                    onChange={(e) => setEditingFlight({ ...editingFlight, arrivalCity: e.target.value })} />

                <label className="search-field-label">Giá vé cơ bản (đ)</label>
                <input className="form-input" type="number" value={editingFlight.price}
                    onChange={(e) => setEditingFlight({ ...editingFlight, price: e.target.value })} />

                <div className="admin-panel-title" style={{ marginTop: 16 }}>Giá từng hạng vé</div>
                {editFares.map((fare, idx) => (
                    <div key={fare.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ minWidth: 140, fontSize: 13 }}>{fare.name}</span>
                    <input
                        className="form-input"
                        style={{ marginBottom: 0 }}
                        type="number"
                        value={fare.price}
                        onChange={(e) => {
                        const updated = [...editFares];
                        updated[idx].price = e.target.value;
                        setEditFares(updated);
                        }}
                    />
                    </div>
                ))}

                <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={saveFlightEdit}>
                    Lưu thay đổi
                </button>
                </div>
            </div>
            )}
      {showForm && (
        <div className="admin-panel">
          <div className="admin-panel-title">Thêm chuyến bay mới</div>
          <form onSubmit={handleSubmit}>
            <div className="admin-form-grid">
              <div>
                <label className="search-field-label">Mã chuyến bay</label>
                <input className="form-input" placeholder="VD: VN789" value={form.flightCode}
                  onChange={(e) => handleChange('flightCode', e.target.value)} />
              </div>
              <div>
                <label className="search-field-label">Giá vé cơ bản (đ)</label>
                <input className="form-input" type="number" placeholder="1500000" value={form.price}
                  onChange={(e) => handleChange('price', e.target.value)} />
              </div>
              <div>
                <label className="search-field-label">Điểm đi</label>
                <input className="form-input" placeholder="Hà Nội" value={form.departureCity}
                  onChange={(e) => handleChange('departureCity', e.target.value)} />
              </div>
              <div>
                <label className="search-field-label">Điểm đến</label>
                <input className="form-input" placeholder="Đà Nẵng" value={form.arrivalCity}
                  onChange={(e) => handleChange('arrivalCity', e.target.value)} />
              </div>
              <div>
                <label className="search-field-label">Ngày khởi hành</label>
                <input className="form-input" type="date" value={form.departureDate}
                  onChange={(e) => handleChange('departureDate', e.target.value)} />
              </div>
              <div>
                <label className="search-field-label">Giờ khởi hành</label>
                <input className="form-input" type="time" value={form.departureHour}
                  onChange={(e) => handleChange('departureHour', e.target.value)} />
              </div>
              <div>
                <label className="search-field-label">Thời gian bay (giờ)</label>
                <input className="form-input" type="number" step="0.5" value={form.durationHours}
                  onChange={(e) => handleChange('durationHours', e.target.value)} />
              </div>
              <div>
                <label className="search-field-label">Số ghế</label>
                <input className="form-input" type="number" value={form.seatCount}
                  onChange={(e) => handleChange('seatCount', e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={submitting} style={{ marginTop: 10 }}>
              {submitting ? 'Đang tạo...' : 'Tạo chuyến bay'}
            </button>
          </form>
        </div>
      )}

      <div className="admin-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}>Đang tải...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã chuyến</th>
                <th>Tuyến bay</th>
                <th>Khởi hành</th>
                <th>Giá vé</th>
                <th>Lấp đầy</th>
                <th>Doanh thu</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f) => (
                <tr key={f.id}>
                  <td><strong>{f.flightCode}</strong></td>
                  <td>{f.departureCity} → {f.arrivalCity}</td>
                  <td>{formatDateTime(f.departureTime)}</td>
                  <td>{Number(f.price).toLocaleString('vi-VN')} đ</td>
                  <td>
                    <span className={`admin-badge ${occupancyBadge(f.occupancyRate)}`}>
                      {f.bookedSeats}/{f.totalSeats} ({f.occupancyRate}%)
                    </span>
                  </td>
                  <td>{Number(f.revenue).toLocaleString('vi-VN')} đ</td>
                  <td>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12, marginRight: 6 }}
                        onClick={() => openEdit(f)}>
                        Sửa
                    </button>
                    <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => handleDelete(f.id, f.flightCode)}>
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}