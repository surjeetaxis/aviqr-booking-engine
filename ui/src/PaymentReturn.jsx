import React, { useEffect, useState } from 'react';
import { api, money } from './api.js';

const SYNC_TRIES = 6;

/** Where the payment gateway sends the guest back. The result shown is what the hotel's system
 *  recorded after checking with the gateway, never the status in the address bar. */
export default function PaymentReturn({ requestKey, navigate }) {
  const [booking, setBooking] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    let timer;
    window.scrollTo(0, 0);
    api.bookingByRequest(requestKey).then(async (b) => {
      if (!live) return;
      setBooking(b);
      if (!b.reservationId || !b.voucherToken) { setError('We could not find this booking.'); return; }
      for (let i = 0; i < SYNC_TRIES && live; i++) {
        try {
          const r = await api.paymentSync(b.hotelId, b.reservationId, b.voucherToken);
          if (!live) return;
          setResult(r);
          if (!['CREATED', 'PENDING'].includes(r.status)) return;
        } catch {
          if (live) setResult({ status: 'PENDING' });
        }
        await new Promise((ok) => { timer = setTimeout(ok, 2500); });
      }
    }).catch(() => live && setError('We could not find this booking.'));
    return () => { live = false; clearTimeout(timer); };
  }, [requestKey]);

  if (error) return <div className="page-msg"><h2>{error}</h2><button className="primary" onClick={() => navigate('/find')}>Find my booking</button></div>;
  if (!booking || !result) return <div className="page-msg"><div className="spinner" />Checking your payment with the hotel…</div>;

  const voucher = () => navigate(`/voucher/${booking.hotelId}/${booking.reservationId}/${booking.voucherToken}`);
  const amount = money(result.amount ?? booking.payAmount ?? 0, result.currency || booking.currency || 'INR');
  const what = (result.kind || booking.payKind) === 'FULL' ? 'payment' : 'deposit';
  const view = {
    PAID: { icon: '✓', eyebrow: 'PAYMENT RECEIVED', title: `Your ${what} of ${amount} is paid`, text: 'Your booking is confirmed. The receipt is on your voucher.' },
    UNVERIFIED: { icon: '…', eyebrow: 'PAYMENT RECEIVED', title: 'The hotel is confirming your payment', text: `Your booking is held while the hotel checks the ${amount} with its bank. You don't need to pay again.` },
    PENDING: { icon: '…', eyebrow: 'PAYMENT PROCESSING', title: 'Your payment is still processing', text: 'This can take a few minutes. Your voucher updates once the hotel receives it.' },
    CREATED: { icon: '…', eyebrow: 'PAYMENT PROCESSING', title: 'Your payment is still processing', text: 'This can take a few minutes. Your voucher updates once the hotel receives it.' },
  }[result.status] || {
    icon: '!', eyebrow: 'PAYMENT NOT COMPLETED', title: `Your ${what} didn't go through`,
    text: result.required
      ? 'The hotel needs this deposit to confirm your booking. Try again now; unpaid bookings are released after 45 minutes.'
      : 'Your booking is still confirmed, and you can pay at the hotel instead.',
  };
  const retry = !['PAID', 'UNVERIFIED', 'PENDING', 'CREATED', 'EXPIRED'].includes(result.status) && booking.payUrl;

  return (
    <div className="checkout-page">
      <div className="confirm-page">
        <div className={`check ${view.icon === '!' ? 'warn' : ''}`}>{view.icon}</div>
        <span className="eyebrow">{view.eyebrow}</span>
        <h1>{view.title}</h1>
        <p className="muted">{view.text}</p>
        <div className="ref"><span>REFERENCE</span><b>{booking.reference || String(booking.reservationId).slice(0, 8).toUpperCase()}</b></div>
        <div className="row-actions">
          {retry && <a className="primary button-link" href={booking.payUrl}>Try the payment again</a>}
          <button className={retry ? 'secondary' : 'primary'} onClick={voucher}>View voucher</button>
        </div>
      </div>
    </div>
  );
}
