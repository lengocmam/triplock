import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyOtpPage from './pages/VerifyOtpPage';
import FlightListPage from './pages/FlightListPage';
import SeatSelectionPage from './pages/SeatSelectionPage';
import { useAuth } from './context/AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route
        path="/flights"
        element={user ? <FlightListPage /> : <Navigate to="/login" />}
      />
      <Route
        path="/flights/:flightId/seats"
        element={user ? <SeatSelectionPage /> : <Navigate to="/login" />}
      />
      <Route path="/" element={<Navigate to="/flights" />} />
    </Routes>
  );
}

export default App;