import React, { useEffect, useState } from 'react';
import { api, money, nights, prettyDate } from './api.js';
import Scene, { stayTheme } from './Scene.jsx';

export default function Trips({ stays, navigate }) {
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    document.title = 'My trips';
    api.trips().then(setTrips).catch(() => { setTrips([]); setError(true); });
  }, []);
  const byId = new Map(stays.map((s) => [s.id, s]));
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (trips || []).filter((t) => t.checkOut >= today);
  const past = (trips || []).filter((t) => t.checkOut < today);

  const row = (t) => {
    const p = byId.get(t.hotelId) || { name: 'Your stay', city: '' };
    return (
      <article key={t.bookingId} className="trip" onClick={() => navigate(`/stay/${t.hotelId}`)}>
        <Scene seed={t.hotelId} theme={stayTheme(p)} />
        <div>
          <span className="where">{p.city}</span>
          <h3>{p.name}</h3>
          <p>{prettyDate(t.checkIn)} – {prettyDate(t.checkOut)} · {nights(t.checkIn, t.checkOut)} nights · {t.roomCount > 1 ? `${t.roomCount} rooms · ` : ''}{t.adults + (t.children || 0)} guests</p>
        </div>
        <div className="trip-side">
          <span className="ok">Confirmed</span>
          {(t.grandTotal ?? t.totalBeforeTax) != null && <b>{money(t.grandTotal ?? t.totalBeforeTax, t.currency || 'INR')}</b>}
          <small>Ref {String(t.reservationId || t.bookingId).slice(0, 8).toUpperCase()}</small>
        </div>
      </article>
    );
  };

  return (
    <div className="page narrow">
      <span className="eyebrow">YOUR BOOKINGS</span>
      <h1>My trips</h1>
      <p className="muted">Bookings made from this browser. The hotel's PMS holds the full reservation.</p>
      {trips == null ? <div className="page-msg"><div className="spinner" /></div>
        : error ? <div className="banner warn">Trips are unavailable right now.</div>
        : trips.length === 0 ? (
          <div className="empty-card"><b>No trips yet.</b><p>When you book a stay it will appear here.</p><button className="primary" onClick={() => navigate('/')}>Find a stay</button></div>
        ) : (
          <>
            {upcoming.length > 0 && <><h2 className="sub">Upcoming</h2>{upcoming.map(row)}</>}
            {past.length > 0 && <><h2 className="sub">Past</h2>{past.map(row)}</>}
          </>
        )}
    </div>
  );
}
