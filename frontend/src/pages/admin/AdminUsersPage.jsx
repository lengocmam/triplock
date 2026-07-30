import { useEffect, useState } from 'react';
import apiClient from '../../api/client';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/users').then((res) => setUsers(res.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Người dùng</h2>
      <div className="admin-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}>Đang tải...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Xác thực</th>
                <th>Vai trò</th>
                <th>Ngày tạo</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`admin-badge ${u.isVerified ? 'admin-badge-good' : 'admin-badge-warn'}`}>
                      {u.isVerified ? 'Đã xác thực' : 'Chưa xác thực'}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${u.role === 'admin' ? 'admin-badge-bad' : 'admin-badge-good'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}