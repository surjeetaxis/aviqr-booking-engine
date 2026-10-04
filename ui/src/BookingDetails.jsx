import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api, money, nights } from './api.js';
import { logoFor } from './brand.js';

const longDate = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/** A booking from this site's own records. It works for every booking, including ones
 *  made before the hotel's PMS issued vouchers; when it has issued one, this links to it. */
export default function BookingDetails({ bookingId, config, navigate }) {
  const [booking, setBooking] = useState(null);
  const [hotel, setHotel] = useState(null);
  const [roomType, setRoomType] = useState('');
  const [qr, setQr] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    api.booking(bookingId).then((b) => {
      if (b.voucherToken) {
        navigate(`/voucher/${b.hotelId}/${b.reservationId}/${b.voucherToken}`);
        return;
      }
      setBooking(b);
      api.property(b.hotelId).then(setHotel).catch(() => setHotel({}));
      api.roomTypes(b.hotelId).then((types) => setRoomType((types || []).find((t) => t.roomTypeId === b.roomTypeId)?.name || '')).catch(() => {});
      // Just the reference: the front desk's scanner searches by it.
      QRCode.toDataURL(referenceOf(b), { width: 240, margin: 1 }).then(setQr).catch(() => {});
    }).catch(() => setError(true));
  }, [bookingId]);

  if (error) {
    return <div className="page narrow"><div className="empty-card"><b>We couldn't find that booking.</b><button className="primary" onClick={() => navigate('/find')}>Find my booking</button></div></div>;
  }
  if (!booking || !hotel) return <div className="page-msg"><div className="spinner" />Loading your booking…</div>;

  const n = nights(booking.checkIn, booking.checkOut);
  const confirmed = booking.status === 'CONFIRMED';
  const total = booking.grandTotal ?? booking.totalBeforeTax;
  const due = booking.balanceDue ?? total;

  return (
    <div className="voucher-page">
      <div className="voucher-actions no-print">
        <button className="ghost" onClick={() => navigate('/trips')}>← My trips</button>
        <button className="primary" onClick={() => window.print()} disabled={!confirmed}>Download PDF / Print</button>
      </div>
      {confirmed && (
        <p className="note no-print voucher-note">The hotel's emailed voucher isn't available for this booking. Save or print this page and show it at check-in.</p>
      )}
      <article className={`voucher ${confirmed ? '' : 'is-cancelled'}`}>
        <header className="v-head">
          <div className="v-brand">
            <img src={logoFor(config)} alt="" />
            <div><b>{hotel.name || 'Your stay'}</b><span>{[hotel.address, hotel.city].filter(Boolean).join(', ')}</span></div>
          </div>
          <div className="v-status"><span>BOOKING CONFIRMATION</span><b className={confirmed ? 'ok' : 'warn'}>{confirmed ? 'Confirmed' : 'Not confirmed'}</b></div>
        </header>
        <section className="v-hero">
          <div>
            <span className="v-label">Booking reference</span>
            <div className="v-ref">{referenceOf(booking)}</div>
            <p className="muted small">Booked {new Date(booking.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })} · Pay at the hotel</p>
          </div>
          {qr && confirmed && <figure className="v-qr"><img src={qr} alt={`QR code for booking ${referenceOf(booking)}`} /><figcaption>Show at check-in</figcaption></figure>}
        </section>
        <section className="v-dates">
          <div><span className="v-label">Check-in</span><b>{longDate(booking.checkIn)}</b>{hotel.checkInTime && <small>from {hotel.checkInTime}</small>}</div>
          <div><span className="v-label">Check-out</span><b>{longDate(booking.checkOut)}</b>{hotel.checkOutTime && <small>by {hotel.checkOutTime}</small>}</div>
          <div><span className="v-label">Stay</span><b>{n} night{n === 1 ? '' : 's'}</b><small>{booking.adults} adult{booking.adults === 1 ? '' : 's'}{booking.children ? `, ${booking.children} child${booking.children === 1 ? '' : 'ren'}` : ''}</small></div>
        </section>
        <section className="v-rooms">
          <div className="v-room">
            <div><b>{booking.roomCount > 1 ? `${booking.roomCount} rooms` : roomType || 'Room'}</b>{booking.roomCount > 1 && roomType && <small>including {roomType}</small>}</div>
            <span>{money(booking.totalBeforeTax || 0)}</span>
          </div>
        </section>
        <dl className="co-totals v-totals">
          <dt>Rooms</dt><dd>{money(booking.totalBeforeTax || 0)}</dd>
          {Number(booking.addOnTotal) > 0 && <><dt>Add-ons</dt><dd>{money(booking.addOnTotal)}</dd></>}
          {Number(booking.discount) > 0 && <><dt>Discount</dt><dd className="ok">− {money(booking.discount)}</dd></>}
          {Number(booking.estimatedTaxes) > 0 && <><dt>Taxes & fees (est.)</dt><dd>{money(booking.estimatedTaxes)}</dd></>}
          {Number(booking.voucherApplied) > 0 && <><dt>Paid by gift voucher</dt><dd className="ok">− {money(booking.voucherApplied)}</dd></>}
          <dt className="grand">Pay at the hotel</dt><dd className="grand">{money(due || 0)}</dd>
        </dl>
        <footer className="v-foot">
          <span>Bring a government photo ID for every adult. The hotel shares your room number at check-in.</span>
          {config.supportEmail && <span>Questions? {config.supportEmail}</span>}
        </footer>
      </article>
    </div>
  );
}

function referenceOf(b) {
  return b.reference || String(b.reservationId || b.bookingId).slice(0, 8).toUpperCase();
}
