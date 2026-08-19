// @ts-nocheck
//
// A genuinely walkable 3D interior for the Modern Villa — the "first
// implementation" proof-of-concept for Phase 4's interior system. Rooms,
// walls, furniture and doors are all procedural primitives (PBR-ish
// MeshStandardMaterial, no textures) rather than a loaded GLB, since no
// licensed villa interior asset ships with this project — see
// src/data/modelRegistry.ts (id: "villa-interior") and public/models/README.md.
//
// Runs its own isolated Three.js scene/camera/renderer in a full-screen
// overlay canvas — it does not touch or depend on the main city scene in
// CityVerse.tsx beyond the onExit callback and the hour/weather props used
// to drive lighting.
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ArrowLeft, DoorOpen, MapPin, Navigation } from "lucide-react";
import TouchJoystick from "../controls/TouchJoystick";
import { useKeyboardControls } from "../controls/useKeyboardControls";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- floor plan data ---------------- */
// Wall segments as centerlines; converted to AABBs for collision at setup.
const WALL_SEGMENTS = [
  { x0: -7, z0: -5, x1: -1, z1: -5 },  // south-left (front wall)
  { x0: 1, z0: -5, x1: 7, z1: -5 },    // south-right (front wall, door gap between)
  { x0: -7, z0: 7, x1: 7, z1: 7 },     // north (back wall)
  { x0: -7, z0: -5, x1: -7, z1: 7 },   // west
  { x0: 7, z0: -5, x1: 7, z1: 7 },     // east
  { x0: -7, z0: 4.2, x1: -2, z1: 4.2 },   // hallway divider A
  { x0: -0.7, z0: 4.2, x1: 0.7, z1: 4.2 }, // hallway divider B (between doorways)
  { x0: 2, z0: 4.2, x1: 7, z1: 4.2 },      // hallway divider C
  { x0: 0, z0: 4.2, x1: 0, z1: 7 },        // bedroom / bathroom divider
];

const ROOMS = [
  { id: "living", name: "Living Room", target: { x: -3.5, z: -1 }, look: 0.3 },
  { id: "kitchen", name: "Kitchen", target: { x: 4.5, z: -1 }, look: -0.3 },
  { id: "bedroom", name: "Bedroom", target: { x: -3.5, z: 5.6 }, look: 0 },
  { id: "bathroom", name: "Bathroom", target: { x: 3.5, z: 5.6 }, look: Math.PI },
  { id: "entrance", name: "Entrance", target: { x: 0, z: -3.8 }, look: Math.PI },
];

const DOORS_DEF = [
  { id: "front", hingeX: -1, hingeZ: -5, length: 2, axis: "x", swing: 1 },
  { id: "bedroom", hingeX: -2, hingeZ: 4.2, length: 1.3, axis: "x", swing: -1 },
];

function wallAABB(seg, t = 0.22) {
  return {
    minX: Math.min(seg.x0, seg.x1) - t / 2,
    maxX: Math.max(seg.x0, seg.x1) + t / 2,
    minZ: Math.min(seg.z0, seg.z1) - t / 2,
    maxZ: Math.max(seg.z0, seg.z1) + t / 2,
  };
}
function collides(x, z, walls, r) {
  return walls.some((w) => x + r > w.minX && x - r < w.maxX && z + r > w.minZ && z - r < w.maxZ);
}

/* ---------------- materials ---------------- */
function makeMaterials() {
  return {
    floorWood: new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.55, metalness: 0.04 }),
    floorTile: new THREE.MeshStandardMaterial({ color: 0xcbd2da, roughness: 0.35, metalness: 0.05 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.9, metalness: 0.0 }),
    wallAccent: new THREE.MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.85 }),
    ceiling: new THREE.MeshStandardMaterial({ color: 0xfaf8f4, roughness: 0.95 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.5, metalness: 0.05 }),
    fabricTeal: new THREE.MeshStandardMaterial({ color: 0x2f6f6a, roughness: 0.92, metalness: 0.0 }),
    fabricWarm: new THREE.MeshStandardMaterial({ color: 0xb2673e, roughness: 0.9 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xd7d9dd, roughness: 0.35, metalness: 0.1 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xaeb4bd, roughness: 0.3, metalness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x9fd7f0, roughness: 0.05, metalness: 0.1, transmission: 0.55, transparent: true, opacity: 0.55 }),
    ceramic: new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.25, metalness: 0.05 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.4, metalness: 0.5 }),
  };
}

