import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api, money, nights, titleCase } from './api.js';
import { logoFor } from './brand.js';

const STATUS = { BOOKED: 'Confirmed', CHECKED_IN: 'Checked in', CHECKED_OUT: 'Checked out', CANCELLED: 'Cancelled', NO_SHOW: 'No-show' };
const longDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** The guest's booking voucher. Print or save as PDF; the QR opens this voucher for the front desk. */
export default function Voucher({ hotelId, reservationId, token, config, navigate }) {
  const [voucher, setVoucher] = useState(null);
  const [hotel, setHotel] = useState(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    api.voucher(hotelId, reservationId, token).then(setVoucher).catch(() => setError('We couldn\'t find this booking. Check the link, or find it with your reference and phone.'));
    api.property(hotelId).then(setHotel).catch(() => setHotel({}));
    const url = `${window.location.origin}${window.location.pathname}#/voucher/${hotelId}/${reservationId}/${token}`;
    QRCode.toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: 'M' }).then(setQr).catch(() => {});
  }, [hotelId, reservationId, token]);

  useEffect(() => {
    if (voucher) document.title = `Booking ${voucher.reference} · ${hotel?.name || 'Voucher'}`;
  }, [voucher, hotel]);

  async function sendEmail() {
    setSending(true);
    setEmailMsg('');
    try {
      await api.emailVoucher(hotelId, reservationId, token);
      setEmailMsg(`Sent to ${voucher.emailHint}.`);
    } catch (e) {
      setEmailMsg(e.message && e.message !== 'Request failed' ? e.message : 'The voucher couldn\'t be emailed right now.');
    } finally {
      setSending(false);
    }
  }

  if (error) {
    return (
      <div className="page narrow">
        <div className="empty-card"><b>{error}</b><button className="primary" onClick={() => navigate('/find')}>Find my booking</button></div>
      </div>
    );
  }
  if (!voucher || !hotel) return <div className="page-msg"><div className="spinner" />Loading your voucher…</div>;

  const n = nights(voucher.checkInDate, voucher.checkOutDate);
  const policies = [...new Set(voucher.rooms.map((r) => r.cancellationPolicy).filter(Boolean))];
  const cancelled = voucher.status === 'CANCELLED';

  return (
    <div className="voucher-page">
      <div className="voucher-actions no-print">
        <button className="ghost" onClick={() => navigate('/trips')}>← My trips</button>
        <div className="row-actions">
          {voucher.emailHint && !cancelled && <button className="secondary" onClick={sendEmail} disabled={sending}>{sending ? 'Sending…' : 'Email voucher'}</button>}
          <button className="primary" onClick={() => window.print()}>Download PDF / Print</button>
        </div>
      </div>
      {emailMsg && <p className="note no-print voucher-note">{emailMsg}</p>}

      <article className={`voucher ${cancelled ? 'is-cancelled' : ''}`}>
        <header className="v-head">
          <div className="v-brand">
            <img src={logoFor(config)} alt="" />
            <div>
              <b>{hotel.name || 'Your stay'}</b>
              <span>{[hotel.address, hotel.city].filter(Boolean).join(', ')}</span>
            </div>
          </div>
          <div className="v-status"><span>BOOKING VOUCHER</span><b className={cancelled ? 'warn' : 'ok'}>{STATUS[voucher.status] || titleCase(voucher.status)}</b></div>
        </header>

        <section className="v-hero">
          <div>
            <span className="v-label">Booking reference</span>
            <div className="v-ref">{voucher.reference}</div>
            <span className="v-label">Guest</span>
            <b className="v-guest">{voucher.guestName}</b>
            <p className="muted small">Booked {new Date(voucher.bookedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · Pay at the hotel</p>
          </div>
          {qr && <figure className="v-qr"><img src={qr} alt={`QR code for booking ${voucher.reference}`} /><figcaption>Show at check-in</figcaption></figure>}
        </section>

        <section className="v-dates">
          <div><span className="v-label">Check-in</span><b>{longDate(voucher.checkInDate)}</b>{hotel.checkInTime && <small>from {hotel.checkInTime}</small>}</div>
          <div><span className="v-label">Check-out</span><b>{longDate(voucher.checkOutDate)}</b>{hotel.checkOutTime && <small>by {hotel.checkOutTime}</small>}</div>
          <div><span className="v-label">Stay</span><b>{n} night{n === 1 ? '' : 's'}</b><small>{voucher.adults} adult{voucher.adults === 1 ? '' : 's'}{voucher.children ? `, ${voucher.children} child${voucher.children === 1 ? '' : 'ren'}` : ''}</small></div>
        </section>

        <section className="v-rooms">
          {voucher.rooms.map((r, i) => (
            <div key={i} className="v-room">
              <div>
                <b>Room {i + 1} · {r.roomType}</b>
                <small>{[r.ratePlan, r.mealPlan && titleCase(r.mealPlan)].filter(Boolean).join(' · ')}</small>
                {(r.floor || r.side || r.view) && <small className="v-where">{[r.floor, r.side, r.view].filter(Boolean).join(' · ')}</small>}
              </div>
              <span>{money(r.ratePerNight)} <small>/ night</small></span>
            </div>
          ))}
        </section>

        <dl className="co-totals wide v-totals">
          <dt>Rooms ({n} night{n === 1 ? '' : 's'})</dt><dd>{money(voucher.roomTotal)}</dd>
          {voucher.extras.map((x, i) => (
            <React.Fragment key={i}><dt>{x.description}</dt><dd className={x.amount < 0 ? 'ok' : ''}>{x.amount < 0 ? `− ${money(-x.amount)}` : money(x.amount)}</dd></React.Fragment>
          ))}
          <dt>Taxes & fees{voucher.taxesEstimated ? ' (est.)' : ''}</dt><dd>{money(voucher.taxes)}</dd>
          {Number(voucher.paid) > 0 && <><dt>Total</dt><dd>{money(voucher.grandTotal)}</dd><dt>Paid</dt><dd className="ok">− {money(voucher.paid)}</dd></>}
          <dt className="grand">{cancelled ? 'Total' : 'Pay at the hotel'}</dt><dd className="grand">{money(cancelled ? voucher.grandTotal : (voucher.balanceDue ?? voucher.grandTotal))}</dd>
        </dl>

        {voucher.preCheckinUrl && (
          <a className="v-precheckin no-print" href={voucher.preCheckinUrl} target="_blank" rel="noreferrer">
            <b>Check in online</b><span>Add your ID details and sign the registration card now, and skip the queue at the desk →</span>
          </a>
        )}
        {voucher.preCheckedIn && voucher.status === 'BOOKED' && <p className="v-request ok"><b>✓ Online check-in complete.</b> Show this QR at the desk to collect your key.</p>}
        {voucher.specialRequests && <p className="v-request"><b>Your request:</b> {voucher.specialRequests}</p>}
        {policies.length > 0 && <div className="policy"><b>Cancellation policy</b>{policies.map((p) => <p key={p}>{p}</p>)}</div>}
        <footer className="v-foot">
          <span>Bring a government photo ID for every adult. The hotel shares your room number at check-in.</span>
          {config.supportEmail && <span>Questions? {config.supportEmail}</span>}
        </footer>
      </article>
    </div>
  );
}
