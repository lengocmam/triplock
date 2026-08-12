export default function SkyHero() {
  return (
    <div className="sky-hero">
      {/* Mây trôi nhiều lớp tạo chiều sâu */}
      <div className="cloud cloud-1" />
      <div className="cloud cloud-2" />
      <div className="cloud cloud-3" />

      {/* Đường bay chấm chấm mờ làm bối cảnh */}
      <svg className="flight-path-line" viewBox="0 0 1000 300" preserveAspectRatio="none">
        <path
          d="M -50 200 C 150 60, 400 30, 500 40 C 650 55, 850 130, 1050 170"
          fill="none"
          stroke="#0071eb"
          strokeWidth="1.5"
          strokeDasharray="6 8"
        />
      </svg>

      {/* Máy bay bay động theo đường cong */}
      <span className="flying-plane">✈️</span>
      <span className="flying-plane plane-2">✈️</span>

      <div className="sky-hero-content">
        <div className="sky-hero-title">Tìm & đặt vé máy bay nhanh chóng</div>
        <div className="sky-hero-subtitle">Đặt chỗ real-time — ghế được giữ ngay khi bạn chọn ✈️</div>
      </div>
    </div>
  );
}