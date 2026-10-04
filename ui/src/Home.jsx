import React, { useMemo, useState } from 'react';
import Scene, { stayTheme, themeFor } from './Scene.jsx';
import StayBar from './StayBar.jsx';
import StayMap from './StayMap.jsx';
import RoomTour from './RoomTour.jsx';
import { titleCase } from './api.js';

export function StayCard({ stay: p, saved, onFavorite, onOpen, size = '' }) {
  const amenities = [...new Set(p.amenities || [])].slice(0, 3);
  return (
    <article className={`stay-card ${size}`} onClick={() => onOpen(p)}>
      <div className="stay-art">
        <Scene seed={p.id} theme={stayTheme(p)} label={`${p.city || ''} illustration`} />
        {p.recommendationReason && <span className="badge">{p.recommendationReason}</span>}
        <button className={`heart ${saved ? 'on' : ''}`} aria-label={saved ? 'Remove from saved' : 'Save stay'}
          onClick={(e) => { e.stopPropagation(); onFavorite(p); }}>{saved ? '♥' : '♡'}</button>
      </div>
      <div className="stay-body">
        <span className="where">{p.city || 'India'}{p.totalRooms ? ` · ${p.totalRooms} rooms` : ''}</span>
        <h3>{p.name}</h3>
        <p>{p.address || 'Direct booking with the hotel'}</p>
        {amenities.length > 0 && <div className="mini-tags">{amenities.map((a) => <span key={a}>{titleCase(a)}</span>)}</div>}
      </div>
    </article>
  );
}

const demo = {
  room: { floor: '4', side: 'West wing', view: 'Sea view' },
  roomType: { name: 'Deluxe Sea View', maxOccupancy: 3 },
  property: { name: 'Sample stay', city: 'Goa' },
};

