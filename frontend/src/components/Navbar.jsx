import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="navbar">
      <div className="navbar-logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/flights')}>
        ✈️ TripLock
      </div>
      <div className="navbar-actions">
        {user ? (
          <>
            <button className="btn btn-secondary" onClick={() => navigate('/my-bookings')}>
              Vé của tôi
            </button>
            <span>{user.fullName}</span>
            <button className="btn btn-secondary" onClick={handleLogout}>
              Đăng xuất
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            Đăng nhập
          </button>
        )}
      </div>
    </div>
  );
}