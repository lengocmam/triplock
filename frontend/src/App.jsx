import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyOtpPage from './pages/VerifyOtpPage';
import FlightListPage from './pages/FlightListPage';
import MyBookingsPage from './pages/MyBookingsPage';
import ActivityLogPage from './pages/ActivityLogPage';
import NotFoundPage from './pages/NotFoundPage';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminFlightsPage from './pages/admin/AdminFlightsPage';
import AdminBookingsPage from './pages/admin/AdminBookingsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import { useAuth } from './context/AuthContext';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ChatWidget from './components/ChatWidget';

function App() {
  const { user } = useAuth();

  return (
    <>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/flights" element={<FlightListPage />} />
      <Route path="/my-bookings" element={user ? <MyBookingsPage /> : <Navigate to="/login" />} />
      <Route path="/activity" element={user ? <ActivityLogPage /> : <Navigate to="/login" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="flights" element={<AdminFlightsPage />} />
        <Route path="bookings" element={<AdminBookingsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/flights" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    <ChatWidget />
    </>
  );
}

export default App;