import React, { useState } from 'react';
import { api } from './api.js';

/** Open a booking's voucher on any device with the reference and the phone it was booked with. */
export default function FindBooking({ navigate }) {
  const [form, setForm] = useState({ reference: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const found = await api.findBooking(form.reference.trim(), form.phone.trim());
      navigate(`/voucher/${found.hotelId}/${found.reservationId}/${found.voucherToken}`);
    } catch {
      setError('No booking matches that reference and phone. Check both, or contact the hotel.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow find-page">
      <span className="eyebrow">MANAGE A BOOKING</span>
      <h1>Find my booking</h1>
      <p className="muted">Enter the reference from your confirmation and the mobile number you booked with.</p>
      <form className="co-card" onSubmit={submit}>
        <div className="co-card-body form-grid">
          <label className="field">Booking reference<input required value={form.reference} maxLength={8} pattern="[0-9A-Fa-f]{8}" placeholder="e.g. C967920C"
            onChange={(e) => setForm({ ...form, reference: e.target.value.toUpperCase() })} autoComplete="off" /></label>
          <label className="field">Mobile number<input required type="tel" value={form.phone} maxLength={20} placeholder="98765 43210"
            onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></label>
          {error && <p className="note warn full">{error}</p>}
          <button className="primary full" disabled={busy}>{busy ? 'Looking…' : 'Show my voucher'}</button>
        </div>
      </form>
    </div>
  );
}
