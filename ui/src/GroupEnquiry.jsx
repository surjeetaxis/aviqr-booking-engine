import React, { useEffect, useState } from 'react';
import { api, dateIn } from './api.js';

const EVENTS = [['WEDDING', 'Wedding'], ['CORPORATE', 'Corporate stay'], ['CONFERENCE', 'Conference or offsite'], ['TOUR', 'Tour group'], ['SPORTS', 'Sports team'], ['OTHER', 'Something else']];
const CODES = ['+91', '+1', '+44', '+971', '+65', '+61', '+49', '+33'];

/** Request a quote for more rooms than online checkout takes, or for an event. */
export default function GroupEnquiry({ hotelId, stay, navigate, backPath }) {
  const [hotel, setHotel] = useState(null);
  const [form, setForm] = useState({
    organizerName: '', code: '+91', phone: '', organizerEmail: '', company: '', eventType: 'WEDDING',
    checkInDate: stay.checkIn || dateIn(30), checkOutDate: stay.checkOut || dateIn(32), rooms: Math.max(10, Number(stay.rooms) || 10), guests: '', message: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    window.scrollTo(0, 0);
    api.property(hotelId).then(setHotel).catch(() => setHotel({ name: 'the hotel' }));
  }, [hotelId]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.groupEnquiry(hotelId, {
        organizerName: form.organizerName.trim(), organizerPhone: `${form.code} ${form.phone.trim()}`,
        organizerEmail: form.organizerEmail.trim() || null, company: form.company.trim() || null, eventType: form.eventType,
        checkInDate: form.checkInDate, checkOutDate: form.checkOutDate, rooms: Number(form.rooms),
        guests: form.guests ? Number(form.guests) : null, message: form.message.trim() || null,
      });
      setSent(r);
    } catch (err) {
      setError(err.message && err.message !== 'Request failed' ? err.message : "The enquiry couldn't be sent. Please try again or call the hotel.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="checkout-page">
        <div className="confirm-page">
          <div className="check">✓</div>
          <span className="eyebrow">ENQUIRY SENT</span>
          <h1>{hotel?.name} will send you a quote</h1>
          <p className="muted">Your request for {form.rooms} rooms is with the hotel's team{form.organizerEmail ? `, and a copy is on its way to ${form.organizerEmail}` : ''}. Most hotels reply within a day.</p>
          <div className="ref"><span>ENQUIRY</span><b>{sent.reference}</b></div>
          <div className="row-actions"><button className="primary" onClick={() => navigate(backPath)}>Back to the hotel</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-grid">
        <div className="co-main">
          <button className="crumb-link" onClick={() => navigate(backPath)}>← Back to rooms</button>
          <form className="co-card" onSubmit={submit}>
            <div className="co-card-head">Request a group quote{hotel?.name ? ` · ${hotel.name}` : ''}</div>
            <div className="co-card-body form-grid">
              <p className="muted small full">For 10 or more rooms, weddings, offsites and tour groups. The hotel replies with rates and availability; nothing is booked or charged yet.</p>
              <label className="field">Event<select value={form.eventType} onChange={set('eventType')}>{EVENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="field">Company or family name <small>(optional)</small><input maxLength={120} value={form.company} onChange={set('company')} /></label>
              <label className="field">Check-in *<input type="date" required min={dateIn(0)} value={form.checkInDate} onChange={set('checkInDate')} /></label>
              <label className="field">Check-out *<input type="date" required min={form.checkInDate} value={form.checkOutDate} onChange={set('checkOutDate')} /></label>
              <label className="field">Rooms *<input type="number" required min={1} max={500} value={form.rooms} onChange={set('rooms')} /></label>
              <label className="field">Guests <small>(optional)</small><input type="number" min={1} max={2000} value={form.guests} onChange={set('guests')} /></label>
              <label className="field full">Your name *<input required maxLength={120} autoComplete="name" value={form.organizerName} onChange={set('organizerName')} /></label>
              <label className="field">Mobile number *
                <span className="phone">
                  <select value={form.code} onChange={set('code')} aria-label="Country code">{CODES.map((c) => <option key={c}>{c}</option>)}</select>
                  <input required type="tel" maxLength={18} pattern="[0-9() .\-]{6,18}" autoComplete="tel-national" value={form.phone} onChange={set('phone')} />
                </span>
              </label>
              <label className="field">Email<input type="email" maxLength={254} autoComplete="email" value={form.organizerEmail} onChange={set('organizerEmail')} placeholder="For your copy and the quote" /></label>
              <label className="field full">Anything else <small>(optional)</small>
                <textarea rows={4} maxLength={1000} value={form.message} onChange={set('message')} placeholder="Room mix, event space, meals, budget…" />
              </label>
              {error && <p className="note warn full">{error}</p>}
              <div className="full"><button className="primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send enquiry'}</button></div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
