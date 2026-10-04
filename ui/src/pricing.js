// Mirrors the PMS: FIXED taxes are per night for the reservation, PERCENT ones apply to
// room revenue after any promo discount. Taxes post to the folio at check-in, so these
// are estimates; the PMS recomputes room prices and discounts when the booking is made.
const n = (v) => Number(v) || 0;
const round2 = (v) => Math.round(v * 100) / 100;

export function discountFor(promo, roomTotal) {
  if (!promo) return 0;
  const raw = promo.valueType === 'FIXED' ? n(promo.value) : (roomTotal * n(promo.value)) / 100;
  return round2(Math.max(0, Math.min(raw, roomTotal)));
}

export function estimatedTaxes(taxes = [], taxableRoomTotal, nights) {
  return round2(taxes.reduce((sum, t) => sum + (t.valueType === 'FIXED' ? n(t.value) * nights : (taxableRoomTotal * n(t.value)) / 100), 0));
}

export function checkoutTotals({ items = [], addOns = [], picks = {}, taxes = [], promo = null, nights = 1 }) {
  const roomTotal = round2(items.reduce((s, i) => s + n(i.quote?.totalBeforeTax), 0));
  const addOnTotal = round2(addOns.reduce((s, a) => s + n(a.price) * n(picks[a.id]), 0));
  const discount = discountFor(promo, roomTotal);
  const tax = estimatedTaxes(taxes, roomTotal - discount, nights);
  return { roomTotal, addOnTotal, discount, taxes: tax, grandTotal: round2(Math.max(0, roomTotal + addOnTotal - discount + tax)) };
}

export const guestsPerRoom = (stay) => Math.ceil((n(stay.adults) + n(stay.children)) / Math.max(1, n(stay.rooms) || 1));
