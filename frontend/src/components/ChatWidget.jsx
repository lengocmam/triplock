import { useState, useRef, useEffect } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';

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

  // Load lịch sử hội thoại thật từ DB ngay khi mở chat lần đầu -- đây là "bộ nhớ" thật
  useEffect(() => {
    if (open && !historyLoaded) {
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
  }, [open, historyLoaded]);

  if (!user) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const res = await apiClient.post('/ai-chat/message', { message: text });
      setMessages((prev) => [...prev, { role: 'model', text: res.data.reply }]);
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
    setMessages([
      { role: 'model', text: 'Đã xóa lịch sử. Mình có thể giúp gì cho bạn?' },
    ]);
  };

  return (
    <>
      {open && (
        <div className="chat-window">
          <div className="chat-header">
            <span>🤖 Trợ lý AI TripLock</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleClearHistory}
                title="Xóa lịch sử"
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 13 }}
              >
                🗑️
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="chat-typing">
                <span /><span /><span />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="chat-input-row" onSubmit={handleSend}>
            <input
              placeholder="Nhập câu hỏi..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
            />
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