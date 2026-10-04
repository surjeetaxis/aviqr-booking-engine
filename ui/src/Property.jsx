import React, { useEffect, useState } from 'react';
import { api, money, titleCase } from './api.js';
import Scene, { stayTheme, themeFor } from './Scene.jsx';
import StayMap, { hasPoint } from './StayMap.jsx';
import RoomPicker from './RoomPicker.jsx';
import RoomTour, { hasMedia, tourLabel, withTypeMedia } from './RoomTour.jsx';
import { Stepper, StaySummary } from './Flow.jsx';
import { guestsPerRoom } from './pricing.js';

export default function Property({ id, stay, setStay, favorites, onFavorite, navigate, tenant = false, design, cartItems, onAdd, onRemove, onContinue }) {
  const [property, setProperty] = useState(null);
  const [roomTypes, setRoomTypes] = useState(null);
  const [extras, setExtras] = useState(null);
  const [error, setError] = useState('');
  const [roomsFailed, setRoomsFailed] = useState(0);
  const [tour, setTour] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let live = true;
    setProperty(null);
    setRoomTypes(null);
    setError('');
    window.scrollTo(0, 0);
    api.property(id).then((p) => live && setProperty(p)).catch(() => live && setError('This stay is not available right now.'));
    api.roomTypes(id).then((r) => live && setRoomTypes(Array.isArray(r) ? r : [])).catch(() => live && setRoomTypes('error'));
    api.extras(id).then((x) => live && setExtras(x));
    api.recordView(id);
    return () => { live = false; };
  }, [id, roomsFailed]);

  useEffect(() => {
    if (property) document.title = `${property.name} · ${property.city || 'Stay'}`;
  }, [property]);

  if (error) return <div className="page-msg"><h2>{error}</h2>{!tenant && <button className="primary" onClick={() => navigate('/')}>Back to stays</button>}</div>;
  if (!property) return <div className="page-msg"><div className="spinner" />Loading stay…</div>;

  const amenities = [...new Set(property.amenities || [])];
  const saved = favorites.includes(property.id);
  const asked = Math.max(1, Number(stay.rooms || 1));
  // An older PMS can only take one room per online booking.
  const roomsWanted = extras && !extras.supported ? 1 : asked;
  const perRoom = guestsPerRoom({ ...stay, rooms: roomsWanted });
  const full = cartItems.length >= roomsWanted;
  const cartTotal = cartItems.reduce((s, i) => s + Number(i.quote?.totalBeforeTax || 0), 0);
  const roomList = Array.isArray(roomTypes) ? roomTypes : [];
  const shown = roomList.filter((rt) => !filter || rt.roomTypeId === filter);

  const add = (item) => {
    const next = roomsWanted === 1 ? [item] : [...cartItems, item];
    onAdd(item, roomsWanted === 1);
    if (next.length >= roomsWanted) onContinue();
  };

  return (
    <div className="property-page">
      <section className={`p-hero ${tenant && design?.heroTitle ? 'designed' : ''}`}>
        <Scene seed={property.id} theme={stayTheme(property)} className="p-hero-art" label={`${property.city} illustration`} />
        <div className="p-hero-shade" />
        <div className="p-hero-body">
          {!tenant && <button className="crumb" onClick={() => navigate('/')}>← All stays</button>}
          <span className="eyebrow light">{tenant && design?.heroTitle ? [property.name, property.city].filter(Boolean).join(' · ') : property.city || 'AVIQR COLLECTION'}</span>
          <h1>{design?.heroTitle && tenant ? design.heroTitle : property.name}</h1>
          <p>{design?.tagline && tenant ? design.tagline : [property.address, property.city].filter(Boolean).join(', ')}</p>
          <div className="p-hero-actions">
            <button className={`fav-pill ${saved ? 'on' : ''}`} onClick={() => onFavorite(property)}>{saved ? '♥ Saved' : '♡ Save'}</button>
            <a className="fav-pill" href="#rooms">See rooms ↓</a>
            {hasPoint(property) && <a className="fav-pill" href="#location">Location ↓</a>}
          </div>
        </div>
      </section>

      <div className="flow-head">
        <Stepper current={1} onStep={tenant ? undefined : () => navigate('/')} />
        <StaySummary hotel={property} stay={stay} setStay={setStay} />
      </div>

      <div className="p-body single">
        <section className="facts">
          {property.checkInTime && <div><span>CHECK-IN</span><b>From {property.checkInTime}</b></div>}
          {property.checkOutTime && <div><span>CHECK-OUT</span><b>By {property.checkOutTime}</b></div>}
          {property.totalRooms ? <div><span>ROOMS</span><b>{property.totalRooms}</b></div> : null}
          <div><span>BOOKING</span><b>Direct with the hotel</b></div>
        </section>
        {amenities.length > 0 && (
          <section className="p-section">
            <h2>What this stay offers</h2>
            <div className="amenity-grid">{amenities.map((a) => <span key={a}>{titleCase(a)}</span>)}</div>
          </section>
        )}

        <section className="p-section" id="rooms">
          <div className="section-row">
            <div>
              <h2>Available rooms</h2>
              <p className="muted small">Select {roomsWanted} room{roomsWanted > 1 ? 's' : ''} · {cartItems.length} of {roomsWanted} chosen · up to {perRoom} guest{perRoom > 1 ? 's' : ''} per room</p>
            </div>
            {roomList.length > 1 && (
              <div className="chips" role="group" aria-label="Filter room types">
                <button className={!filter ? 'on' : ''} onClick={() => setFilter('')}>All</button>
                {roomList.map((rt) => <button key={rt.roomTypeId} className={filter === rt.roomTypeId ? 'on' : ''} onClick={() => setFilter(rt.roomTypeId)}>{rt.name}</button>)}
              </div>
            )}
          </div>
          {asked > 1 && extras && !extras.supported && (
            <p className="note warn">This hotel takes one room per online booking for now. Book each room separately, or contact the hotel for group stays.</p>
          )}
          {roomTypes == null ? (
            <div className="skeleton-list"><div /><div /></div>
          ) : roomTypes === 'error' ? (
            <div className="empty-card"><b>We couldn't load rooms just now.</b><button className="secondary" onClick={() => { setRoomTypes(null); setRoomsFailed((n) => n + 1); }}>Try again</button></div>
          ) : roomTypes.length === 0 ? (
            <div className="empty-card"><b>No rooms are open for online booking right now.</b><p>Please check again soon.</p></div>
          ) : (
            shown.map((rt) => (
              <RoomTypeCard key={rt.roomTypeId} hotel={property} roomType={rt} stay={stay} perRoom={perRoom}
                takenIds={cartItems.map((i) => i.room.roomId)} full={full && roomsWanted > 1} single={roomsWanted === 1}
                onTour={(room) => setTour({ room, roomType: rt })} onAdd={add} />
            ))
          )}
        </section>

        {hasPoint(property) && (
          <section className="p-section" id="location">
            <h2>Location</h2>
            <p className="muted">{[property.address, property.city].filter(Boolean).join(', ')}</p>
            <StayMap stays={[property]} zoom={14} className="p-map" />
            <a className="text-link" target="_blank" rel="noreferrer"
              href={`https://www.google.com/maps/search/?api=1&query=${property.latitude},${property.longitude}`}>Open in Google Maps ↗</a>
          </section>
        )}
      </div>

      {cartItems.length > 0 && (
        <div className="cart-bar">
          <div className="cart-items">
            {cartItems.map((i) => (
              <span key={i.key} className="cart-chip">
                {i.roomType.name}{i.room.view ? ` · ${i.room.view}` : ''}
                <button onClick={() => onRemove(i.key)} aria-label={`Remove ${i.roomType.name}`}>×</button>
              </span>
            ))}
          </div>
          <div className="cart-total">
            <small>{cartItems.length} of {roomsWanted} room{roomsWanted > 1 ? 's' : ''} · before tax</small>
            <b>{money(cartTotal)}</b>
          </div>
          <button className="primary" disabled={!full} onClick={onContinue}>{full ? 'Continue →' : `Pick ${roomsWanted - cartItems.length} more`}</button>
        </div>
      )}

      {tour && <RoomTour room={tour.room} roomType={tour.roomType} property={property} onClose={() => setTour(null)} />}
    </div>
  );
}

