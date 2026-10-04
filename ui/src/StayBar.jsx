import React from 'react';
import { dateIn } from './api.js';

const nextDay = (d) => {
  const x = new Date(`${d}T00:00:00`);
  x.setDate(x.getDate() + 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

export default function StayBar({ stay, setStay, compact = false }) {
  const set = (k) => (e) => {
    const next = { ...stay, [k]: e.target.value };
    if (k === 'checkIn' && next.checkOut <= next.checkIn) next.checkOut = nextDay(next.checkIn);
    setStay(next);
  };
  return (
    <div className={`staybar ${compact ? 'compact' : ''}`}>
      <label><span>Check in</span><input type="date" min={dateIn(0)} value={stay.checkIn} onChange={set('checkIn')} /></label>
      <label><span>Check out</span><input type="date" min={nextDay(stay.checkIn)} value={stay.checkOut} onChange={set('checkOut')} /></label>
      <label><span>Rooms</span>
        <select value={stay.rooms || 1} onChange={set('rooms')}>{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <label><span>Adults</span>
        <select value={stay.adults} onChange={set('adults')}>{Array.from({ length: 18 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <label><span>Children</span>
        <select value={stay.children} onChange={set('children')}>{Array.from({ length: 9 }, (_, i) => i).map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
    </div>
  );
}
