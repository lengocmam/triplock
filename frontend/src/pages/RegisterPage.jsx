import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(email, password, fullName);
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
    }
  };

  return (
    <div className="page-container">
      <div className="auth-container">
        <div className="card">
          <div className="auth-title">✈️ Tạo tài khoản</div>
          <form onSubmit={handleSubmit}>
            <input
              className="form-input"
              type="text"
              placeholder="Họ tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              className="form-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="form-input"
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="error-text">{error}</p>}
            <button className="btn btn-primary" style={{ width: '100%' }} type="submit">
              Đăng ký
            </button>
          </form>
          <div className="auth-link">
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </div>
        </div>
      </div>
    </div>
  );
}