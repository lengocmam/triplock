import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Lỗi runtime bị chặn bởi ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h2>Đã có lỗi xảy ra</h2>
          <p style={{ color: '#6b7280', marginBottom: 20 }}>
            Vui lòng tải lại trang. Nếu lỗi tiếp diễn, hãy liên hệ hỗ trợ.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}