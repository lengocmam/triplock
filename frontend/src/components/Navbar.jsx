import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNav = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="navbar">
      <div className="navbar-logo" style={{ cursor: 'pointer' }} onClick={() => handleNav('/flights')}>
        ✈️ TripLock
      </div>

      {/* Menu desktop */}
      <div className="navbar-actions navbar-desktop-only">
        <button className="theme-toggle-btn" onClick={toggleTheme} title="Đổi giao diện sáng/tối">
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        {user ? (
          <>
            <button className="btn btn-secondary" onClick={() => handleNav('/my-bookings')}>
              Vé của tôi
            </button>
            <span className="navbar-username">{user.fullName}</span>
            <button className="btn btn-secondary" onClick={handleLogout}>
              Đăng xuất
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={() => handleNav('/login')}>
            Đăng nhập
          </button>
        )}
      </div>

      {/* Nút hamburger — chỉ hiện trên mobile */}
      <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? '✕' : '☰'}
      </button>

      {/* Menu mobile trượt xuống */}
      {menuOpen && (
        <div className="mobile-menu">
          <button className="mobile-menu-item" onClick={toggleTheme}>
            {theme === 'light' ? '🌙 Giao diện tối' : '☀️ Giao diện sáng'}
          </button>
          {user ? (
            <>
              <button className="mobile-menu-item" onClick={() => handleNav('/flights')}>
                ✈️ Tìm chuyến bay
              </button>
              <button className="mobile-menu-item" onClick={() => handleNav('/my-bookings')}>
                🎫 Vé của tôi
              </button>
              <button className="mobile-menu-item mobile-menu-danger" onClick={handleLogout}>
                🚪 Đăng xuất ({user.fullName})
              </button>
            </>
          ) : (
            <button className="mobile-menu-item" onClick={() => handleNav('/login')}>
              Đăng nhập
            </button>
          )}
        </div>
      )}
    </div>
  );
}