import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyOtpPage from './pages/VerifyOtpPage';
import FlightListPage from './pages/FlightListPage';
import MyBookingsPage from './pages/MyBookingsPage';
import NotFoundPage from './pages/NotFoundPage';
import { useAuth } from './context/AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/flights" element={user ? <FlightListPage /> : <Navigate to="/login" />} />
      <Route path="/my-bookings" element={user ? <MyBookingsPage /> : <Navigate to="/login" />} />
      <Route path="/" element={<Navigate to="/flights" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;