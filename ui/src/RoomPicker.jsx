import React, { useMemo, useState } from 'react';
import { hasMedia, tourLabel, withTypeMedia } from './RoomTour.jsx';

const floorName = (f) => (f == null || f === '' ? 'Rooms' : /^\d+$/.test(String(f)) ? `Floor ${f}` : String(f));
const uniq = (xs) => [...new Set(xs.filter(Boolean))];

/** PMS room map: shows every unit as available or booked (no room numbers or guest data) and lets the guest pick one. */
export default function RoomPicker({ rooms, takenIds = [], selectedId, onSelect, onPreview }) {
  const [side, setSide] = useState('');
  const [view, setView] = useState('');
  const sides = useMemo(() => uniq(rooms.map((r) => r.side)), [rooms]);
  const views = useMemo(() => uniq(rooms.map((r) => r.view)), [rooms]);
  const floors = useMemo(() => {
    const by = new Map();
    rooms.forEach((r) => {
      const k = floorName(r.floor);
      by.set(k, [...(by.get(k) || []), r]);
    });
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rooms]);
  const free = rooms.filter((r) => r.availabilityStatus === 'AVAILABLE' && !takenIds.includes(r.roomId));
  const matches = (r) => (!side || r.side === side) && (!view || r.view === view);
  const chosen = rooms.find((r) => r.roomId === selectedId);

  return (
    <div className="picker">
      <div className="picker-head">
        <div>
          <b>Choose your exact room</b>
          <span>{free.length} of {rooms.length} rooms open for your dates</span>
        </div>
        <div className="legend">
          <span><i className="dot free" /> Available</span>
          <span><i className="dot booked" /> Booked</span>
          <span><i className="dot chosen" /> Your pick</span>
          {takenIds.length > 0 && <span><i className="dot taken" /> In your booking</span>}
        </div>
      </div>
      {(sides.length > 1 || views.length > 1) && (
        <div className="chips">
          {sides.length > 1 && (
            <>
              <button className={!side ? 'on' : ''} onClick={() => setSide('')}>Any side</button>
              {sides.map((s) => <button key={s} className={side === s ? 'on' : ''} onClick={() => setSide(s)}>{s}</button>)}
            </>
          )}
          {views.length > 1 && (
            <>
              <i className="chip-sep" />
              <button className={!view ? 'on' : ''} onClick={() => setView('')}>Any view</button>
              {views.map((v) => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v}</button>)}
            </>
          )}
        </div>
      )}
      <div className="floors">
        {floors.map(([name, list]) => (
          <FloorPlan key={name} name={name} rooms={list} sides={sides} takenIds={takenIds} selectedId={selectedId} matches={matches} onSelect={onSelect} />
        ))}
      </div>
      {chosen ? (
        <div className="pick-card">
          <div>
            <span className="eyebrow">YOUR ROOM</span>
            <b>{[floorName(chosen.floor), chosen.side, chosen.view].filter(Boolean).join(' · ')}</b>
            <small>The hotel shares the room number at check-in. This exact room is reserved for you when you book.</small>
          </div>
          <button className="ghost" onClick={() => onPreview(chosen)}>◉ {tourLabel(withTypeMedia(chosen, rooms))}</button>
        </div>
      ) : (
        <p className="pick-hint">Tap a green room to choose your side and view.</p>
      )}
    </div>
  );
}

function FloorPlan({ name, rooms, sides, takenIds, selectedId, matches, onSelect }) {
  const positioned = rooms.some((r) => r.mapX != null && r.mapY != null);
  const rows = positioned ? null : [
    rooms.filter((r, i) => (sides.length > 1 ? sides.indexOf(r.side) % 2 === 0 : i % 2 === 0)),
    rooms.filter((r, i) => (sides.length > 1 ? sides.indexOf(r.side) % 2 === 1 : i % 2 === 1)),
  ];
  const label = (list) => uniq(list.map((r) => r.side)).join(' / ');
  const unit = (r, i, style) => {
    const taken = takenIds.includes(r.roomId);
    const free = r.availabilityStatus === 'AVAILABLE' && !taken;
    const pick = r.roomId === selectedId;
    return (
      <button
        key={r.roomId}
        style={style}
        disabled={!free}
        className={`unit ${taken ? 'taken' : free ? 'free' : 'booked'} ${pick ? 'chosen' : ''} ${matches(r) ? '' : 'faded'}`}
        onClick={() => onSelect(r.roomId)}
        aria-pressed={pick}
        aria-label={`${taken ? 'In your booking' : free ? 'Available' : 'Booked'} room${r.side ? `, ${r.side}` : ''}${r.view ? `, ${r.view}` : ''}${hasMedia(r) ? ', hotel tour available' : ''}`}
        title={[r.side, r.view].filter(Boolean).join(' · ') || (free ? 'Available' : 'Booked')}
      >
        <span>{pick ? '★' : taken ? '✓' : free ? '' : '×'}</span>
        {hasMedia(r) && <i className="has-tour" title="Hotel tour available">◉</i>}
        {r.view && <small>{r.view.replace(/\s*view$/i, '')}</small>}
      </button>
    );
  };
  return (
    <section className="floor">
      <header>
        <b>{name}</b>
        <span>{rooms.filter((r) => r.availabilityStatus === 'AVAILABLE' && !takenIds.includes(r.roomId)).length} available</span>
      </header>
      {positioned ? (
        <div className="floorplan positioned">
          {rooms.map((r, i) => unit(r, i, r.mapX != null ? { left: `${r.mapX}%`, top: `${r.mapY}%` } : { display: 'none' }))}
        </div>
      ) : (
        <div className="floorplan">
          {rows[0].length > 0 && <div className="wing"><em>{label(rows[0])}</em><div className="units">{rows[0].map((r, i) => unit(r, i))}</div></div>}
          <div className="corridor"><span>CORRIDOR · LIFT</span></div>
          {rows[1].length > 0 && <div className="wing"><div className="units">{rows[1].map((r, i) => unit(r, i))}</div><em>{label(rows[1])}</em></div>}
        </div>
      )}
    </section>
  );
}
