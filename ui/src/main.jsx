import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, dateIn } from './api.js';
import Home from './Home.jsx';
import Property from './Property.jsx';
import Trips from './Trips.jsx';
import './style.css';

const readRoute = () => window.location.hash.replace(/^#/, '') || '/';

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
  return { checkIn: dateIn(1), checkOut: dateIn(3), adults: 2, children: 0 };
}

function App() {
  const [route, navigate] = useRoute();
  const [config, setConfig] = useState({ brand: 'AviQR Stays' });
  const [stays, setStays] = useState([]);
  const [discover, setDiscover] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [stay, setStayState] = useState(initialStay);
  const setStay = (s) => {
    setStayState(s);
    try { sessionStorage.setItem('aviqr-stay', JSON.stringify(s)); } catch { /* storage unavailable */ }
  };

  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
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
  const stayId = route.match(/^\/stay\/([0-9a-f-]{36})/i)?.[1];

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#/">
          {config.logo ? <img src={config.logo} alt="" /> : <span className="brandmark">{(config.brand || 'A')[0]}</span>}
          <span>{config.brand || 'AviQR Stays'}</span>
        </a>
        <nav>
          <a href="#/" className={route === '/' ? 'on' : ''}>Explore</a>
          <a href="#/trips" className={route === '/trips' ? 'on' : ''}>My trips</a>
          <a href="#/" onClick={() => setTimeout(() => document.getElementById('saved')?.scrollIntoView({ behavior: 'smooth' }), 50)}>
            Saved{favorites.length ? <b>{favorites.length}</b> : null}
          </a>
        </nav>
      </header>
      <main>
        {stayId ? (
          <Property id={stayId} stay={stay} setStay={setStay} favorites={favorites} onFavorite={toggleFavorite} navigate={navigate} />
        ) : route === '/trips' ? (
          <Trips stays={stays} navigate={navigate} />
        ) : (
          <Home config={config} stays={stays} discover={discover} loading={loading} error={error} stay={stay} setStay={setStay}
            favorites={favorites} onFavorite={toggleFavorite} openStay={openStay} />
        )}
      </main>
      <footer className="footer">
        <span className="brand"><span className="brandmark">{(config.brand || 'A')[0]}</span>{config.brand || 'AviQR Stays'}</span>
        <span>Live rooms & rates from AviQR PMS · Book direct with the hotel</span>
        {config.supportEmail && <a href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>}
        <span>© {new Date().getFullYear()} {config.brand || 'AviQR'}</span>
      </footer>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
