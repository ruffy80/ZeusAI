import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Salut! Sunt asistentul Zeus AI 🦄 Cum te pot ajuta cu business automation, AI, blockchain sau plăți?' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = async (e) => {
    e && e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await axios.post('/api/chat', { message: text, history: newMessages.slice(-8) });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Conexiune temporar indisponibilă. Încearcă din nou.' }]);
    } finally {
      setLoading(false);
    }
  };

  const panelStyle = { position: 'fixed', right: 16, bottom: 70, width: 340, maxHeight: 460, display: 'flex', flexDirection: 'column', zIndex: 61, background: 'rgba(10,18,38,.97)', border: '1px solid rgba(34,211,238,.35)', borderRadius: 20, boxShadow: '0 8px 40px rgba(0,0,0,.7)', overflow: 'hidden' };
  const headerStyle = { padding: '14px 16px', background: 'linear-gradient(90deg,rgba(34,211,238,.15),rgba(168,85,247,.15))', borderBottom: '1px solid rgba(34,211,238,.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const msgAreaStyle = { flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 };
  const inputAreaStyle = { padding: '10px 14px', borderTop: '1px solid rgba(148,163,184,.15)', display: 'flex', gap: 8 };
  const inputStyle = { flex: 1, padding: '9px 14px', borderRadius: 12, border: '1px solid rgba(34,211,238,.25)', background: 'rgba(2,6,23,.7)', color: '#f8fafc', fontSize: 14, outline: 'none' };
  const btnSendStyle = { padding: '9px 16px', borderRadius: 12, border: 0, background: 'linear-gradient(90deg,#22d3ee,#a855f7)', color: '#020617', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontSize: 16 };

  const bubbleUser = { alignSelf: 'flex-end', background: 'linear-gradient(135deg,#22d3ee22,#a855f722)', border: '1px solid rgba(34,211,238,.2)', borderRadius: '16px 16px 4px 16px', padding: '8px 14px', color: '#e2e8f0', fontSize: 14, maxWidth: '85%', wordBreak: 'break-word' };
  const bubbleBot = { alignSelf: 'flex-start', background: 'rgba(2,6,23,.6)', border: '1px solid rgba(148,163,184,.15)', borderRadius: '16px 16px 16px 4px', padding: '8px 14px', color: '#cbd5e1', fontSize: 14, maxWidth: '85%', wordBreak: 'break-word' };

  return (
    <>
      {open && (
        <div style={panelStyle}>
          <div style={headerStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ fontWeight: 700, color: '#22d3ee', fontSize: 14 }}>Zeus AI Assistant</div>
                <div style={{ color: '#34d399', fontSize: 11 }}>● Online</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>✕</button>
          </div>

          <div style={msgAreaStyle}>
            {messages.map((m, i) => (
              <div key={i} style={m.role === 'user' ? bubbleUser : bubbleBot}>
                {m.role === 'assistant' && <span style={{ fontSize: 12, marginRight: 4 }}>🦄</span>}
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ ...bubbleBot, color: '#64748b' }}>
                <span style={{ fontSize: 12, marginRight: 4 }}>🦄</span>Se gândește...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={sendMessage} style={inputAreaStyle}>
            <input
              style={inputStyle}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Scrie un mesaj..."
              disabled={loading}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(e); }}
            />
            <button type="submit" style={btnSendStyle} disabled={loading}>↑</button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 60, width: 52, height: 52, borderRadius: '50%', border: 0, background: 'linear-gradient(135deg,#22d3ee,#a855f7)', color: '#020617', fontSize: 22, cursor: 'pointer', boxShadow: '0 4px 20px rgba(34,211,238,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title="Zeus AI Chat"
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  );
}
