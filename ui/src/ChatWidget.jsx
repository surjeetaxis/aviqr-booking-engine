import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

/** Plain text with https links made clickable; nothing else from the reply is rendered as HTML. */
function Linked({ text }) {
  const parts = text.split(/(https:\/\/[^\s<>()"']+)/g);
  return parts.map((p, i) => (p.startsWith('https://') ? <a key={i} href={p.replace(/[.,!?)]+$/, '')} target="_top" rel="noopener">{p}</a> : <React.Fragment key={i}>{p}</React.Fragment>));
}

const KEY = (hotelId) => `aviqr-chat-${hotelId}`;

/** The hotel's booking assistant and WhatsApp button, when the hotel turns them on. */
export default function ChatWidget({ hotelId, hotelName }) {
  const [info, setInfo] = useState(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(KEY(hotelId))) || []; } catch { return []; }
  });
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const end = useRef(null);

  useEffect(() => {
    let live = true;
    api.assistant(hotelId).then((x) => live && setInfo(x)).catch(() => {});
    return () => { live = false; };
  }, [hotelId]);
  useEffect(() => {
    try { sessionStorage.setItem(KEY(hotelId), JSON.stringify(messages.slice(-40))); } catch { /* storage unavailable */ }
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages, open, hotelId]);

  if (!info || (!info.chatEnabled && !info.whatsappNumber)) return null;

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setDraft('');
    setBusy(true);
    setError('');
    try {
      const r = await api.chat(hotelId, next.slice(-20));
      setMessages([...next, { role: 'assistant', text: r.reply }]);
    } catch (err) {
      setError(err.status === 429 ? err.message : "The assistant couldn't answer just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const wa = info.whatsappNumber ? `https://wa.me/${info.whatsappNumber}?text=${encodeURIComponent(`Hi ${hotelName || ''}, I'd like to book a stay.`)}` : null;

  return (
    <div className="chat-dock">
      {open && info.chatEnabled && (
        <section className="chat-panel" aria-label="Booking assistant">
          <header><b>Ask {hotelName || 'the hotel'}</b><button type="button" onClick={() => setOpen(false)} aria-label="Close chat">×</button></header>
          <div className="chat-log" aria-live="polite">
            {messages.length === 0 && <p className="chat-msg assistant">Hi! Ask me about rooms, prices for your dates, breakfast, cancellation or anything about your stay.</p>}
            {messages.map((m, i) => <p key={i} className={`chat-msg ${m.role}`}><Linked text={m.text} /></p>)}
            {busy && <p className="chat-msg assistant typing">…</p>}
            {error && <p className="chat-error">{error}</p>}
            <div ref={end} />
          </div>
          <form onSubmit={send}>
            <input value={draft} maxLength={1000} onChange={(e) => setDraft(e.target.value)} placeholder="Type your question" aria-label="Your message" />
            <button type="submit" className="primary" disabled={busy || !draft.trim()}>Send</button>
          </form>
          <small className="chat-note">An AI assistant with the hotel's live rates. It can't book for you; it'll send a booking link.</small>
        </section>
      )}
      <div className="chat-buttons">
        {wa && <a className="chat-fab wa" href={wa} target="_blank" rel="noopener" aria-label="Chat on WhatsApp">WhatsApp</a>}
        {info.chatEnabled && <button type="button" className="chat-fab" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Close' : 'Chat with us'}</button>}
      </div>
    </div>
  );
}
