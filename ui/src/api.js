const base = '/api/v1/ota';
const unwrap = (x) => x?.data ?? x;
const tenantSlug = () => window.location.pathname.match(/^\/stay\/([a-z0-9-]+)/i)?.[1] || '';
const withTenant = (path) => {
  const slug = tenantSlug();
  if (!slug) return path;
  return `${path}${path.includes('?') ? '&' : '?'}slug=${encodeURIComponent(slug)}`;
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options) {
  const r = await fetch(`${base}${withTenant(path)}`, options);
  const body = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new ApiError(body?.message || 'Request failed', r.status);
  return unwrap(body);
}

export function visitorId() {
  try {
    let id = localStorage.getItem('aviqr-visitor-id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('aviqr-visitor-id', id);
    }
    return id;
  } catch {
    return (visitorId.fallback ||= crypto.randomUUID());
  }
}

const qs = (params) => new URLSearchParams(params).toString();
const vid = () => qs({ visitorId: visitorId() });

export const api = {
  config: () => request('/config'),
  async properties({ q = '', city = '' } = {}) {
    const all = [];
    for (let page = 0; page < 25; page++) {
      const data = await request(`/properties?${qs({ q, city, page, size: 100 })}`);
      const rows = Array.isArray(data) ? data : data?.content || [];
      all.push(...rows);
      if (!data?.totalPages || page + 1 >= data.totalPages || !rows.length) break;
    }
    return all;
  },
  property: (id) => request(`/properties/${id}`),
  discover: () => request(`/discover?${vid()}`),
  recordView: (id) => request(`/properties/${id}/views?${vid()}`, { method: 'POST' }).catch(() => {}),
  roomTypes: (id) => request(`/properties/${id}/room-types`),
  quote: (id, p) => request(`/properties/${id}/quote?${qs(p)}`),
  extras: (id) => request(`/properties/${id}/extras`).catch(() => ({ supported: false, addOns: [], taxes: [] })),
  promo: (id, p) => request(`/properties/${id}/promo?${qs(p)}`),
  giftVoucher: (id, code) => request(`/properties/${id}/gift-voucher?${qs({ code })}`),
  roomMap: (id, p) => request(`/properties/${id}/room-map?${qs(p)}`),
  favorites: () => request(`/favorites?${vid()}`),
  saveFavorite: (id, on) => request(`/favorites/${id}?${vid()}`, { method: on ? 'PUT' : 'DELETE' }),
  trips: () => request(`/trips?${vid()}`),
  voucher: (hotelId, reservationId, token) => request(`/vouchers/${hotelId}/${reservationId}?${qs({ token })}`),
  emailVoucher: (hotelId, reservationId, token) => request(`/vouchers/${hotelId}/${reservationId}/email?${qs({ token })}`, { method: 'POST' }),
  findBooking: (reference, phone) => request(`/bookings/find?${qs({ reference, phone })}`),
  book: (id, body, key) =>
    request(`/properties/${id}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
      body: JSON.stringify({ ...body, visitorId: visitorId() }),
    }),
};

export const dateIn = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const money = (amount, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(amount));

export const nights = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 86400000));

export const prettyDate = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export const titleCase = (s = '') =>
  s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