function box(mat, w, h, d, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(mat, r, h, x, y, z) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------------- furniture builders ---------------- */
function buildSofa(mat, x, z, ry) {
  const g = new THREE.Group();
  g.add(box(mat, 2.2, 0.5, 0.9, 0, 0.28, 0));
  g.add(box(mat, 2.2, 0.6, 0.2, 0, 0.6, -0.35));
  g.add(box(mat, 0.2, 0.55, 0.9, -1.1, 0.5, 0));
  g.add(box(mat, 0.2, 0.55, 0.9, 1.1, 0.5, 0));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}
function buildTable(matTop, matLeg, w, d, h, x, z) {
  const g = new THREE.Group();
  g.add(box(matTop, w, 0.08, d, 0, h, 0));
  const lx = w / 2 - 0.15, lz = d / 2 - 0.15;
  [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(([ox, oz]) => {
    g.add(cyl(matLeg, 0.04, h, ox, h / 2, oz));
  });
  g.position.set(x, 0, z);
  return g;
}
function buildChair(mat, x, z, ry) {
  const g = new THREE.Group();
  g.add(box(mat, 0.42, 0.06, 0.42, 0, 0.45, 0));
  g.add(box(mat, 0.42, 0.5, 0.06, 0, 0.7, -0.2));
  [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([ox, oz]) => {
    g.add(cyl(mat, 0.02, 0.45, ox, 0.22, oz));
  });
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}
function buildBed(matFrame, matFabric, x, z, ry) {
  const g = new THREE.Group();
  g.add(box(matFrame, 2, 0.3, 1.6, 0, 0.15, 0));
  g.add(box(matFabric, 1.9, 0.2, 1.5, 0, 0.4, 0));
  g.add(box(matFabric, 0.5, 0.12, 0.7, -0.6, 0.55, -0.5));
  g.add(box(matFabric, 0.5, 0.12, 0.7, 0.6, 0.55, -0.5));
  g.add(box(matFrame, 2, 0.7, 0.1, 0, 0.55, -0.75));
  g.position.set(x, 0, z); g.rotation.y = ry;
  return g;
}
function buildLamp(matBase, x, z, h = 1.4) {
  const g = new THREE.Group();
  g.add(cyl(matBase, 0.05, h, 0, h / 2, 0));
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xffe8b8, emissive: 0xffb84d, emissiveIntensity: 0.35 }));
  shade.position.set(0, h, 0);
  g.add(shade);
  g.position.set(x, 0, z);
  return g;
}