function RoomTypeCard({ hotel, roomType, stay, perRoom, takenIds, full, single, onTour, onAdd }) {
  const [quotes, setQuotes] = useState({});
  const [rooms, setRooms] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [planId, setPlanId] = useState(roomType.ratePlans?.[0]?.ratePlanId);
  const [roomId, setRoomId] = useState(null);
  const [open, setOpen] = useState(false);
  const fits = !roomType.maxOccupancy || perRoom <= roomType.maxOccupancy;
  const dates = { roomTypeId: roomType.roomTypeId, checkIn: stay.checkIn, checkOut: stay.checkOut };

  useEffect(() => {
    let live = true;
    setRooms(null);
    setRoomId(null);
    setMapError(false);
    (roomType.ratePlans || []).forEach((p) =>
      api.quote(hotel.id, { ...dates, ratePlanId: p.ratePlanId })
        .then((q) => live && setQuotes((x) => ({ ...x, [p.ratePlanId]: q })))
        .catch(() => live && setQuotes((x) => ({ ...x, [p.ratePlanId]: { error: true } }))));
    api.roomMap(hotel.id, dates)
      .then((r) => live && setRooms(Array.isArray(r) ? r : []))
      .catch(() => { if (live) { setRooms([]); setMapError(true); } });
    return () => { live = false; };
  }, [hotel.id, roomType.roomTypeId, stay.checkIn, stay.checkOut]);

  useEffect(() => { if (takenIds.includes(roomId)) setRoomId(null); }, [takenIds.join(), roomId]);

  const free = rooms?.filter((r) => r.availabilityStatus === 'AVAILABLE' && !takenIds.includes(r.roomId)) || [];
  const plan = roomType.ratePlans?.find((p) => p.ratePlanId === planId);
  const quote = quotes[planId];
  const room = rooms?.find((r) => r.roomId === roomId);
  const soldOut = rooms && !mapError && free.length === 0;
  const preview = withTypeMedia(room || { themeHint: roomType.description }, rooms || []);
  const tourOf = (r) => onTour(withTypeMedia(r, rooms || []));

  const add = () => {
    onAdd({
      key: crypto.randomUUID(),
      roomType: { roomTypeId: roomType.roomTypeId, name: roomType.name, maxOccupancy: roomType.maxOccupancy },
      plan: { ratePlanId: plan.ratePlanId, name: plan.name, mealPlan: plan.mealPlan, cancellationPolicy: plan.cancellationPolicy },
      room: { roomId: room.roomId, floor: room.floor, side: room.side, view: room.view },
      quote,
    });
    setRoomId(null);
    setOpen(false);
  };

  return (
    <article className={`room-card ${open ? 'open' : ''}`}>
      <div className="room-top">
        <button className="room-art" onClick={() => onTour(preview)} aria-label={`${tourLabel(preview)} of the ${roomType.name}`}>
          <Scene seed={roomType.roomTypeId} theme={themeFor(`${roomType.description} ${hotel.city}`)} />
          <span className={`tour-badge ${hasMedia(preview) ? 'real' : ''}`}>◉ {tourLabel(preview)}</span>
        </button>
        <div className="room-info">
          <h3>{roomType.name}</h3>
          <p>{roomType.description || 'A comfortable room for your stay.'}</p>
          <div className="room-meta">
            {roomType.maxOccupancy && <span>👤 Up to {roomType.maxOccupancy} guests</span>}
            {rooms == null ? <span>Checking live rooms…</span>
              : mapError ? <span className="warn">Live room selection paused</span>
              : soldOut ? <span className="warn">{takenIds.length ? 'No more rooms of this type' : 'Sold out for these dates'}</span>
              : <span className="ok">{free.length === 1 ? 'Last room left' : `${free.length} available`}</span>}
            {[...new Set((rooms || []).map((r) => r.view).filter(Boolean))].slice(0, 3).map((v) => <span key={v}>{v}</span>)}
          </div>
        </div>
      </div>

      <div className="plans">
        {(roomType.ratePlans || []).map((p) => {
          const q = quotes[p.ratePlanId];
          return (
            <label key={p.ratePlanId} className={`plan ${planId === p.ratePlanId ? 'on' : ''}`}>
              <input type="radio" name={`plan-${roomType.roomTypeId}`} checked={planId === p.ratePlanId} onChange={() => setPlanId(p.ratePlanId)} />
              <div>
                <b>{p.name}</b>
                <small>{titleCase(p.mealPlan || 'Room only')} · {p.cancellationPolicy || 'Policy confirmed by the hotel'}</small>
              </div>
              <div className="price">
                {q && !q.error ? (
                  <>
                    <b>{money(q.totalBeforeTax, q.currency)}</b>
                    <small>{q.nights} night{q.nights > 1 ? 's' : ''} · before tax</small>
                  </>
                ) : q?.error ? <small>Not available for these dates</small>
                  : p.baseRate ? <><b>{money(p.baseRate)}</b><small>per night from</small></> : <small>Fetching price…</small>}
              </div>
            </label>
          );
        })}
      </div>

      {!fits && <p className="note warn">This room sleeps up to {roomType.maxOccupancy}. Add more rooms or choose fewer guests.</p>}
      {mapError && <p className="note">The hotel's live room map is temporarily unavailable, so rooms can't be reserved online right now. Please try again shortly.</p>}

      {!mapError && rooms?.length > 0 && fits && (
        open ? (
          <RoomPicker rooms={rooms} takenIds={takenIds} selectedId={roomId} onSelect={setRoomId} onPreview={tourOf} />
        ) : (
          <button className="secondary wide" disabled={soldOut || full} onClick={() => setOpen(true)}>
            {full ? 'All rooms chosen' : 'Choose your room, side & view →'}
          </button>
        )
      )}

      {open && (
        <div className="reserve-bar">
          <div>
            {quote && !quote.error ? <b>{money(quote.totalBeforeTax, quote.currency)}</b> : <b>—</b>}
            <small>{room ? [room.floor, room.side, room.view].filter(Boolean).join(' · ') || 'Room selected' : 'Pick a room on the map'}</small>
          </div>
          <button className="primary" disabled={!room || !plan || !quote || quote.error || full} onClick={add}>{single ? 'Book now →' : 'Add room +'}</button>
        </div>
      )}
    </article>
  );
}
