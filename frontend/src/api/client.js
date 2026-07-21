import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
});

// Tự động đính kèm JWT token vào mọi request nếu đã đăng nhập
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
