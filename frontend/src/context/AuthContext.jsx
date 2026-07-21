import { createContext, useContext, useState } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (email, password) => {
    const res = await apiClient.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, password, fullName) => {
    const res = await apiClient.post('/auth/register', { email, password, fullName });
    return res.data;
  };

  const sendOtp = async (email) => {
    return apiClient.post('/auth/send-otp', { email });
  };

  const verifyOtp = async (email, otp) => {
    const res = await apiClient.post('/auth/verify-otp', { email, otp });
    // Cập nhật lại trạng thái isVerified trong user hiện tại
    if (user) {
      const updated = { ...user, isVerified: true };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, sendOtp, verifyOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}