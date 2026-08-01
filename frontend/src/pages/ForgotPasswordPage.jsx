import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/client';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState('request'); // request | reset
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiClient.post('/auth/forgot-password', { email });
      setMessage(res.data.message);
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiClient.post('/auth/reset-password', { email, resetCode, newPassword });
      setMessage('Đặt lại mật khẩu thành công! Đang chuyển tới đăng nhập...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  return (
    <div className="page-container">
      <div className="auth-container">
        <div className="card">
          <div className="auth-title">🔑 Quên mật khẩu</div>

          {step === 'request' && (
            <form onSubmit={handleRequestCode}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                Nhập email đã đăng ký, chúng tôi sẽ gửi mã xác nhận để đặt lại mật khẩu.
              </p>
              <input
                className="form-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && <p className="error-text">{error}</p>}
              {message && <p className="success-text">{message}</p>}
              <button className="btn btn-primary" style={{ width: '100%' }} type="submit">
                Gửi mã xác nhận
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                Nhập mã 6 số vừa nhận được và mật khẩu mới.
              </p>
              <input
                className="form-input"
                type="text"
                placeholder="Mã xác nhận 6 số"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value)}
                maxLength={6}
                required
              />
              <input
                className="form-input"
                type="password"
                placeholder="Mật khẩu mới"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              {error && <p className="error-text">{error}</p>}
              {message && <p className="success-text">{message}</p>}
              <button className="btn btn-primary" style={{ width: '100%' }} type="submit">
                Đặt lại mật khẩu
              </button>
            </form>
          )}

          <div className="auth-link">
            <Link to="/login">← Quay lại đăng nhập</Link>
          </div>
        </div>
      </div>
    </div>
  );
}