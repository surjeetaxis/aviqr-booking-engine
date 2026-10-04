import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, dateIn } from './api.js';
import Home from './Home.jsx';
import Property from './Property.jsx';
import Trips from './Trips.jsx';
import Checkout from './Checkout.jsx';
import Voucher from './Voucher.jsx';
import FindBooking from './FindBooking.jsx';
import { applyBrand, logoFor } from './brand.js';
import './style.css';

const readRoute = () => window.location.hash.replace(/^#/, '') || (window.location.pathname.startsWith('/stay/') ? window.location.pathname : '/');

function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = useCallback((to) => {
    window.location.hash = to;
    window.scrollTo(0, 0);
  }, []);
  return [route, navigate];
}

function initialStay() {
  try {
    const s = JSON.parse(sessionStorage.getItem('aviqr-stay'));
    if (s?.checkIn >= dateIn(0) && s.checkOut > s.checkIn) return s;
  } catch { /* fall through to defaults */ }
  return { checkIn: dateIn(1), checkOut: dateIn(3), rooms: 1, adults: 2, children: 0 };
}

const readSession = (k, fallback) => {
  try { return JSON.parse(sessionStorage.getItem(k)) ?? fallback; } catch { return fallback; }
};
const writeSession = (k, v) => {
  try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
};

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('aviqr-theme') || ''; } catch { return ''; }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  const dark = theme ? theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('aviqr-theme', next); } catch { /* storage unavailable */ }
  };
  return [dark, toggle];
}

function App() {
  const [route, navigate] = useRoute();
  const [config, setConfig] = useState({ brand: 'AviQR Stays' });
  const [configReady, setConfigReady] = useState(false);
  const [stays, setStays] = useState([]);
  const [discover, setDiscover] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [stay, setStayState] = useState(initialStay);
  const setStay = (s) => { setStayState(s); writeSession('aviqr-stay', s); };
  const [cart, setCartState] = useState(() => readSession('aviqr-cart', { items: [] }));
  const setCart = (c) => { setCartState(c); writeSession('aviqr-cart', c); };
  const [dark, toggleTheme] = useTheme();

  useEffect(() => {
    api.config().then(setConfig).catch(() => {}).finally(() => setConfigReady(true));
    api.favorites().then((f) => setFavorites(Array.isArray(f) ? f : [])).catch(() => {});
    api.properties()
      .then(setStays)
      .catch(() => setError('Stays are temporarily unavailable. Please try again shortly.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (route === '/') {
      document.title = `${config.brand || 'AviQR Stays'} · Book direct`;
      api.discover().then(setDiscover).catch(() => {});
    }
  }, [route, config.brand]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (config.primary) root.setProperty('--brand', config.primary);
    if (config.accent) root.setProperty('--accent', config.accent);
    applyBrand(config);
  }, [config]);

  async function toggleFavorite(p) {
    const on = !favorites.includes(p.id);
    setFavorites(on ? [p.id, ...favorites] : favorites.filter((x) => x !== p.id));
    try {
      await api.saveFavorite(p.id, on);
    } catch {
      setFavorites(favorites);
    }
  }

  const openStay = (p) => navigate(`/stay/${p.id}`);
  const routeStayKey = route.match(/^\/stay\/([^/]+)/i)?.[1];
  const stayId = routeStayKey && /^[0-9a-f-]{36}$/i.test(routeStayKey) ? routeStayKey
    : config.mode === 'TENANT' ? config.propertyId : null;
  const tenantStorefront = config.mode === 'TENANT';
  const checkoutRoute = /\/checkout$/.test(route);
  const voucherRoute = route.match(/^\/voucher\/([0-9a-f-]{36})\/([0-9a-f-]{36})\/([A-Za-z0-9_-]{8,64})$/i);
  // The cart belongs to one hotel and one set of dates; changing either starts over.
  const cartItems = cart.hotelId === stayId && cart.checkIn === stay.checkIn && cart.checkOut === stay.checkOut ? cart.items : [];
  const base = { hotelId: stayId, checkIn: stay.checkIn, checkOut: stay.checkOut };
  const addToCart = (item, replace) => setCart({ ...base, items: replace ? [item] : [...cartItems, item] });
  const removeFromCart = (key) => setCart({ ...base, items: cartItems.filter((i) => i.key !== key) });
  const roomsPath = tenantStorefront ? `/stay/${config.propertyId}` : `/stay/${stayId}`;
  const checkoutPath = `${roomsPath}/checkout`;

  return (
    <>
      <header className="topbar">
        <a className="brand" href={tenantStorefront ? `#/stay/${config.propertyId}` : '#/'}>
          <img className="brand-logo" src={logoFor(config)} alt="" />
          <span className="brand-name">{config.brand || 'AviQR Stays'}<small>{tenantStorefront ? [config.city, 'Book direct'].filter(Boolean).join(' · ') : 'Book direct'}</small></span>
        </a>
        <nav>
          {!tenantStorefront && <a href="#/" className={route === '/' ? 'on' : ''}>Explore</a>}
          <a href="#/trips" className={route === '/trips' ? 'on' : ''}>My trips</a>
          <a href="#/find" className={route === '/find' ? 'on' : ''}>Find booking</a>
          <button className="theme-toggle" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? '☀' : '☾'}</button>
          {!tenantStorefront && <a href="#/" onClick={() => setTimeout(() => document.getElementById('saved')?.scrollIntoView({ behavior: 'smooth' }), 50)}>
            Saved{favorites.length ? <b>{favorites.length}</b> : null}
          </a>}
        </nav>
      </header>
      <main>
        {voucherRoute ? (
          <Voucher hotelId={voucherRoute[1]} reservationId={voucherRoute[2]} token={voucherRoute[3]} config={config} navigate={navigate} />
        ) : route === '/find' ? (
          <FindBooking navigate={navigate} />
        ) : !configReady && routeStayKey && !stayId ? <div className="page-msg"><div className="spinner" />Loading booking engine…</div> : stayId && checkoutRoute ? (
          <Checkout hotelId={stayId} stay={stay} items={cartItems} navigate={navigate} tenant={tenantStorefront}
            onBackToRooms={() => navigate(roomsPath)} onBooked={() => setCart({ items: [] })} />
        ) : stayId ? (
          <Property id={stayId} stay={stay} setStay={setStay} favorites={favorites} onFavorite={toggleFavorite} navigate={navigate} tenant={tenantStorefront} design={config.design}
            cartItems={cartItems} onAdd={addToCart} onRemove={removeFromCart} onContinue={() => navigate(checkoutPath)} />
        ) : route === '/trips' ? (
          <Trips stays={stays} navigate={navigate} />
        ) : (
          <Home config={config} stays={stays} discover={discover} loading={loading} error={error} stay={stay} setStay={setStay}
            favorites={favorites} onFavorite={toggleFavorite} openStay={openStay} />
        )}
      </main>
      <footer className="footer">
        <span className="brand"><img className="brand-logo small" src={logoFor(config)} alt="" />{config.brand || 'AviQR Stays'}</span>
        <span>Live rooms & rates from AviQR PMS · Book direct with the hotel</span>
        {config.supportEmail && <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>}
        <span>© {new Date().getFullYear()} {config.brand || 'AviQR'}</span>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
