import React, { useEffect, useMemo, useState } from 'react';
import { api, money, nights, prettyDate, titleCase } from './api.js';
import { Stepper } from './Flow.jsx';
import { checkoutTotals } from './pricing.js';

const CODES = ['+91', '+1', '+44', '+971', '+65', '+61', '+49', '+33'];

export default function Checkout({ hotelId, stay, items, onBackToRooms, onBooked, navigate, tenant }) {
  const [hotel, setHotel] = useState(null);
  const [extras, setExtras] = useState(null);
  const [step, setStep] = useState(null);
  const [picks, setPicks] = useState({});
  const [form, setForm] = useState({ guestName: '', guestEmail: '', code: '+91', phone: '', specialRequests: '' });
  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState(null);
  const [promoMsg, setPromoMsg] = useState('');
  const [giftInput, setGiftInput] = useState('');
  const [gift, setGift] = useState(null);
  const [giftMsg, setGiftMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);
  const n = nights(stay.checkIn, stay.checkOut);
  const cartKey = items.map((i) => i.key).join();
  // One idempotency key per cart, so a double-click or retry can't book twice.
  const key = useMemo(() => crypto.randomUUID(), [cartKey, stay.checkIn, stay.checkOut]);

  useEffect(() => {
    window.scrollTo(0, 0);
    api.property(hotelId).then(setHotel).catch(() => setHotel({ id: hotelId, name: 'Your stay' }));
    api.extras(hotelId).then((x) => {
      setExtras(x);
      setStep((s) => s || (x.addOns?.length ? 'addons' : 'details'));
    });
  }, [hotelId]);

  const supported = !!extras?.supported;
  const addOns = extras?.addOns || [];
  const totals = checkoutTotals({ items, addOns, picks, taxes: extras?.taxes || [], promo, nights: n });
  // A gift voucher pays what it can now; the PMS confirms the exact amount when booking.
  const giftApplied = gift ? Math.min(Number(gift.balance) || 0, totals.grandTotal) : 0;
  const dueAtHotel = Math.max(0, totals.grandTotal - giftApplied);
  const guests = Number(stay.adults) + Number(stay.children || 0);
  const capacity = items.reduce((s, i) => s + Number(i.roomType.maxOccupancy || 2), 0);
  const policies = [...new Set(items.map((i) => i.plan.cancellationPolicy).filter(Boolean))];
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // A changed room total changes a percentage promo, so re-check the code with the PMS.
  useEffect(() => { setPromo(null); setPromoMsg(''); }, [totals.roomTotal]);

  if (!done && items.length === 0) {
    return (
      <div className="page narrow">
        <Stepper current={1} />
        <div className="empty-card"><b>Your room selection has expired.</b><p>Pick your rooms again to continue.</p>
          <button className="primary" onClick={onBackToRooms}>Choose rooms</button></div>
      </div>
    );
  }
  if (!extras || !step) return <div className="page-msg"><div className="spinner" />Preparing your booking…</div>;

  async function applyPromo(e) {
    e.preventDefault();
    const code = promoInput.trim();
    if (!code) return;
    setPromoMsg('');
    try {
      const p = await api.promo(hotelId, { code, roomTotal: totals.roomTotal, checkIn: stay.checkIn });
      setPromo(p);
      setPromoMsg(`${p.name} applied`);
    } catch {
      setPromo(null);
      setPromoMsg("That promo code isn't valid for this stay");
    }
  }

  async function applyGift(e) {
    e.preventDefault();
    const code = giftInput.trim();
    if (!code) return;
    setGiftMsg('');
    try {
      const g = await api.giftVoucher(hotelId, code);
      setGift(g);
      setGiftMsg(`Gift voucher ${g.code}: ${money(g.balance)} available`);
    } catch (err) {
      setGift(null);
      setGiftMsg(err.status === 429 ? 'Too many tries. Please wait a few minutes.' : "That gift voucher isn't valid or has no balance left");
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (guests > capacity) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.book(hotelId, {
        guestName: form.guestName.trim(),
        guestPhone: `${form.code} ${form.phone.trim()}`,
        ...(supported && form.guestEmail.trim() ? { guestEmail: form.guestEmail.trim() } : {}),
        ...(supported && form.specialRequests.trim() ? { specialRequests: form.specialRequests.trim() } : {}),
        checkInDate: stay.checkIn,
        checkOutDate: stay.checkOut,
        adults: Number(stay.adults),
        children: Number(stay.children || 0),
        rooms: items.map((i) => ({ roomTypeId: i.roomType.roomTypeId, ratePlanId: i.plan.ratePlanId, roomId: i.room.roomId })),
        addOns: addOns.filter((a) => picks[a.id] > 0).map((a) => ({ addOnId: a.id, quantity: picks[a.id] })),
        ...(promo ? { promoCode: promo.code } : {}),
        ...(gift ? { giftVoucherCode: gift.code } : {}),
      }, key);
      setDone({ ...result, shown: totals, items, guestEmail: supported ? form.guestEmail.trim() : '' });
      setStep('done');
      onBooked();
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.status === 409 && /yet/.test(err.message) ? err.message
        : err.status === 400 || err.status === 409 ? `${err.message && err.message !== 'Request failed' ? err.message + '. ' : ''}A room may have just been taken; please go back and pick again.`
        : 'The hotel could not confirm this booking. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = step === 'addons' ? 2 : step === 'details' ? 3 : 4;
  const skip = addOns.length ? [] : [2];
  const goStep = (i) => (i <= 1 ? onBackToRooms() : i === 2 ? setStep('addons') : null);

  const summary = (
    <aside className="co-summary">
      <div className="co-card">
        <div className="co-card-head">Your booking</div>
        <div className="co-card-body">
          <b className="co-hotel">{hotel?.name}</b>
          <p className="muted small">{prettyDate(stay.checkIn)} – {prettyDate(stay.checkOut)} · {n} night{n === 1 ? '' : 's'} · {items.length} room{items.length > 1 ? 's' : ''} · {guests} guest{guests === 1 ? '' : 's'}</p>
          {items.map((i, idx) => (
            <div key={i.key} className="co-line">
              <div>
                <b>Room {idx + 1} · {i.roomType.name}</b>
                <small>{[i.plan.name, titleCase(i.plan.mealPlan || ''), i.room.floor, i.room.side, i.room.view].filter(Boolean).join(' · ')}</small>
              </div>
              <span>{money(i.quote?.totalBeforeTax || 0)}</span>
            </div>
          ))}
          {addOns.filter((a) => picks[a.id] > 0).map((a) => (
            <div key={a.id} className="co-line"><div><b>{a.name}</b><small>× {picks[a.id]}</small></div><span>{money(a.price * picks[a.id])}</span></div>
          ))}
          <dl className="co-totals">
            <dt>Room total</dt><dd>{money(totals.roomTotal)}</dd>
            {totals.addOnTotal > 0 && <><dt>Add-ons</dt><dd>{money(totals.addOnTotal)}</dd></>}
            {totals.discount > 0 && <><dt>Promo {promo?.code}</dt><dd className="ok">− {money(totals.discount)}</dd></>}
            <dt>Taxes & fees{extras.taxes?.length ? ' (est.)' : ''}</dt><dd>{extras.taxes?.length ? money(totals.taxes) : 'At the hotel'}</dd>
            <dt className={giftApplied ? '' : 'grand'}>Grand total</dt><dd className={giftApplied ? '' : 'grand'}>{money(totals.grandTotal)}</dd>
            {giftApplied > 0 && <><dt>Gift voucher {gift.code}</dt><dd className="ok">− {money(giftApplied)}</dd>
              <dt className="grand">Pay at the hotel</dt><dd className="grand">{money(dueAtHotel)}</dd></>}
          </dl>
          {extras.taxes?.length > 0 && <p className="muted small">{extras.taxes.map((t) => `${t.name} ${t.valueType === 'PERCENT' ? `${Number(t.value)}%` : `${money(t.value)}/night`}`).join(' · ')}</p>}
        </div>
      </div>
    </aside>
  );

  if (step === 'done') {
    const t = done.grandTotal != null
      ? { roomTotal: done.totalBeforeTax, addOnTotal: done.addOnTotal, discount: done.discount, taxes: done.estimatedTaxes, grandTotal: done.grandTotal,
          voucherApplied: Number(done.voucherApplied) || 0, balanceDue: done.balanceDue ?? done.grandTotal }
      : { ...done.shown, voucherApplied: 0, balanceDue: done.shown.grandTotal };
    return (
      <div className="checkout-page">
        <div className="flow-head"><Stepper current={4} skip={skip} /></div>
        <div className="confirm-page">
          <div className="check">✓</div>
          <span className="eyebrow">BOOKING CONFIRMED</span>
          <h1>You're going to {hotel?.city || hotel?.name}!</h1>
          <p className="muted">Your reservation is confirmed in {hotel?.name}'s system. Show this reference at check-in.</p>
          <div className="ref"><span>REFERENCE</span><b>{done.reference || String(done.reservationId || done.bookingId).slice(0, 8).toUpperCase()}</b></div>
          {done.guestEmail && <p className="muted small">We've emailed your voucher to {done.guestEmail}.</p>}
          <dl className="co-totals wide">
            <dt>Rooms</dt><dd>{done.items.map((i) => i.roomType.name).join(', ')}</dd>
            <dt>Dates</dt><dd>{prettyDate(stay.checkIn)} – {prettyDate(stay.checkOut)}</dd>
            <dt>Room total</dt><dd>{money(t.roomTotal || 0)}</dd>
            {Number(t.addOnTotal) > 0 && <><dt>Add-ons</dt><dd>{money(t.addOnTotal)}</dd></>}
            {Number(t.discount) > 0 && <><dt>Discount</dt><dd className="ok">− {money(t.discount)}</dd></>}
            {Number(t.taxes) > 0 && <><dt>Taxes & fees (est.)</dt><dd>{money(t.taxes)}</dd></>}
            {t.voucherApplied > 0 && <><dt>Grand total</dt><dd>{money(t.grandTotal)}</dd><dt>Paid by gift voucher</dt><dd className="ok">− {money(t.voucherApplied)}</dd></>}
            <dt className="grand">Pay at the hotel</dt><dd className="grand">{money(t.balanceDue || 0)}</dd>
          </dl>
          <div className="row-actions">
            {done.voucherToken
              ? <button className="secondary" onClick={() => navigate(`/voucher/${hotelId}/${done.reservationId}/${done.voucherToken}`)}>View voucher</button>
              : <button className="secondary" onClick={() => navigate('/trips')}>View my trips</button>}
            <button className="primary" onClick={onBackToRooms}>{tenant ? 'Back to the hotel' : 'Back to the stay'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="flow-head"><Stepper current={stepIndex} onStep={goStep} skip={skip} /></div>
      <div className="checkout-grid">
        <div className="co-main">
          <button className="crumb-link" onClick={() => (step === 'details' && addOns.length ? setStep('addons') : onBackToRooms())}>
            ← {step === 'details' && addOns.length ? 'Back to add-ons' : 'Back to rooms'}
          </button>

          {step === 'addons' ? (
            <section className="co-card">
              <div className="co-card-head">Enhance your stay</div>
              <div className="addon-grid">
                {addOns.map((a) => {
                  const q = picks[a.id] || 0;
                  const setQ = (v) => setPicks({ ...picks, [a.id]: Math.max(0, Math.min(20, v)) });
                  return (
                    <div key={a.id} className={`addon ${q ? 'on' : ''}`}>
                      <b>{a.name}</b>
                      {a.description && <p>{a.description}</p>}
                      <div className="addon-foot">
                        <div className="qty">
                          <button type="button" onClick={() => setQ(q - 1)} disabled={!q} aria-label={`Fewer ${a.name}`}>−</button>
                          <span aria-live="polite">{q}</span>
                          <button type="button" onClick={() => setQ(q + 1)} aria-label={`More ${a.name}`}>+</button>
                        </div>
                        <b>{money(a.price)}</b>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <form id="guest-form" className="co-card" onSubmit={submit}>
              <div className="co-card-head">Guest information</div>
              <div className="co-card-body form-grid">
                <label className="field full">Full name *<input required maxLength={120} autoComplete="name" value={form.guestName} onChange={set('guestName')} placeholder="First and last name" /></label>
                {supported && (
                  <label className="field">Email<input type="email" maxLength={254} autoComplete="email" value={form.guestEmail} onChange={set('guestEmail')} placeholder="you@example.com" /></label>
                )}
                <label className={`field ${supported ? '' : 'full'}`}>Mobile number *
                  <span className="phone">
                    <select value={form.code} onChange={set('code')} aria-label="Country code">{CODES.map((c) => <option key={c}>{c}</option>)}</select>
                    <input required type="tel" maxLength={18} pattern="[0-9() .\-]{6,18}" autoComplete="tel-national" value={form.phone} onChange={set('phone')} placeholder="98765 43210" />
                  </span>
                </label>
                {supported && (
                  <label className="field full">Special requests <small>(optional)</small>
                    <textarea maxLength={200} rows={3} value={form.specialRequests} onChange={set('specialRequests')} placeholder="High floor, extra pillows, anniversary decoration…" />
                    <small className="muted">{form.specialRequests.length}/200 · The hotel will try its best; requests aren't guaranteed.</small>
                  </label>
                )}
                {supported && (
                  <div className="field full">Gift voucher
                    <span className="promo-row">
                      <input value={giftInput} maxLength={40} onChange={(e) => setGiftInput(e.target.value.toUpperCase())} placeholder="Enter voucher code" aria-label="Gift voucher code"
                        onKeyDown={(e) => e.key === 'Enter' && applyGift(e)} />
                      <button type="button" className="secondary" onClick={gift ? () => { setGift(null); setGiftInput(''); setGiftMsg(''); } : applyGift}>{gift ? 'Remove' : 'Apply'}</button>
                    </span>
                    {giftMsg && <small className={gift ? 'ok' : 'warn'}>{giftMsg}</small>}
                  </div>
                )}
                {supported && (
                  <div className="field full">Promo code
                    <span className="promo-row">
                      <input value={promoInput} maxLength={32} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="Enter code" aria-label="Promo code"
                        onKeyDown={(e) => e.key === 'Enter' && applyPromo(e)} />
                      <button type="button" className="secondary" onClick={applyPromo}>Apply</button>
                    </span>
                    {promoMsg && <small className={promo ? 'ok' : 'warn'}>{promoMsg}</small>}
                  </div>
                )}
                <fieldset className="field full pay">
                  <legend>Payment</legend>
                  <label className="pay-opt on"><input type="radio" name="pay" defaultChecked /> <span><b>Pay at the hotel</b><small>No card needed now</small></span></label>
                  <label className="pay-opt off"><input type="radio" name="pay" disabled /> <span><b>Pay now</b><small>Online payment coming soon</small></span></label>
                </fieldset>
                {policies.length > 0 && (
                  <div className="policy full"><b>Cancellation policy</b>{policies.map((p) => <p key={p}>{p}</p>)}</div>
                )}
                {guests > capacity && <p className="note warn full">These rooms sleep up to {capacity}. Go back and add a room for {guests} guests.</p>}
                {error && <p className="note warn full">{error}</p>}
              </div>
            </form>
          )}
        </div>
        {summary}
      </div>

      <div className="cart-bar">
        <div className="cart-total"><small>{items.length} room{items.length > 1 ? 's' : ''}{totals.addOnTotal ? ' + add-ons' : ''} · {giftApplied ? 'pay at hotel' : 'total'}</small><b>{money(dueAtHotel)}</b></div>
        {step === 'addons' ? (
          <div className="row-actions">
            <button className="ghost" onClick={() => { setPicks({}); setStep('details'); }}>Skip</button>
            <button className="primary" onClick={() => setStep('details')}>Continue →</button>
          </div>
        ) : (
          <button className="primary" type="submit" form="guest-form" disabled={busy || guests > capacity}>
            {busy ? 'Confirming with the hotel…' : `Confirm booking · ${money(dueAtHotel)}`}
          </button>
        )}
      </div>
    </div>
  );
}
