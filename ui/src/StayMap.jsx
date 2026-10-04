import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const hasPoint = (p) => Number.isFinite(p?.latitude) && Number.isFinite(p?.longitude);
const escape = (s = '') => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** OpenStreetMap view of one or many stays; markers are HTML pins so no image assets are needed. */
export default function StayMap({ stays, onOpen, zoom = 13, className = '' }) {
  const host = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const open = useRef(onOpen);
  open.current = onOpen;

  useEffect(() => {
    map.current = L.map(host.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);

  useEffect(() => {
    const points = stays.filter(hasPoint);
    layer.current.clearLayers();
    points.forEach((p) => {
      const icon = L.divIcon({ className: 'pin', html: `<span>${escape(p.name)}</span>`, iconSize: null });
      const marker = L.marker([p.latitude, p.longitude], { icon, title: p.name }).addTo(layer.current);
      if (open.current) marker.on('click', () => open.current(p));
    });
    if (points.length === 1) map.current.setView([points[0].latitude, points[0].longitude], zoom);
    else if (points.length) map.current.fitBounds(points.map((p) => [p.latitude, p.longitude]), { padding: [60, 60], maxZoom: 7 });
    else map.current.setView([22.5, 79], 4);
  }, [stays, zoom]);

  return <div ref={host} className={`stay-map ${className}`} />;
}

export { hasPoint };
