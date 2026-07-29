import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import apiClient from '../api/client';

export default function QrPayment({ bookingIds, amount, onSuccess, onError }) {
  const [qrData, setQrData] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | waiting | scanning | success
  const [countdown, setCountdown] = useState(300);
  const countdownRef = useRef(null);

  useEffect(() => {
    apiClient
      .post('/bookings/create-qr-payment', { bookingIds })
      .then((res) => {
        setQrData(res.data);
        setStatus('waiting');
      })
      .catch((err) => onError?.(err.response?.data?.message || 'Không thể tạo mã QR'));
  }, [bookingIds]);

  useEffect(() => {
    if (status !== 'waiting') return;
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [status]);

  const formatCountdown = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Mô phỏng việc "đã quét & xác nhận trên app ngân hàng/ví điện tử"
  const handleSimulateScan = () => {
    setStatus('scanning');
    // Giả lập độ trễ xử lý giống thanh toán thật (1.5s) để cảm giác chân thực hơn
    setTimeout(() => {
      setStatus('success');
      setTimeout(() => onSuccess(qrData.sessionId), 600);
    }, 1500);
  };

  if (status === 'loading') {
    return <div style={{ textAlign: 'center', padding: 40 }}>Đang tạo mã QR...</div>;
  }

  return (
    <div className="qr-payment-box">
      {status === 'waiting' && (
        <>
          <div className="qr-amount">
            {amount.toLocaleString('vi-VN')} <span>đ</span>
          </div>
          <div className="qr-code-wrapper">
            <QRCodeSVG value={qrData.qrContent} size={200} level="M" />
          </div>
          <p className="qr-instruction">
            Mở app ngân hàng hoặc ví điện tử, quét mã để thanh toán
          </p>
          <div className="qr-countdown">
            Mã hết hạn sau <strong>{formatCountdown(countdown)}</strong>
          </div>

          {/* Nút mô phỏng — vì đây là demo không có app quét thật, bấm nút này để giả lập "đã quét xong" */}
          <button className="btn btn-primary qr-simulate-btn" onClick={handleSimulateScan}>
            📱 Mô phỏng: Đã quét & thanh toán
          </button>
          <p className="qr-demo-note">
            (Nút này chỉ phục vụ demo — trong thực tế bước này diễn ra tự động khi app ngân hàng xác nhận giao dịch)
          </p>
        </>
      )}

      {status === 'scanning' && (
        <div className="qr-processing">
          <div className="qr-spinner" />
          <p>Đang xác nhận giao dịch...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="qr-success">
          <div className="qr-success-icon">✅</div>
          <p>Thanh toán thành công!</p>
        </div>
      )}
    </div>
  );
}