export default function Home({ config, stays, discover, loading, error, stay, setStay, favorites, onFavorite, openStay }) {
  const [where, setWhere] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('popular');
  const [demoTour, setDemoTour] = useState(false);
  const destinations = discover?.destinations || [];

  const results = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const pop = new Map((discover?.famous || []).map((p, i) => [p.id, i]));
    const list = stays.filter((p) => !f || `${p.name} ${p.city} ${p.address}`.toLowerCase().includes(f));
    if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'rooms') return [...list].sort((a, b) => (b.totalRooms || 0) - (a.totalRooms || 0));
    return [...list].sort((a, b) => (pop.get(a.id) ?? 99) - (pop.get(b.id) ?? 99));
  }, [stays, filter, sort, discover]);

  const search = (e) => {
    e?.preventDefault();
    setFilter(where);
    document.getElementById('all-stays')?.scrollIntoView({ behavior: 'smooth' });
  };
  const pickCity = (city) => {
    setWhere(city);
    setFilter(city);
    document.getElementById('all-stays')?.scrollIntoView({ behavior: 'smooth' });
  };
  const card = (p, size) => <StayCard key={p.id} stay={p} size={size} saved={favorites.includes(p.id)} onFavorite={onFavorite} onOpen={openStay} />;
  const saved = stays.filter((p) => favorites.includes(p.id));

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">{config.brand?.toUpperCase() || 'AVIQR STAYS'} · BOOK DIRECT</span>
          <h1>See your room<br /><em>before you arrive.</em></h1>
          <p>Pick the exact room, the side of the building and the view you want, live from the hotel's own inventory. Then walk through it in 3D.</p>
        </div>
        <form className="search-card" onSubmit={search}>
          <label className="where-field">
            <span>Where to?</span>
            <input list="destinations" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="City or hotel name" />
            <datalist id="destinations">{destinations.map((d) => <option key={d.city} value={d.city} />)}</datalist>
          </label>
          <StayBar stay={stay} setStay={setStay} />
          <button className="primary search-go">Search stays</button>
        </form>
        <div className="hero-art" aria-hidden="true">
          <Scene seed="hero-sea" theme="sea" />
          <Scene seed="hero-mountain" theme="mountain" />
          <Scene seed="hero-heritage" theme="heritage" />
        </div>
      </section>

      {error && <div className="banner warn">{error}</div>}

      {destinations.length > 0 && (
        <section className="block">
          <div className="block-head"><div><span className="eyebrow">WHERE NEXT</span><h2>Popular destinations</h2></div></div>
          <div className="dest-row">
            {destinations.slice(0, 8).map((d) => (
              <button key={d.city} className="dest" onClick={() => pickCity(d.city)}>
                <Scene seed={d.city} theme={themeFor(d.city)} />
                <span><b>{d.city}</b>{d.stays} stay{d.stays > 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="block">
        <div className="block-head">
          <div><span className="eyebrow">GUEST FAVOURITES</span><h2>Famous stays</h2><p>Ranked by recent bookings, saves and views on {config.brand || 'AviQR'}.</p></div>
        </div>
        {loading ? <div className="card-row skeleton"><div /><div /><div /></div>
          : <div className="card-row">{(discover?.famous || stays.slice(0, 6)).map((p) => card(p, 'wide'))}</div>}
      </section>

      {discover?.forYou?.length > 0 && (
        <section className="block tint">
          <div className="block-head"><div><span className="eyebrow">PICKED FOR YOU</span><h2>Recommended stays</h2><p>{discover.forYou.some((p) => !/^Handpicked/.test(p.recommendationReason || '')) ? "Based on the places you've explored and saved." : "A few places we think you'll love. Explore and save stays to personalise this."}</p></div></div>
          <div className="card-row">{discover.forYou.map((p) => card(p))}</div>
        </section>
      )}

      {discover?.recentlyViewed?.length > 0 && (
        <section className="block">
          <div className="block-head"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Recently viewed</h2></div></div>
          <div className="card-row compact">{discover.recentlyViewed.map((p) => card(p, 'small'))}</div>
        </section>
      )}

      <section className="experience">
        <div className="exp-copy">
          <span className="eyebrow light">LOOK BEFORE YOU BOOK</span>
          <h2>Choose the room.<br /><em>Choose the view.</em></h2>
          <ul>
            <li><b>Live floor map</b> See which rooms are open or booked for your dates.</li>
            <li><b>Side & view</b> Pick the sea-facing, garden or city side you prefer.</li>
            <li><b>3D & 4D tours</b> Walk the room and watch the view change from sunrise to night.</li>
          </ul>
          <button className="primary light" onClick={() => setDemoTour(true)}>Try a 3D room tour ↗</button>
        </div>
        <button className="exp-art" onClick={() => setDemoTour(true)} aria-label="Open sample 3D room tour">
          <Scene seed="experience" theme="sea" />
          <span className="tour-badge big">◉ 3D · 4D</span>
        </button>
      </section>

      <section className="block" id="all-stays">
        <div className="block-head">
          <div><span className="eyebrow">THE COLLECTION</span><h2>{filter ? `Stays matching "${filter}"` : 'All stays'}</h2><p>{results.length} of {stays.length} stays</p></div>
          <div className="toolbar">
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or city" aria-label="Filter stays" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort stays">
              <option value="popular">Most popular</option>
              <option value="name">Name</option>
              <option value="rooms">Largest</option>
            </select>
          </div>
        </div>
        <div className="split">
          <div className="card-grid two">
            {loading ? <div className="empty-card">Finding stays…</div>
              : results.length ? results.map((p) => card(p))
              : <div className="empty-card"><b>No stays match that search.</b><button className="text-link" onClick={() => { setFilter(''); setWhere(''); }}>Clear search</button></div>}
          </div>
          <div className="map-sticky"><StayMap stays={results} onOpen={openStay} /></div>
        </div>
      </section>

      {saved.length > 0 && (
        <section className="block" id="saved">
          <div className="block-head"><div><span className="eyebrow">YOUR SHORTLIST</span><h2>Saved stays</h2></div></div>
          <div className="card-row compact">{saved.map((p) => card(p, 'small'))}</div>
        </section>
      )}

      {demoTour && <RoomTour {...demo} onClose={() => setDemoTour(false)} />}
    </>
  );
}
