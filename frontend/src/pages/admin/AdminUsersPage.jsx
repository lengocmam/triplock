import { useEffect, useState } from 'react';
import apiClient from '../../api/client';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadUsers = (p) => {
    setLoading(true);
    apiClient
      .get(`/admin/users?page=${p}&limit=20`)
      .then((res) => {
        setUsers(res.data.items);
        setTotalPages(res.data.totalPages);
        setTotalCount(res.data.totalCount);
        setPage(res.data.page);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers(1);
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Người dùng ({totalCount.toLocaleString('vi-VN')} tổng)</h2>
      <div className="admin-panel">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}>Đang tải...</div>
        ) : (
          <>
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

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => loadUsers(page - 1)}>
                ← Trước
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Trang {page} / {totalPages}
              </span>
              <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => loadUsers(page + 1)}>
                Sau →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}