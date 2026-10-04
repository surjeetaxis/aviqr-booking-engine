// Logo, tab icon and design preset for the public site and private hotel storefronts.
export const AVIQR_MARK = '/brand/aviqr/mark.svg';

const PRESET_FONTS = {
  'resort-luxe': 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@400;500;600;700&display=swap',
};

const initials = (name = '') => {
  const words = name.replace(/^the\s+/i, '').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || 'A') + (words[1]?.[0] || '')).toUpperCase();
};

/** A round monogram badge in the hotel's colours, for storefronts without a logo. */
export function monogram(name, bg = '#1f7257', fg = '#ffffff') {
  const text = initials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${bg}"/>`
    + `<text x="32" y="41" text-anchor="middle" font-family="Georgia,serif" font-size="${text.length > 1 ? 26 : 32}" fill="${fg}">${text}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function logoFor(config) {
  if (config.logo) return config.logo;
  return config.mode === 'TENANT' ? monogram(config.propertyName || config.brand, config.primary) : AVIQR_MARK;
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  if (el.getAttribute('href') !== href) el.setAttribute('href', href);
}

export function applyBrand(config) {
  const icon = config.design?.favicon || logoFor(config);
  setLink('icon', icon);
  setLink('apple-touch-icon', icon);
  document.head.querySelector('meta[name="theme-color"]')?.setAttribute('content', config.primary || '#1f7257');
  const preset = config.design?.preset;
  if (preset && preset !== 'classic') document.documentElement.dataset.design = preset;
  else delete document.documentElement.dataset.design;
  const fonts = PRESET_FONTS[preset];
  if (fonts && !document.head.querySelector(`link[data-preset-fonts="${preset}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fonts;
    link.dataset.presetFonts = preset;
    document.head.appendChild(link);
  }
}
