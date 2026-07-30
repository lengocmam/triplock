import { NavLink, Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const MENU = [
  { path: '/admin', label: '📊 Tổng quan', end: true },
  { path: '/admin/flights', label: '✈️ Quản lý chuyến bay' },
  { path: '/admin/bookings', label: '🎫 Đơn đặt vé' },
  { path: '/admin/users', label: '👥 Người dùng' },
];

export default function AdminLayout() {
  return (
    <div className="page-container">
      <Navbar />
      <div className="admin-layout">
        <div className="admin-sidebar">
          {MENU.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) => `admin-sidebar-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}