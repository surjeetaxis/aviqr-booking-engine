import React, { useEffect, useMemo, useState } from 'react';
import { api, money, nights, prettyDate, titleCase } from './api.js';
import Scene, { stayTheme, themeFor } from './Scene.jsx';
import StayMap, { hasPoint } from './StayMap.jsx';
import RoomPicker from './RoomPicker.jsx';
import RoomTour, { hasMedia, tourLabel, withTypeMedia } from './RoomTour.jsx';
import StayBar from './StayBar.jsx';

export default function Property({ id, stay, setStay, favorites, onFavorite, navigate, tenant = false }) {
  const [property, setProperty] = useState(null);
  const [roomTypes, setRoomTypes] = useState(null);
  const [error, setError] = useState('');
  const [tour, setTour] = useState(null);
  const [checkout, setCheckout] = useState(null);

  useEffect(() => {
    let live = true;
    setProperty(null);
    setRoomTypes(null);
    setError('');
    window.scrollTo(0, 0);
    api.property(id).then((p) => live && setProperty(p)).catch(() => live && setError('This stay is not available right now.'));
    api.roomTypes(id).then((r) => live && setRoomTypes(Array.isArray(r) ? r : [])).catch(() => live && setRoomTypes([]));
    api.recordView(id);
    return () => { live = false; };
  }, [id]);

  useEffect(() => {
    if (property) document.title = `${property.name} · ${property.city || 'Stay'}`;
  }, [property]);

  if (error) return <div className="page-msg"><h2>{error}</h2><button className="primary" onClick={() => navigate('/')}>Back to stays</button></div>;
  if (!property) return <div className="page-msg"><div className="spinner" />Loading stay…</div>;

  const theme = stayTheme(property);
  const amenities = [...new Set(property.amenities || [])];
  const saved = favorites.includes(property.id);
  const guests = Number(stay.adults) + Number(stay.children || 0);

  return (
    <div className="property-page">
      <section className="p-hero">
        <Scene seed={property.id} theme={theme} className="p-hero-art" label={`${property.city} illustration`} />
        <div className="p-hero-shade" />
        <div className="p-hero-body">
          {!tenant && <button className="crumb" onClick={() => navigate('/')}>← All stays</button>}
          <span className="eyebrow light">{property.city || 'AVIQR COLLECTION'}</span>
          <h1>{property.name}</h1>
          <p>{[property.address, property.city].filter(Boolean).join(', ')}</p>
          <div className="p-hero-actions">
            <button className={`fav-pill ${saved ? 'on' : ''}`} onClick={() => onFavorite(property)}>{saved ? '♥ Saved' : '♡ Save'}</button>
            <a className="fav-pill" href="#rooms">See rooms ↓</a>
            {hasPoint(property) && <a className="fav-pill" href="#location">Location ↓</a>}
          </div>
        </div>
      </section>

      <div className="p-body">
        <div className="p-main">
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
              <h2>Rooms & rates</h2>
              <span className="muted">{prettyDate(stay.checkIn)} – {prettyDate(stay.checkOut)} · {nights(stay.checkIn, stay.checkOut)} nights · {guests} guests</span>
            </div>
            {roomTypes == null ? (
              <div className="skeleton-list"><div /><div /></div>
            ) : roomTypes.length === 0 ? (
              <div className="empty-card"><b>No rooms are open for online booking right now.</b><p>Please check again soon.</p></div>
            ) : (
              roomTypes.map((rt) => (
                <RoomTypeCard key={rt.roomTypeId} hotel={property} roomType={rt} stay={stay} guests={guests}
                  onTour={(room) => setTour({ room, roomType: rt })}
                  onReserve={(plan, room, quote) => setCheckout({ roomType: rt, plan, room, quote })} />
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

        <aside className="p-side">
          <div className="side-card">
            <span className="eyebrow">YOUR STAY</span>
            <StayBar stay={stay} setStay={setStay} compact />
            <p className="muted small">Prices and availability update live from the hotel's AviQR PMS.</p>
          </div>
        </aside>
      </div>

      {tour && <RoomTour room={tour.room} roomType={tour.roomType} property={property} onClose={() => setTour(null)} />}
      {checkout && <Checkout hotel={property} stay={stay} {...checkout} onClose={() => setCheckout(null)} navigate={navigate} />}
    </div>
  );
}

function RoomTypeCard({ hotel, roomType, stay, guests, onTour, onReserve }) {
  const [quotes, setQuotes] = useState({});
  const [rooms, setRooms] = useState(null);
  const [mapError, setMapError] = useState(false);
  const [planId, setPlanId] = useState(roomType.ratePlans?.[0]?.ratePlanId);
  const [roomId, setRoomId] = useState(null);
  const [open, setOpen] = useState(false);
  const fits = !roomType.maxOccupancy || guests <= roomType.maxOccupancy;
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

  const free = rooms?.filter((r) => r.availabilityStatus === 'AVAILABLE') || [];
  const plan = roomType.ratePlans?.find((p) => p.ratePlanId === planId);
  const quote = quotes[planId];
  const room = rooms?.find((r) => r.roomId === roomId);
  const soldOut = rooms && !mapError && free.length === 0;
  const preview = withTypeMedia(room || { themeHint: roomType.description }, rooms || []);
  const tourOf = (r) => onTour(withTypeMedia(r, rooms || []));

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
            {roomType.maxOccupancy && <span>Sleeps {roomType.maxOccupancy}</span>}
            {rooms == null ? <span>Checking live rooms…</span>
              : mapError ? <span className="warn">Live room selection paused</span>
              : soldOut ? <span className="warn">Sold out for these dates</span>
              : <span className="ok">{free.length === 1 ? "Last room left" : `${free.length} rooms left`}</span>}
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

      {!fits && <p className="note warn">This room sleeps up to {roomType.maxOccupancy}. Choose fewer guests or another room.</p>}
      {mapError && <p className="note">The hotel's live room map is temporarily unavailable, so rooms can't be reserved online right now. Please try again shortly.</p>}

      {!mapError && rooms?.length > 0 && fits && (
        open ? (
          <RoomPicker rooms={rooms} selectedId={roomId} onSelect={setRoomId} onPreview={tourOf} />
        ) : (
          <button className="secondary wide" disabled={soldOut} onClick={() => setOpen(true)}>Choose your room, side & view →</button>
        )
      )}

      {open && (
        <div className="reserve-bar">
          <div>
            {quote && !quote.error ? <b>{money(quote.totalBeforeTax, quote.currency)}</b> : <b>—</b>}
            <small>{room ? [room.floor, room.side, room.view].filter(Boolean).join(' · ') || 'Room selected' : 'Pick a room on the map'}</small>
          </div>
          <button className="primary" disabled={!room || !plan || !quote || quote.error} onClick={() => onReserve(plan, room, quote)}>Reserve →</button>
        </div>
      )}
    </article>
  );
}

function Checkout({ hotel, stay, roomType, plan, room, quote, onClose, navigate }) {
  const [form, setForm] = useState({ guestName: '', guestPhone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const key = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.book(hotel.id, {
        ...form,
        checkInDate: stay.checkIn,
        checkOutDate: stay.checkOut,
        adults: Number(stay.adults),
        children: Number(stay.children || 0),
        roomTypeId: roomType.roomTypeId,
        ratePlanId: plan.ratePlanId,
        roomId: room.roomId,
      }, key);
      setDone(result);
    } catch (err) {
      setError(err.status === 409 || err.status === 400
        ? 'That room was just taken or the stay is no longer valid. Please pick another room.'
        : 'The hotel could not confirm this booking. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const summary = (
    <dl className="summary">
      <dt>Stay</dt><dd>{hotel.name}</dd>
      <dt>Dates</dt><dd>{prettyDate(stay.checkIn)} – {prettyDate(stay.checkOut)} · {nights(stay.checkIn, stay.checkOut)} nights</dd>
      <dt>Guests</dt><dd>{stay.adults} adults{Number(stay.children) ? `, ${stay.children} children` : ''}</dd>
      <dt>Room</dt><dd>{plan.name.startsWith(roomType.name) ? plan.name : `${roomType.name} · ${plan.name}`}</dd>
      {(room.floor || room.side || room.view) && <><dt>Your pick</dt><dd>{[room.floor, room.side, room.view].filter(Boolean).join(' · ')}</dd></>}
      <dt>Total</dt><dd className="total">{money(quote.totalBeforeTax, quote.currency)} <small>before tax</small></dd>
    </dl>
  );

  return (
    <div className="overlay" onClick={() => !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Checkout" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn corner" onClick={onClose} disabled={busy} aria-label="Close">×</button>
        {done ? (
          <div className="confirmed">
            <div className="check">✓</div>
            <span className="eyebrow">BOOKING CONFIRMED</span>
            <h2>You're going to {hotel.city || hotel.name}!</h2>
            <p>Your reservation is confirmed in {hotel.name}'s AviQR PMS. Keep your reference handy at check-in.</p>
            <div className="ref"><span>REFERENCE</span><b>{String(done.reservationId || done.bookingId).slice(0, 8).toUpperCase()}</b></div>
            {summary}
            <div className="row-actions">
              <button className="secondary" onClick={() => navigate('/trips')}>View my trips</button>
              <button className="primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <span className="eyebrow">ALMOST THERE</span>
            <h2>Confirm your stay</h2>
            {summary}
            <label className="field">Full name<input required maxLength={120} autoComplete="name" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} /></label>
            <label className="field">Mobile number<input required type="tel" maxLength={24} pattern="[+0-9() .\-]{7,24}" autoComplete="tel" value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} placeholder="+91 98765 43210" /></label>
            {error && <p className="note warn">{error}</p>}
            <button className="primary wide" disabled={busy}>{busy ? 'Confirming with the hotel…' : `Book now · ${money(quote.totalBeforeTax, quote.currency)}`}</button>
            <p className="muted small">Pay at the property. Your details go only to the hotel's PMS to create the reservation.</p>
          </form>
        )}
      </div>
    </div>
  );
}
