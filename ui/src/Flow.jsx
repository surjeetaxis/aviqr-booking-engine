import React, { useState } from 'react';
import { nights, prettyDate } from './api.js';
import StayBar from './StayBar.jsx';

const STEPS = ['Search', 'Rooms', 'Add-ons', 'Guest details', 'Confirmed'];

/** Booking progress: 0 Search … 4 Confirmed. Earlier steps can be revisited through onStep. */
export function Stepper({ current, onStep, skip = [] }) {
  return (
    <nav className="stepper" aria-label="Booking progress">
      {STEPS.map((label, i) => {
        if (skip.includes(i)) return null;
        const state = i < current ? 'done' : i === current ? 'now' : 'next';
        const clickable = onStep && i < current && current < 4;
        return (
          <button key={label} type="button" className={`step ${state}`} disabled={!clickable} aria-current={state === 'now' ? 'step' : undefined}
            onClick={() => clickable && onStep(i)}>
            <i>{state === 'done' ? '✓' : i + 1 - skip.filter((s) => s < i).length}</i>{label}
          </button>
        );
      })}
    </nav>
  );
}

export function StaySummary({ hotel, stay, setStay, editable = true }) {
  const [editing, setEditing] = useState(false);
  const rooms = Number(stay.rooms || 1);
  const guests = Number(stay.adults) + Number(stay.children || 0);
  const n = nights(stay.checkIn, stay.checkOut);
  return (
    <div className="stay-summary">
      <div className="ss-line">
        <span>{hotel?.name}</span>
        <span>{prettyDate(stay.checkIn)} – {prettyDate(stay.checkOut)}</span>
        <span>{n} night{n === 1 ? '' : 's'}</span>
        <span>{rooms} room{rooms === 1 ? '' : 's'}</span>
        <span>{guests} guest{guests === 1 ? '' : 's'}</span>
        {editable && <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing}>{editing ? 'Done' : 'Modify'}</button>}
      </div>
      {editing && <div className="ss-edit"><StayBar stay={stay} setStay={setStay} /></div>}
    </div>
  );
}
