import React from 'react';

// Properties don't publish photos yet, so cards use illustrated scenes picked from the
// destination or room view text. Real hotel media should replace these once the PMS has it.
export function themeFor(text = '') {
  const t = text.toLowerCase();
  if (/\b(beach|sea|seaview|seafacing|ocean|goa|puri|coast|bay|kovalam|andaman)s?\b/.test(t)) return 'sea';
  if (/\b(mountain|hill|manali|shimla|valley|lodge|himalaya|ooty|munnar|darjeeling)s?\b/.test(t)) return 'mountain';
  if (/\b(river|ganga|rishikesh|lake|backwater|varanasi)s?\b/.test(t)) return 'river';
  if (/\b(palace|fort|jaipur|udaipur|jodhpur|heritage|royal)s?\b/.test(t)) return 'heritage';
  if (/\b(garden|park|forest|green|courtyard)s?\b/.test(t)) return 'garden';
  if (/\b(pool)s?\b/.test(t)) return 'pool';
  return 'city';
}

const metro = /chennai|mumbai|delhi|bengaluru|bangalore|hyderabad|pune|kolkata|gurgaon|gurugram|noida|ahmedabad/i;

/** Destination decides the scene; the hotel name only helps when the city says nothing. */
export function stayTheme(p = {}) {
  if (metro.test(p.city || '')) return 'city';
  const byCity = themeFor(p.city || '');
  return byCity !== 'city' ? byCity : themeFor(p.name || '');
}

const hash = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const palettes = {
  sea: ['#f6d6b8', '#9fd3d8', '#2f8c9a', '#e9c99a'],
  mountain: ['#dfe9ef', '#b8cfd9', '#4f6f7d', '#2f4d47'],
  river: ['#f3e3c8', '#bcd8cf', '#3d7f73', '#6e9c7f'],
  heritage: ['#f7dcc0', '#f0b98a', '#c7714a', '#8a4b33'],
  garden: ['#e8f0dc', '#c4dcb4', '#5f8f5a', '#2f5a3a'],
  pool: ['#e6f3f6', '#a8dde6', '#3aa7bd', '#e7d7bf'],
  city: ['#ecdfe9', '#c9c7e6', '#59628f', '#2e3557'],
};

