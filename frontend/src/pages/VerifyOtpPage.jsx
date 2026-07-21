import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function VerifyOtpPage() {
  const [searchParams] = useSearchParams();
  const emailFromUrl = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailFromUrl);
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (emailFromUrl) handleSendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSendOtp = async () => {
    setError('');
    setMessage('');
    try {
      await sendOtp(email);
      setMessage('Đã gửi OTP — xem console log của backend để lấy mã');
    } catch (err) {
      setError(err.response?.data?.message || 'Gửi OTP thất bại');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await verifyOtp(email, otp);
      setMessage('Xác thực thành công! Đang chuyển tới đăng nhập...');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP không đúng');
    }
  };

  return (
    <div className="page-container">
      <div className="auth-container">
        <div className="card">
          <div className="auth-title">🔐 Xác thực OTP</div>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, textAlign: 'center' }}>
            Bản demo — mã OTP hiện ở console log backend, không gửi email thật
          </p>
          <form onSubmit={handleVerify}>
            <input
              className="form-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="form-input"
              type="text"
              placeholder="Mã OTP 6 số"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
            />
            {message && <p className="success-text">{message}</p>}
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }} type="submit">
              Xác thực
            </button>
            <button
              className="btn btn-secondary"
              style={{ width: '100%' }}
              type="button"
              onClick={handleSendOtp}
            >
              Gửi lại OTP
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}