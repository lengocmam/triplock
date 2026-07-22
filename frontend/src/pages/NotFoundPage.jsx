import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: 'center', padding: '100px 20px' }}>
      <div style={{ fontSize: 64, marginBottom: 12 }}>🧭</div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>404 - Không tìm thấy trang</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>
        Trang bạn tìm không tồn tại hoặc đã bị di chuyển.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/flights')}>
        Về trang chủ
      </button>
    </div>
  );
}