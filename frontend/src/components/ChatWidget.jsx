import { useState, useRef, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

function FlightCard({ f }) {
  return (
    <div className="chat-flight-card">
      <div className="chat-flight-card-route">
        {f.flightCode}: {f.departureCity} → {f.arrivalCity}
      </div>
      <div className="chat-flight-card-meta">
        <span>{new Date(f.departureTime).toLocaleString('vi-VN')}</span>
        <span>{Number(f.price).toLocaleString('vi-VN')}đ</span>
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open && !historyLoaded) {
      if (!user) {
        // Khách vãng lai: không có lịch sử lưu DB, chỉ hiện lời chào
        setMessages([
          { role: 'model', text: 'Xin chào! Mình là trợ lý AI của TripLock ✈️ Bạn có thể hỏi mình về chuyến bay ngay, không cần đăng nhập!' },
        ]);
        setHistoryLoaded(true);
        return;
      }
      apiClient.get('/ai-chat/history').then((res) => {
        if (res.data.length === 0) {
          setMessages([
            { role: 'model', text: 'Xin chào! Mình là trợ lý AI của TripLock ✈️ Bạn cần tìm chuyến bay nào?' },
          ]);
        } else {
          setMessages(res.data);
        }
        setHistoryLoaded(true);
      });
    }
  }, [open, historyLoaded, user]);


  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post('/ai-chat/message', { message: text });
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: res.data.reply,
          suggestedFlights: res.data.suggestedFlights,
          needsHumanSupport: res.data.needsHumanSupport,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: err.response?.data?.message || 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Xóa toàn bộ lịch sử trò chuyện?')) return;
    await apiClient.delete('/ai-chat/history');
    setMessages([{ role: 'model', text: 'Đã xóa lịch sử. Mình có thể giúp gì cho bạn?' }]);
  };

  return (
    <>
      {open && (
        <div className="chat-window">
          <div className="chat-header">
            <span>🤖 Trợ lý AI TripLock</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {user && (
                <button onClick={handleClearHistory} title="Xóa lịch sử" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 13 }}>🗑️</button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`} style={{ maxWidth: '90%' }}>
                {m.text}
                {m.suggestedFlights?.map((f, idx) => <FlightCard key={idx} f={f} />)}
                {m.needsHumanSupport && (
                  <div className="chat-escalation-banner">
                    🙋 Yêu cầu này cần nhân viên hỗ trợ trực tiếp. Vui lòng liên hệ support@triplock.demo
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-typing"><span /><span /><span /></div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-row" onSubmit={handleSend}>
            <input placeholder="Nhập câu hỏi..." value={input} onChange={(e) => setInput(e.target.value)} disabled={loading} />
            <button type="submit" disabled={loading || !input.trim()}>➤</button>
          </form>
        </div>
      )}

      <button className="chat-bubble-btn" onClick={() => setOpen(!open)}>
        {open ? '✕' : '💬'}
      </button>
    </>
  );
}