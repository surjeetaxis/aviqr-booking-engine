import React, { useEffect, useMemo, useRef, useState } from 'react';
import { stayTheme, themeFor } from './Scene.jsx';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hourLabel = (h) => {
  const hh = Math.floor(h) % 24;
  const mm = String(Math.floor((h % 1) * 60)).padStart(2, '0');
  return `${((hh + 11) % 12) + 1}:${mm} ${hh < 12 ? 'AM' : 'PM'}`;
};
const facing = (side = '') => {
  const s = side.toLowerCase();
  return ['north', 'south', 'east', 'west'].find((d) => s.includes(d));
};

/** Room preview: real hotel media when published, otherwise an illustrative 3D room with a time-of-day ("4D") dimension. */
export default function RoomTour({ room, roomType, property, onClose }) {
  const modes = useMemo(() => {
    const m = [];
    if (room?.model3dUrl) m.push(['model', '3D model']);
    if (room?.panoramaUrl) m.push(['panorama', '360° tour']);
    if (room?.tourVideoUrl) m.push(['video', 'Video tour']);
    m.push(['illustrative', m.length ? 'Illustrative 3D' : '3D room tour']);
    return m;
  }, [room]);
  const [mode, setMode] = useState(modes[0][0]);
  const [hour, setHour] = useState(() => clamp(new Date().getHours() + new Date().getMinutes() / 60, 6, 21));
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [spot, setSpot] = useState('entrance');
  const mount = useRef(null);
  const world = useRef(null);
  const theme = room?.view && themeFor(room.view) !== 'city' ? themeFor(room.view) : stayTheme(property);
  const size = /suite|presidential|villa|family/i.test(roomType?.name || '') || roomType?.maxOccupancy >= 4 ? 'large'
    : roomType?.maxOccupancy >= 3 || /deluxe|premium|executive/i.test(roomType?.name || '') ? 'medium' : 'small';

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setHour((h) => (h + 0.08) % 24), 40);
    return () => clearInterval(t);
  }, [playing]);

  useEffect(() => world.current?.setHour(hour), [hour, mode]);
  useEffect(() => world.current?.goTo(spot), [spot]);

  useEffect(() => {
    if (mode === 'video') return;
    const host = mount.current;
    let renderer, controls, frame, resize, scene, dead = false;
    setError(false);
    (async () => {
      try {
        const [THREE, { OrbitControls }, { GLTFLoader }] = await Promise.all([
          import('three'),
          import('three/addons/controls/OrbitControls.js'),
          import('three/addons/loaders/GLTFLoader.js'),
        ]);
        if (dead) return;
        scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(70, host.clientWidth / Math.max(host.clientHeight, 1), 0.05, 200);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(host.clientWidth, host.clientHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        host.appendChild(renderer.domElement);
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.enablePan = false;

        if (mode === 'illustrative') {
          world.current = buildRoom(THREE, scene, camera, controls, { theme, size });
          world.current.setHour(hour);
          world.current.goTo(spot, true);
        } else if (mode === 'model') {
          scene.add(new THREE.HemisphereLight(0xffffff, 0x53604f, 2));
          const light = new THREE.DirectionalLight(0xffffff, 2);
          light.position.set(3, 5, 4);
          scene.add(light);
          camera.position.set(0, 1.5, 4);
          controls.minDistance = 1;
          controls.maxDistance = 10;
          new GLTFLoader().load(room.model3dUrl, (g) => {
            if (dead) return;
            const box = new THREE.Box3().setFromObject(g.scene);
            const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
            g.scene.position.sub(c);
            scene.add(g.scene);
            camera.position.set(0, Math.max(s.y, 1) * 0.7, Math.max(s.x, s.z, 1) * 1.6);
          }, undefined, () => !dead && setError(true));
        } else {
          camera.position.set(0, 0, 0.01);
          controls.enableZoom = false;
          controls.rotateSpeed = -0.35;
          new THREE.TextureLoader().load(room.panoramaUrl, (t) => {
            if (dead) return t.dispose();
            t.mapping = THREE.EquirectangularReflectionMapping;
            t.colorSpace = THREE.SRGBColorSpace;
            scene.background = t;
          }, undefined, () => !dead && setError(true));
        }

        resize = () => {
          if (!host.clientWidth || !host.clientHeight) return;
          camera.aspect = host.clientWidth / host.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(host.clientWidth, host.clientHeight);
        };
        window.addEventListener('resize', resize);
        const draw = () => {
          frame = requestAnimationFrame(draw);
          world.current?.tick();
          controls.update();
          renderer.render(scene, camera);
        };
        draw();
      } catch {
        if (!dead) setError(true);
      }
    })();
    return () => {
      dead = true;
      world.current = null;
      cancelAnimationFrame(frame);
      if (resize) window.removeEventListener('resize', resize);
      controls?.dispose();
      scene?.traverse((x) => {
        x.geometry?.dispose();
        [].concat(x.material || []).forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
      if (scene?.background?.dispose) scene.background.dispose();
      renderer?.dispose();
      if (renderer?.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [mode, room, theme, size]);

  const dir = facing(room?.side);
  const spots = [['entrance', 'Entrance'], ['window', 'Window view'], ['bed', 'Bedside'], ...(size === 'large' ? [['lounge', 'Lounge']] : [])];

  return (
    <div className="tour-overlay" onClick={onClose}>
      <section className="tour-dialog" role="dialog" aria-modal="true" aria-label="Room tour" onClick={(e) => e.stopPropagation()}>
        <header className="tour-head">
          <div>
            <span className="eyebrow">{roomType?.name || 'Room'} · {property?.name}</span>
            <h3>
              {room?.floor ? `Floor ${String(room.floor).replace(/^floor\s*/i, '')}` : 'Room preview'}
              {room?.side ? ` · ${room.side}` : ''}
              {room?.view ? ` · ${room.view}` : ''}
            </h3>
          </div>
          <div className="tour-modes">
            {modes.map(([k, label]) => (
              <button key={k} className={mode === k ? 'active' : ''} onClick={() => setMode(k)}>{label}</button>
            ))}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close tour">×</button>
        </header>

        <div className="tour-stage">
          {mode === 'video' ? (
            <video className="tour-video" src={room.tourVideoUrl} controls playsInline autoPlay muted />
          ) : (
            <div className="tour-canvas" ref={mount} />
          )}
          {error && <div className="tour-error">This tour couldn't load. The property's media link may be unavailable.</div>}
          {mode === 'illustrative' && (
            <>
              <div className="tour-spots">
                {spots.map(([k, label]) => (
                  <button key={k} className={spot === k ? 'active' : ''} onClick={() => setSpot(k)}>{label}</button>
                ))}
              </div>
              {dir && <div className="tour-compass"><b>{dir[0].toUpperCase()}</b>Window faces {dir}</div>}
            </>
          )}
        </div>

        <footer className="tour-footer">
          {mode === 'illustrative' ? (
            <>
              <div className="time-dial">
                <button className="play" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause day cycle' : 'Play day cycle'}>
                  {playing ? '❚❚' : '▶'}
                </button>
                <div>
                  <label htmlFor="tour-hour">Time of day · <b>{hourLabel(hour)}</b></label>
                  <input id="tour-hour" type="range" min="0" max="23.9" step="0.1" value={hour}
                    onChange={(e) => { setPlaying(false); setHour(Number(e.target.value)); }} />
                  <div className="time-ticks"><span>Night</span><span>Sunrise</span><span>Noon</span><span>Sunset</span><span>Night</span></div>
                </div>
              </div>
              <small>Illustrative 3D layout for a {roomType?.name || 'room'} with a {room?.view || `${theme} view`}. Drag to look around. Furnishings may differ at the property.</small>
            </>
          ) : (
            <small>{mode === 'video' ? 'Video tour supplied by the property.' : 'Drag to look around. Tour media supplied by the property.'}</small>
          )}
        </footer>
      </section>
    </div>
  );
}

function buildRoom(THREE, scene, camera, controls, { theme, size }) {
  const [W, D] = size === 'large' ? [8, 6.6] : size === 'medium' ? [6.4, 5.4] : [5.4, 4.6];
  const H = 3;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const box = (w, h, d, material, x, y, z, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'object' && material.isMaterial ? material : mat(material));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // Floor with painted planks, plaster walls and the window opening on the back wall.
  const plank = document.createElement('canvas');
  plank.width = plank.height = 512;
  const p = plank.getContext('2d');
  for (let i = 0; i < 8; i++) {
    p.fillStyle = ['#b98b62', '#b0835a', '#c09369', '#a97d55'][i % 4];
    p.fillRect(0, i * 64, 512, 64);
    p.fillStyle = '#00000014';
    p.fillRect(0, i * 64, 512, 2);
    p.fillRect(((i * 197) % 400) + 40, i * 64, 2, 64);
  }
  const floorTex = new THREE.CanvasTexture(plank);
  floorTex.colorSpace = THREE.SRGBColorSpace;
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(W / 2.5, D / 2.5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xffffff, { map: floorTex, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xf7f4ee, { emissive: 0xf7f4ee, emissiveIntensity: 0.18 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = H;
  scene.add(ceiling);

  const wallMat = mat(0xefe9df, { side: THREE.DoubleSide });
  const accentMat = mat(0x6f8f83, { side: THREE.DoubleSide });
  const winW = Math.min(W * 0.62, 4.2), winH = 2.0, winY = 0.55;
  const back = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(W / 2, H), new THREE.Vector2(-W / 2, H)]);
  back.holes.push(new THREE.Path([new THREE.Vector2(-winW / 2, winY), new THREE.Vector2(winW / 2, winY), new THREE.Vector2(winW / 2, winY + winH), new THREE.Vector2(-winW / 2, winY + winH)]));
  const backWall = new THREE.Mesh(new THREE.ShapeGeometry(back), wallMat);
  backWall.position.z = -D / 2;
  scene.add(backWall);
  const wall = (w, material, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, H), material);
    m.position.set(x, H / 2, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  wall(D, accentMat, -W / 2, 0, Math.PI / 2); // headboard wall
  wall(D, wallMat, W / 2, 0, -Math.PI / 2);
  wall(W, wallMat, 0, D / 2, Math.PI);
  box(W, 0.12, 0.02, 0xd9d1c4, 0, 0.06, D / 2 - 0.01); // skirting
  box(0.95, 2.2, 0.06, 0x8a6a4c, W / 2 - 0.9, 1.1, D / 2 - 0.03); // door

  // Window frame, mullions and curtains.
  const frame = mat(0x2f3a36);
  box(winW + 0.12, 0.08, 0.14, frame, 0, winY, -D / 2);
  box(winW + 0.12, 0.08, 0.14, frame, 0, winY + winH, -D / 2);
  [-winW / 2, 0, winW / 2].forEach((x) => box(0.06, winH, 0.12, frame, x, winY + winH / 2, -D / 2));
  const curtain = mat(0xd9c7a7, { roughness: 1 });
  [-1, 1].forEach((s) => {
    for (let i = 0; i < 5; i++) box(0.13, H - 0.25, 0.08, curtain, s * (winW / 2 + 0.12 + i * 0.12), (H - 0.25) / 2 + 0.05, -D / 2 + 0.12 + (i % 2) * 0.04);
  });

  // The view outside is a painted canvas repainted for the time of day.
  const view = document.createElement('canvas');
  view.width = 1024;
  view.height = 512;
  const viewTex = new THREE.CanvasTexture(view);
  viewTex.colorSpace = THREE.SRGBColorSpace;
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(winW * 2.6, winH * 2.4), new THREE.MeshBasicMaterial({ map: viewTex }));
  outside.position.set(0, winY + winH / 2 + 0.2, -D / 2 - 1.6);
  scene.add(outside);

  // Bed against the accent wall with nightstands and lamps.
  const bedW = size === 'small' ? 1.6 : 1.9, bedL = 2.1, bx = -W / 2 + bedL / 2 + 0.05, bz = size === 'large' ? 0.9 : 0.35;
  box(0.1, 1.25, bedW + 0.3, 0x5b4636, -W / 2 + 0.06, 0.62, bz);
  box(bedL, 0.32, bedW, 0x6b5240, bx, 0.2, bz);
  box(bedL - 0.05, 0.24, bedW - 0.05, 0xfbfaf6, bx, 0.48, bz);
  box(bedL * 0.45, 0.05, bedW + 0.02, 0x8fa89d, bx + bedL * 0.22, 0.62, bz);
  [-1, 1].forEach((s) => box(0.38, 0.16, bedW / 2 - 0.12, 0xffffff, -W / 2 + 0.35, 0.68, bz + (s * bedW) / 4));
  const lamps = [];
  [-1, 1].forEach((s) => {
    const z = bz + s * (bedW / 2 + 0.35);
    box(0.45, 0.5, 0.45, 0x5b4636, -W / 2 + 0.3, 0.25, z);
    box(0.04, 0.3, 0.04, 0x2f3a36, -W / 2 + 0.3, 0.65, z);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.22, 24, 1, true), mat(0xf3e6cc, { side: THREE.DoubleSide, emissive: 0xffc77a, emissiveIntensity: 0 }));
    shade.position.set(-W / 2 + 0.3, 0.88, z);
    scene.add(shade);
    const bulb = new THREE.PointLight(0xffc27a, 0, 5, 1.6);
    bulb.position.set(-W / 2 + 0.3, 0.9, z);
    scene.add(bulb);
    lamps.push({ shade, bulb });
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), mat(0xcdb89a, { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(bx + bedL / 2 + 0.6, 0.005, bz);
  scene.add(rug);

  // TV wall, wardrobe, desk and a reading chair by the window.
  box(0.45, 0.5, 1.8, 0x5b4636, W / 2 - 0.25, 0.25, bz);
  box(0.04, 0.7, 1.25, 0x111416, W / 2 - 0.04, 1.35, bz);
  box(0.62, 2.3, 1.2, 0xd8cfc0, -W / 2 + 0.32, 1.15, D / 2 - 0.65);
  box(1.3, 0.05, 0.6, 0x6b5240, W / 2 - 0.35, 0.76, D / 2 - 1.9).rotation.y = Math.PI / 2;
  box(0.5, 0.45, 0.5, 0x2f3a36, W / 2 - 0.9, 0.45, D / 2 - 1.9);
  const chair = (x, z) => {
    box(0.75, 0.42, 0.75, 0x8fa89d, x, 0.21, z);
    box(0.75, 0.55, 0.14, 0x8fa89d, x, 0.6, z - 0.31);
  };
  chair(-winW / 2 + 0.2, -D / 2 + 0.85);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 32), mat(0x6b5240));
  table.position.set(-winW / 2 + 1.0, 0.27, -D / 2 + 0.8);
  scene.add(table);
  if (size === 'large') {
    box(2.1, 0.42, 0.85, 0x6f8f83, W / 2 - 1.5, 0.21, -D / 2 + 1.7);
    box(2.1, 0.5, 0.18, 0x6f8f83, W / 2 - 1.5, 0.55, -D / 2 + 2.05);
    box(1.1, 0.35, 0.6, 0x5b4636, W / 2 - 1.5, 0.18, -D / 2 + 0.75);
  }
  const plant = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), mat(0x4f7d55));
  plant.position.set(winW / 2 + 0.55, 0.85, -D / 2 + 0.45);
  scene.add(plant);
  box(0.3, 0.45, 0.3, 0xe5ded2, winW / 2 + 0.55, 0.22, -D / 2 + 0.45);

  // Lighting: sky fill, sunlight through the window, and a ceiling downlight.
  const hemi = new THREE.HemisphereLight(0xdfefff, 0xd9cdbd, 1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.target.position.set(0, 0, 1);
  scene.add(sun, sun.target);
  const ceilingLight = new THREE.PointLight(0xfff1dc, 0, 9, 1.4);
  ceilingLight.position.set(0, H - 0.2, 0.3);
  scene.add(ceilingLight);

  const night = new THREE.Color('#0b1430'), nightLow = new THREE.Color('#25365c');
  const dayTop = new THREE.Color('#6fb4ea'), dayLow = new THREE.Color('#dcefff');
  const goldTop = new THREE.Color('#7d6aa8'), goldLow = new THREE.Color('#f6a36b');
  const g = view.getContext('2d');

  function paint(hour) {
    const elev = Math.sin(((hour - 6) / 12) * Math.PI);
    const day = smooth(-0.12, 0.3, elev), gold = clamp(1 - Math.abs(elev - 0.05) / 0.28, 0, 1);
    const top = night.clone().lerp(dayTop, day).lerp(goldTop, gold * 0.55);
    const low = nightLow.clone().lerp(dayLow, day).lerp(goldLow, gold * 0.8);
    const w = view.width, h = view.height, horizon = h * 0.6;
    const sky = g.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, top.getStyle());
    sky.addColorStop(1, low.getStyle());
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    if (day < 0.5) {
      g.fillStyle = `rgba(255,255,255,${0.8 * (1 - day * 2)})`;
      for (let i = 0; i < 90; i++) g.fillRect((i * 397) % w, (i * 151) % (horizon * 0.9), 2, 2);
    }
    const dayT = clamp((hour - 6) / 12, 0, 1), sx = w * (0.12 + 0.76 * dayT), sy = horizon - elev * horizon * 0.9;
    if (elev > -0.1) {
      g.fillStyle = gold > 0.3 ? '#ffd29a' : '#fff7e2';
      g.beginPath(); g.arc(sx, sy, 34, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = '#f2f0e6';
      g.beginPath(); g.arc(w * 0.72, h * 0.18, 24, 0, Math.PI * 2); g.fill();
    }
    const shade = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(0.22 + 0.78 * day * k).getStyle();
    const ridge = (pts, color) => {
      g.fillStyle = color; g.beginPath(); g.moveTo(0, h);
      pts.forEach(([x, y]) => g.lineTo(x * w, y * h)); g.lineTo(w, h); g.fill();
    };
    if (theme === 'sea' || theme === 'pool') {
      const water = g.createLinearGradient(0, horizon, 0, h);
      water.addColorStop(0, shade('#3f9fb0'));
      water.addColorStop(1, shade('#1c5a70'));
      g.fillStyle = water;
      g.fillRect(0, horizon, w, h);
      g.fillStyle = `rgba(255,236,200,${0.35 * Math.max(day, gold)})`;
      for (let i = 0; i < 14; i++) g.fillRect(sx - 40 + ((i * 37) % 80), horizon + 10 + i * 12, 60 - i * 3, 3);
      if (theme === 'pool') ridge([[0, 0.8], [1, 0.8]], shade('#e3d3b6'));
      ridge([[0, 0.94], [0.25, 0.9], [0.6, 0.95], [1, 0.9]], shade('#d9c08f'));
    } else if (theme === 'mountain' || theme === 'river') {
      ridge([[0, 0.5], [0.15, 0.32], [0.3, 0.45], [0.48, 0.22], [0.62, 0.42], [0.8, 0.3], [1, 0.48]], shade('#7f9aa5', 0.9));
      ridge([[0, 0.62], [0.2, 0.48], [0.4, 0.6], [0.62, 0.45], [0.85, 0.6], [1, 0.52]], shade('#4f6f6a'));
      if (theme === 'river') ridge([[0, 0.82], [0.3, 0.74], [0.7, 0.78], [1, 0.72]], shade('#7fb3b8'));
      ridge([[0, 0.88], [0.5, 0.84], [1, 0.9]], shade('#2f4d3e'));
    } else if (theme === 'garden' || theme === 'heritage') {
      ridge([[0, 0.66], [1, 0.62]], shade('#7aa36a'));
      if (theme === 'heritage') {
        g.fillStyle = shade('#c7714a');
        g.fillRect(w * 0.3, h * 0.38, w * 0.4, h * 0.26);
        g.beginPath(); g.arc(w * 0.5, h * 0.38, w * 0.08, Math.PI, 0); g.fill();
      }
      for (let i = 0; i < 9; i++) {
        g.fillStyle = shade(i % 2 ? '#3e6b45' : '#4f7d55');
        g.beginPath(); g.arc(((i * 0.13 + 0.03) % 1) * w, h * (0.6 + (i % 3) * 0.04), 40 + (i % 3) * 14, 0, Math.PI * 2); g.fill();
      }
      ridge([[0, 0.86], [1, 0.84]], shade('#5f8f5a'));
    } else {
      for (let i = 0; i < 16; i++) {
        const bw = 50 + (i % 4) * 14, bh = 120 + ((i * 73) % 160), x = i * 66 - 20;
        g.fillStyle = shade(i % 2 ? '#59628f' : '#3b4370', 0.9);
        g.fillRect(x, horizon + 60 - bh, bw, bh + h);
        for (let r = 0; r < 9; r++) for (let c = 0; c < 3; c++) {
          const lit = (i * 7 + r * 3 + c) % 5 === 0 || day < 0.4 ? ((i + r + c) % 3 !== 0) : false;
          if (!lit) continue;
          g.fillStyle = day < 0.4 ? '#ffd88a' : '#ffffff55';
          g.fillRect(x + 8 + c * 15, horizon + 70 - bh + r * 22, 8, 10);
        }
      }
    }
    viewTex.needsUpdate = true;
    return { day, gold, elev, low };
  }

  const spots = {
    entrance: [[W / 2 - 1.2, 1.6, D / 2 - 0.6], [0, 1.3, -D / 2]],
    window: [[0, 1.55, -D / 2 + 1.8], [0, 1.5, -D / 2 - 1]],
    bed: [[bx + bedL / 2 + 1.4, 1.5, bz + 1.3], [bx - 0.2, 0.7, bz]],
    lounge: [[W / 2 - 1.5, 1.4, 0.6], [W / 2 - 1.5, 0.6, -D / 2 + 1.2]],
  };
  let goal = null;
  controls.minDistance = 0.4;
  controls.maxDistance = Math.min(W, D) * 0.9;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.minPolarAngle = Math.PI * 0.25;
  controls.rotateSpeed = 0.5;
  const keepInside = () => {
    camera.position.x = clamp(camera.position.x, -W / 2 + 0.3, W / 2 - 0.3);
    camera.position.z = clamp(camera.position.z, -D / 2 + 0.3, D / 2 - 0.3);
    camera.position.y = clamp(camera.position.y, 0.6, H - 0.3);
  };
  controls.addEventListener('change', keepInside);

  return {
    setHour(hour) {
      const { day, gold, elev, low } = paint(hour);
      hemi.intensity = 0.25 + 0.9 * day;
      hemi.color.copy(low);
      sun.intensity = Math.max(0, elev) * 3 + gold * 0.6;
      sun.color.set(gold > 0.3 ? 0xffb27a : 0xfff3e0);
      sun.position.set((hour - 12) * 0.5, 1 + Math.max(0, elev) * 4, -D / 2 - 3);
      const lampsOn = day < 0.55;
      lamps.forEach(({ shade, bulb }) => { bulb.intensity = lampsOn ? 2.4 : 0; shade.material.emissiveIntensity = lampsOn ? 1.2 : 0; });
      ceilingLight.intensity = day < 0.35 ? 6 : 0;
    },
    goTo(name, instant) {
      const [pos, target] = spots[name] || spots.entrance;
      goal = { pos: new THREE.Vector3(...pos), target: new THREE.Vector3(...target) };
      if (instant) { camera.position.copy(goal.pos); controls.target.copy(goal.target); goal = null; }
    },
    tick() {
      if (!goal) return;
      camera.position.lerp(goal.pos, 0.08);
      controls.target.lerp(goal.target, 0.08);
      if (camera.position.distanceTo(goal.pos) < 0.01) goal = null;
    },
  };
}