export default function VillaInterior({ hour, weather, onExit }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const keys = useKeyboardControls();
  const joyRef = useRef({ x: 0, y: 0 });
  const [activeRoom, setActiveRoom] = useState("entrance");
  const [doorPrompt, setDoorPrompt] = useState(null);
  const [minimapTick, setMinimapTick] = useState(0);
  const [ready, setReady] = useState(false);

  const isNight = hour === 5 || hour === 6; // matches TIME_PRESETS night indices (21:00, 00:00)
  const wet = weather === "rain" || weather === "storm";

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth, height = mount.clientHeight;
    const mats = makeMaterials();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isNight ? 0x05070c : 0xcfe4f2);
    const camera = new THREE.PerspectiveCamera(68, width / height, 0.05, 60);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    /* floor + ceiling */
    const floor1 = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), mats.floorWood);
    floor1.rotation.x = -Math.PI / 2; floor1.position.set(0, 0, -1); floor1.receiveShadow = true;
    scene.add(floor1);
    const floor2 = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.8), mats.floorTile);
    floor2.rotation.x = -Math.PI / 2; floor2.position.set(0, 0.002, 5.6); floor2.receiveShadow = true;
    scene.add(floor2);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), mats.ceiling);
    ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, 2.8, 1);
    scene.add(ceiling);

    /* walls (visual, thicker box meshes matching WALL_SEGMENTS) */
    const wallGroup = new THREE.Group();
    WALL_SEGMENTS.forEach((seg) => {
      const len = Math.hypot(seg.x1 - seg.x0, seg.z1 - seg.z0);
      const midX = (seg.x0 + seg.x1) / 2, midZ = (seg.z0 + seg.z1) / 2;
      const isVertical = Math.abs(seg.x1 - seg.x0) < 0.01;
      const w = box(mats.wall, isVertical ? 0.22 : len, 2.8, isVertical ? len : 0.22, midX, 1.4, midZ);
      wallGroup.add(w);
    });
    scene.add(wallGroup);

    /* windows (glass insets on a few exterior walls) */
    const windowMeshes = [];
    [{ x: -7, z: -2, ry: Math.PI / 2 }, { x: -7, z: 5.6, ry: Math.PI / 2 }, { x: 7, z: -1, ry: Math.PI / 2 }].forEach((w) => {
      const pane = box(mats.glass, 1.6, 1.3, 0.05, w.x, 1.5, w.z, w.ry);
      scene.add(pane);
      const outside = box(new THREE.MeshBasicMaterial({ color: isNight ? 0x0a1220 : 0xbfe0f5 }), 1.6, 1.3, 0.02, w.x + (w.x < 0 ? -0.1 : 0.1), 1.5, w.z, w.ry);
      scene.add(outside);
      windowMeshes.push(outside);
    });

    /* doors */
    const doors = DOORS_DEF.map((d) => {
      const pivot = new THREE.Group();
      pivot.position.set(d.hingeX, 0, d.hingeZ);
      const panel = box(mats.wood, d.length, 2.3, 0.08, d.length / 2, 1.15, 0);
      pivot.add(panel);
      scene.add(pivot);
      return { ...d, pivot, open: false, angle: 0, autoCloseAt: 0 };
    });

    /* furniture — living room */
    scene.add(buildSofa(mats.fabricTeal, -5, 0, 0));
    scene.add(buildTable(mats.wood, mats.dark, 1.0, 0.6, 0.38, -3.6, 0.6));
    scene.add(box(mats.dark, 1.6, 0.5, 0.4, -5.6, 0.25, 2.6));
    scene.add(box(mats.dark, 1.2, 0.7, 0.06, -5.6, 0.75, 2.85));
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshStandardMaterial({ color: 0x3a3f52, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-4.3, 0.01, 0.3);
    scene.add(rug);
    scene.add(buildLamp(mats.metal, -6.4, -3.4));

    /* furniture — kitchen + dining */
    scene.add(box(mats.stone, 3.2, 0.9, 0.65, 5, 0.45, 2.6));
    scene.add(box(mats.stone, 0.65, 0.9, 3.2, 6.6, 0.45, 0.5));
    scene.add(box(mats.wall, 3.2, 0.5, 0.4, 5, 2.1, 2.75));
    scene.add(box(mats.metal, 0.7, 1.7, 0.65, 3.8, 0.85, 2.6)); // fridge
    [4.3, 5, 5.7].forEach((bx) => scene.add(cyl(mats.dark, 0.09, 0.02, bx, 0.92, 2.3)));
    scene.add(buildTable(mats.wood, mats.dark, 1.6, 0.9, 0.42, 4.6, -1.4));
    [[-0.9, -0.7, 0], [0.9, -0.7, Math.PI], [0, -0.5, Math.PI / 2], [0, -1.9, -Math.PI / 2]].forEach(([ox, oz, ry]) => {
      scene.add(buildChair(mats.wood, 4.6 + ox, -1.4 + oz, ry));
    });
    scene.add(buildLamp(mats.metal, 6.4, -3.4));

    /* furniture — bedroom */
    scene.add(buildBed(mats.wood, mats.fabricWarm, -4, 6, 0));
    scene.add(box(mats.wood, 0.9, 1.8, 0.5, -6.4, 0.9, 6.6));
    scene.add(box(mats.wood, 0.5, 0.45, 0.4, -2.7, 0.22, 6.7));
    scene.add(buildLamp(mats.metal, -2.7, 6.5, 0.5));

    /* furniture — bathroom */
    scene.add(box(mats.ceramic, 1.2, 0.85, 0.6, 5.6, 0.42, 6.7));
    scene.add(box(mats.metal, 1.0, 0.02, 0.5, 5.6, 0.86, 6.7));
    const mirror = box(new THREE.MeshStandardMaterial({ color: 0xbcd6e0, roughness: 0.05, metalness: 0.6 }), 0.9, 0.7, 0.03, 5.6, 1.6, 6.98);
    scene.add(mirror);
    scene.add(box(mats.ceramic, 1.5, 0.55, 2.6, 2.4, 0.28, 5.8));
    scene.add(cyl(mats.ceramic, 0.22, 0.38, 1.5, 0.19, 6.7));
    scene.add(box(mats.ceramic, 0.34, 0.06, 0.44, 1.5, 0.42, 6.7));

    /* lighting */
    const ambient = new THREE.AmbientLight(0xffffff, isNight ? 0.28 : 0.55);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, isNight ? 0.05 : (wet ? 0.35 : 0.9));
    sun.position.set(-8, 6, -2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    scene.add(sun);

    const lampSpecs = [
      { x: -3.5, z: 0.5, color: 0xffcf94 }, // living pendant
      { x: 5, z: -1.4, color: 0xfff0d0 },   // kitchen pendant
      { x: -3.5, z: 5.8, color: 0xffcf94 }, // bedroom lamp
      { x: 3.2, z: 5.8, color: 0xdff2ff },  // bathroom light
      { x: 0, z: 3.5, color: 0xffe8c8 },    // hallway sconce
    ];
    const pointLights = lampSpecs.map((s) => {
      const pl = new THREE.PointLight(s.color, isNight ? 1.1 : 0, 6, 2.2);
      pl.position.set(s.x, 2.4, s.z);
      pl.castShadow = false;
      scene.add(pl);
      return pl;
    });

    /* player state */
    const walls = WALL_SEGMENTS.map((s) => wallAABB(s));
    const player = { x: 0, z: -3.8, yaw: Math.PI, pitch: 0 };
    let flyToRoom = null;

    let dragging = false, lastX = 0, lastY = 0;
    const dom = renderer.domElement;
    const onDown = (e) => { dragging = true; const p = e.touches ? e.touches[0] : e; lastX = p.clientX; lastY = p.clientY; };
    const onUp = () => { dragging = false; };
    const onMove = (e) => {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - lastX, dy = p.clientY - lastY;
      lastX = p.clientX; lastY = p.clientY;
      player.yaw -= dx * 0.0045;
      player.pitch = clamp(player.pitch - dy * 0.003, -0.5, 0.5);
      flyToRoom = null;
    };
    dom.addEventListener("mousedown", onDown);
    dom.addEventListener("mouseup", onUp);
    dom.addEventListener("mouseleave", onUp);
    dom.addEventListener("mousemove", onMove);
    dom.addEventListener("touchstart", onDown, { passive: true });
    dom.addEventListener("touchend", onUp);
    dom.addEventListener("touchmove", onMove, { passive: true });

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    let raf;
    const clock = new THREE.Clock();
    function animate() {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());

      if (flyToRoom) {
        player.x = lerp(player.x, flyToRoom.x, 0.08);
        player.z = lerp(player.z, flyToRoom.z, 0.08);
        player.yaw = lerp(player.yaw, flyToRoom.look, 0.08);
        if (Math.hypot(player.x - flyToRoom.x, player.z - flyToRoom.z) < 0.15) flyToRoom = null;
      } else {
        const k = keys.current, j = joyRef.current;
        const fwdIn = clamp((k.forward ? 1 : 0) - (k.back ? 1 : 0) - j.y, -1, 1);
        const strafeIn = clamp((k.right ? 1 : 0) - (k.left ? 1 : 0) + j.x, -1, 1);
        if (fwdIn || strafeIn) {
          const speed = 2.6 * dt;
          const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
          const rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
          const dx = (fx * fwdIn + rx * strafeIn) * speed;
          const dz = (fz * fwdIn + rz * strafeIn) * speed;
          const r = 0.32;
          let nx = player.x + dx;
          if (collides(nx, player.z, walls, r)) nx = player.x;
          let nz = player.z + dz;
          if (collides(nx, nz, walls, r)) nz = player.z;
          player.x = clamp(nx, -6.6, 6.6);
          player.z = clamp(nz, -4.6, 6.6);
        }
      }

      // door proximity + animation
      let nearest = null, nearestDist = 999;
      doors.forEach((d) => {
        const dist = Math.hypot(player.x - d.hingeX - (d.axis === "x" ? d.length * 0.4 : 0), player.z - d.hingeZ);
        if (dist < nearestDist) { nearestDist = dist; nearest = d; }
        const targetAngle = d.open ? (d.swing * Math.PI * 0.42) : 0;
        d.angle = lerp(d.angle, targetAngle, 0.12);
        d.pivot.rotation.y = d.angle;
        if (d.open && d.autoCloseAt && performance.now() > d.autoCloseAt) d.open = false;
      });
      if (stateRef.current.setDoorPrompt) stateRef.current.setDoorPrompt(nearestDist < 2.1 ? nearest : null);

      camera.rotation.order = "YXZ";
      camera.position.set(player.x, 1.6, player.z);
      camera.rotation.set(player.pitch, player.yaw, 0);

      renderer.render(scene, camera);
    }
    animate();

    stateRef.current = { ...stateRef.current, scene, camera, renderer, player, doors, pointLights, ambient, sun, windowMeshes, setActiveRoomTarget: (r) => { flyToRoom = { ...r.target, look: r.look }; }, };
    setReady(true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      dom.removeEventListener("mousedown", onDown);
      dom.removeEventListener("mouseup", onUp);
      dom.removeEventListener("mouseleave", onUp);
      dom.removeEventListener("mousemove", onMove);
      dom.removeEventListener("touchstart", onDown);
      dom.removeEventListener("touchend", onUp);
      dom.removeEventListener("touchmove", onMove);
      renderer.dispose();
      if (mount.contains(dom)) mount.removeChild(dom);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep a live setter for the door-proximity prompt reachable from the raf loop
  useEffect(() => { stateRef.current.setDoorPrompt = setDoorPrompt; }, []);

  // minimap position tick (throttled — avoids re-rendering React every frame)
  useEffect(() => {
    const id = setInterval(() => setMinimapTick((t) => t + 1), 180);
    return () => clearInterval(id);
  }, []);

  const player = stateRef.current.player;
  const toggleDoor = (d) => {
    if (!d) return;
    d.open = !d.open;
    d.autoCloseAt = d.open ? performance.now() + 6000 : 0;
  };
  const goToRoom = (room) => {
    setActiveRoom(room.id);
    stateRef.current.setActiveRoomTarget && stateRef.current.setActiveRoomTarget(room);
  };

  const mmScale = 7.2;
  const mmSize = 132;
  const toMm = (x, z) => ({ left: mmSize / 2 + x * mmScale * 0.5, top: mmSize / 2 + (z + 1) * mmScale * 0.5 });
  const mmPlayer = player ? toMm(player.x, player.z) : { left: mmSize / 2, top: mmSize / 2 };

  return (
    <div className="absolute inset-0 z-50 bg-black">
      <div ref={mountRef} className="absolute inset-0" />

      {/* header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10">
        <button onClick={onExit} className="rounded-full px-3 py-2 flex items-center gap-1.5 text-[11px] font-semibold bg-black/60 backdrop-blur border border-white/15 text-white">
          <ArrowLeft size={14} /> Exit Building
        </button>
        <div className="rounded-full px-3 py-1.5 text-[10px] bg-black/60 backdrop-blur border border-white/15 text-slate-300">
          Modern Villa — {ROOMS.find((r) => r.id === activeRoom)?.name || "Interior"}
        </div>
      </div>

      {/* room nav */}
      <div className="absolute top-16 right-4 z-10 flex flex-col gap-1.5 items-end">
        {ROOMS.map((r) => (
          <button key={r.id} onClick={() => goToRoom(r)}
            className={`text-[10px] px-2.5 py-1.5 rounded-full flex items-center gap-1 backdrop-blur border ${activeRoom === r.id ? "bg-cyan-400 text-black border-cyan-300" : "bg-black/55 text-slate-200 border-white/15"}`}>
            <Navigation size={10} /> {r.name}
          </button>
        ))}
      </div>

      {/* minimap */}
      <div className="absolute bottom-24 right-4 z-10 rounded-xl overflow-hidden border border-white/15 bg-black/60 backdrop-blur" style={{ width: mmSize, height: mmSize }}>
        <svg width={mmSize} height={mmSize}>
          <rect x={4} y={4} width={mmSize - 8} height={mmSize * 0.6} fill="#1e293b" opacity={0.7} />
          <rect x={4} y={mmSize * 0.62} width={mmSize - 8} height={mmSize * 0.32} fill="#26313f" opacity={0.7} />
          <circle cx={mmPlayer.left} cy={mmPlayer.top} r={4} fill="#67e8f9" />
        </svg>
        <div className="absolute bottom-1 left-1.5 text-[7px] text-slate-400 flex items-center gap-0.5"><MapPin size={8} /> Minimap</div>
      </div>

      {/* door prompt */}
      {doorPrompt && (
        <button
          onClick={() => toggleDoor(doorPrompt)}
          className="absolute left-1/2 -translate-x-1/2 bottom-40 z-10 rounded-full px-4 py-2 text-[11px] font-semibold bg-white text-black flex items-center gap-1.5 shadow-lg"
        >
          <DoorOpen size={13} /> {doorPrompt.open ? "Close Door" : "Open Door"}
        </button>
      )}

      {/* mobile joystick */}
      <div className="absolute bottom-6 left-5 z-10 sm:hidden">
        <TouchJoystick onChange={(v) => { joyRef.current = v; }} />
      </div>

      <div className="absolute bottom-6 left-5 z-10 hidden sm:block text-[9px] text-slate-400 bg-black/50 rounded-lg px-2 py-1 backdrop-blur">
        WASD to move · drag to look
      </div>
    </div>
  );
}
