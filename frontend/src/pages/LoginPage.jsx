import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/flights');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    }
  };

  return (
    <div className="page-container">
      <div className="auth-container">
        <div className="card">
          <div className="auth-title">✈️ Đăng nhập TripLock</div>
          <form onSubmit={handleSubmit}>
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
              Đăng nhập
            </button>
          </form>
          <div className="auth-link">
            Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
          </div>
        </div>
      </div>
    </div>
  );
}