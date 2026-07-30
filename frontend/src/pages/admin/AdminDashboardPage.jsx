import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import apiClient from '../../api/client';

const COLORS = ['#0071eb', '#12a150', '#f5a623', '#d9364f', '#9b59b6'];

function formatMoney(n) {
  return Number(n).toLocaleString('vi-VN') + ' đ';
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [revenueChart, setRevenueChart] = useState([]);
  const [topRoutes, setTopRoutes] = useState([]);
  const [fareBreakdown, setFareBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get('/admin/dashboard-stats'),
      apiClient.get('/admin/revenue-chart'),
      apiClient.get('/admin/top-routes'),
      apiClient.get('/admin/fare-class-breakdown'),
    ])
      .then(([s, r, t, f]) => {
        setStats(s.data);
        setRevenueChart(
          r.data.map((d) => ({
            ...d,
            label: new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
          })),
        );
        setTopRoutes(t.data);
        setFareBreakdown(f.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}>Đang tải dữ liệu...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Tổng quan doanh thu</h2>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-label">Tổng doanh thu (thực thu)</div>
          <div className="stat-card-value stat-positive">{formatMoney(stats.netRevenue)}</div>
          <div className="stat-card-sub">Đã trừ hoàn tiền: {formatMoney(stats.totalRefunded)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Doanh thu hôm nay</div>
          <div className="stat-card-value">{formatMoney(stats.todayRevenue)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Tổng số vé đã bán</div>
          <div className="stat-card-value">{stats.totalBookings}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Tỷ lệ lấp đầy ghế</div>
          <div className="stat-card-value">{stats.occupancyRate}%</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Tổng người dùng</div>
          <div className="stat-card-value">{stats.totalUsers}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Tổng chuyến bay</div>
          <div className="stat-card-value">{stats.totalFlights}</div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-title">Doanh thu 14 ngày gần nhất</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={revenueChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip formatter={(value) => formatMoney(value)} />
            <Line type="monotone" dataKey="revenue" stroke="#0071eb" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
        <div className="admin-panel">
          <div className="admin-panel-title">Top 5 tuyến bay doanh thu cao nhất</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={topRoutes} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1000}k`} />
              <YAxis type="category" dataKey="route" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(value) => formatMoney(value)} />
              <Bar dataKey="revenue" fill="#0071eb" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-title">Tỷ lệ hạng vé được mua</div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={fareBreakdown} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {fareBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}