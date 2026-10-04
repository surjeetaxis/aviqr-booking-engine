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
      <label><span>Adults</span>
        <select value={stay.adults} onChange={set('adults')}>{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <label><span>Children</span>
        <select value={stay.children} onChange={set('children')}>{[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
    </div>
  );
}