export default function Scene({ seed = '', theme = 'city', className = '', label }) {
  const [sky, haze, main, deep] = palettes[theme] || palettes.city;
  const h = hash(seed);
  const sunX = 70 + (h % 260);
  const id = `g${h}`;
  return (
    <svg className={`scene ${className}`} viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" role="img" aria-label={label || `${theme} illustration`}>
      <defs>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky} />
          <stop offset="1" stopColor={haze} />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#${id}s)`} />
      <circle cx={sunX} cy={70 + (h % 30)} r={26 + (h % 10)} fill="#fff6e6" opacity=".85" />
      {theme === 'sea' && (
        <>
          <path d="M0 165 Q100 150 200 162 T400 158 V260 H0Z" fill={main} />
          <path d="M0 190 Q90 180 190 192 T400 186 V260 H0Z" fill={main} opacity=".7" />
          <path d="M0 215 Q120 200 250 214 T400 205 V260 H0Z" fill={deep} />
          <path d={`M${40 + (h % 60)} 215 q6 -40 -10 -70 M${40 + (h % 60)} 145 q-22 -6 -34 4 M${40 + (h % 60)} 145 q20 -10 34 0 M${40 + (h % 60)} 145 q-6 -18 -24 -22 M${40 + (h % 60)} 145 q14 -16 30 -14`} stroke="#2d4a3e" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )}
      {theme === 'mountain' && (
        <>
          <path d="M0 175 L70 95 L120 140 L190 60 L260 150 L320 100 L400 165 V260 H0Z" fill={main} opacity=".55" />
          <path d="M190 60 L170 84 L186 80 L198 90 L210 76Z" fill="#fff" opacity=".9" />
          <path d="M0 200 L90 130 L160 185 L240 120 L330 190 L400 150 V260 H0Z" fill={main} />
          <path d="M0 260 V215 Q100 195 200 215 T400 205 V260Z" fill={deep} />
          {[40, 70, 330, 360].map((x, i) => <path key={i} d={`M${x} 222 l12 -34 l12 34z`} fill={deep} />)}
        </>
      )}
      {theme === 'river' && (
        <>
          <path d="M0 150 L80 105 L150 140 L230 95 L320 135 L400 110 V260 H0Z" fill={main} opacity=".5" />
          <path d="M0 175 Q120 150 220 170 T400 160 V260 H0Z" fill={main} />
          <path d="M150 260 Q190 210 240 192 Q300 175 400 182 V200 Q320 196 270 210 Q220 228 210 260Z" fill="#e8f4f2" opacity=".9" />
          <path d="M0 230 Q80 215 150 230 V260 H0Z" fill={deep} />
        </>
      )}
      {theme === 'heritage' && (
        <>
          <rect x="0" y="200" width="400" height="60" fill={deep} />
          <path d="M70 200 V140 H110 V120 H290 V140 H330 V200Z" fill={main} />
          <path d="M150 120 Q200 50 250 120Z" fill={main} />
          <path d="M92 140 Q100 118 108 140Z M292 140 Q300 118 308 140Z" fill={main} />
          {[110, 150, 190, 230, 270].map((x) => <path key={x} d={`M${x} 200 V165 Q${x + 10} 150 ${x + 20} 165 V200Z`} fill={sky} opacity=".8" />)}
          <rect x="196" y="40" width="3" height="30" fill={deep} />
          <path d="M199 40 L218 46 L199 52Z" fill="#e9a34b" />
        </>
      )}
      {theme === 'garden' && (
        <>
          <path d="M0 180 Q100 160 200 175 T400 170 V260 H0Z" fill={main} />
          {[30, 95, 160, 250, 330].map((x, i) => (
            <g key={x}>
              <rect x={x + 18} y={150 - (i % 2) * 15} width="6" height="45" fill={deep} />
              <circle cx={x + 21} cy={140 - (i % 2) * 15} r={26 - (i % 3) * 3} fill={deep} opacity=".85" />
            </g>
          ))}
          <path d="M0 260 V225 Q200 205 400 225 V260Z" fill={deep} />
        </>
      )}
      {theme === 'pool' && (
        <>
          <rect x="0" y="170" width="400" height="90" fill={deep} />
          <path d="M40 200 H360 L380 250 H20Z" fill={main} />
          <path d="M70 215 h60 M160 228 h80 M270 213 h50" stroke="#e8fbff" strokeWidth="3" strokeLinecap="round" />
          <path d="M300 170 q6 -45 -10 -75 M290 95 q-22 -6 -34 4 M290 95 q20 -10 34 0" stroke="#2d4a3e" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )}
      {theme === 'city' && (
        <>
          {[0, 40, 75, 120, 165, 205, 250, 290, 330, 365].map((x, i) => {
            const height = 60 + ((h >> i) % 7) * 14;
            return <rect key={x} x={x} y={205 - height} width={i % 3 ? 36 : 30} height={height + 60} fill={i % 2 ? main : deep} opacity={i % 2 ? 0.75 : 1} />;
          })}
          {[0, 40, 75, 120, 165, 205, 250, 290, 330, 365].flatMap((x, i) =>
            [0, 1, 2].map((r) => <rect key={`${x}-${r}`} x={x + 8} y={150 + r * 18 - (i % 3) * 6} width="5" height="7" fill="#ffe6a8" opacity={(h >> (i + r)) % 2 ? 0.9 : 0.25} />),
          )}
          <rect y="232" width="400" height="28" fill={deep} />
        </>
      )}
    </svg>
  );
}
