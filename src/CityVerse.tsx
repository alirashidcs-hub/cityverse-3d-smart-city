// @ts-nocheck
//
// This file is a straight port of the original single-file artifact
// prototype, now carrying the Phase 3 visual upgrade. It leans on
// loosely-typed refs (stateRef.current holds a grab-bag of Three.js
// objects) — fine in plain JS but noisy to fully type without real payoff
// yet. `@ts-nocheck` keeps the build green while this moves fast; see
// docs/architecture.md for the plan to split this into typed modules.
// `npm run build` still runs tsc for every OTHER file.
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import VillaInterior from "./3d/interiors/VillaInterior";
import {
  Building2, MapPin, Zap, Droplets, Wind, Car, Layers as LayersIcon,
  Clock, CloudRain, Sparkles, X, ChevronRight, AlertTriangle, Send,
  BarChart3, Gauge, Sun, Cloud, CloudFog, Moon, CloudLightning, Flame,
  SlidersHorizontal, HardHat, Ban, Route, Eye, DoorOpen, ArrowLeft,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line,
  CartesianGrid, Tooltip as RTooltip,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Deterministic PRNG so the "city" is stable across renders           */
/* ------------------------------------------------------------------ */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const lerp = (a, b, t) => a + (b - a) * t;

const DISTRICTS = [
  { id: "downtown", name: "Downtown", cx: 0, cz: 0, hw: 20, hd: 20, hMin: 22, hMax: 58, count: 34, color: "#22d3ee", camR: 55 },
  { id: "residential", name: "Residential", cx: 0, cz: -48, hw: 46, hd: 18, hMin: 4, hMax: 11, count: 42, color: "#3b82f6", camR: 60 },
  { id: "commercial", name: "Commercial", cx: 46, cz: 8, hw: 22, hd: 26, hMin: 10, hMax: 26, count: 26, color: "#818cf8", camR: 55 },
  { id: "industrial", name: "Industrial", cx: -46, cz: 20, hw: 22, hd: 22, hMin: 6, hMax: 15, count: 20, color: "#f59e0b", camR: 55 },
  { id: "university", name: "University", cx: -40, cz: -38, hw: 18, hd: 16, hMin: 8, hMax: 17, count: 14, color: "#a855f7", camR: 45 },
  { id: "airport", name: "Airport", cx: 48, cz: -42, hw: 22, hd: 14, hMin: 5, hMax: 12, count: 6, color: "#94a3b8", camR: 55 },
  { id: "hospital", name: "Hospital District", cx: 16, cz: 18, hw: 8, hd: 8, hMin: 12, hMax: 20, count: 3, color: "#ef4444", camR: 30 },
  { id: "shopping", name: "Shopping District", cx: 36, cz: 36, hw: 16, hd: 14, hMin: 8, hMax: 15, count: 15, color: "#10b981", camR: 45 },
];

const PARKS = [
  { x: 0, z: 26, w: 16, d: 11 },
  { x: -18, z: 4, w: 8, d: 8 },
  { x: 24, z: -12, w: 9, d: 9 },
  { x: -8, z: -60, w: 10, d: 8 },
];

const BUILDING_NAMES = ["Meridian", "Zenith", "Aurora", "Solace", "Vertex", "Halcyon", "Obsidian", "Lumen", "Cascade", "Nimbus", "Kepler", "Ridgeline", "Prism", "Foundry", "Beacon", "Concord", "Ironwood", "Skyline", "Wren", "Aster"];
const STATUSES = ["Operational", "Operational", "Operational", "Maintenance", "Operational"];
const BRICK_TONES = ["#8b4a3a", "#a55b42", "#7a4030", "#96543f"];

/* ------------------------------------------------------------------ */
/* Building archetypes — every archetype is a small set of "parts",   */
/* each an InstancedMesh shared across every building of that type.   */
/* Coordinates are fractions of the building's own (w, h, d):         */
/*   y0     = fraction of height where the part's bottom sits         */
/*   hFrac  = fraction of height the part occupies                    */
/*   wFrac  = fraction of width used for the part's horizontal extent */
/*   dFrac  = fraction of depth                                       */
/*   colorMul = brightness multiplier applied to the building's tint  */
/* This keeps building-part draw calls at ~1 per (archetype × part),  */
/* not one per building — see docs/architecture.md perf notes below.  */
/* ------------------------------------------------------------------ */
const ARCHETYPES = {
  tower: [
    { key: "podium", geo: "box", y0: 0, hFrac: 0.06, wFrac: 1.25, dFrac: 1.25, colorMul: 0.5, rough: 0.6, metal: 0.15 },
    { key: "body", geo: "box", y0: 0.06, hFrac: 0.82, wFrac: 1, dFrac: 1, colorMul: 1.0, rough: 0.12, metal: 0.65 },
    { key: "crown", geo: "box", y0: 0.88, hFrac: 0.09, wFrac: 0.6, dFrac: 0.6, colorMul: 0.8, rough: 0.3, metal: 0.4 },
    { key: "antenna", geo: "cyl", y0: 0.97, hFrac: 0.15, wFrac: 0.045, dFrac: 0.045, colorMul: 1.4, rough: 0.4, metal: 0.8 },
  ],
  office: [
    { key: "body", geo: "box", y0: 0, hFrac: 0.92, wFrac: 1, dFrac: 1, colorMul: 0.92, rough: 0.2, metal: 0.5 },
    { key: "parapet", geo: "box", y0: 0.92, hFrac: 0.05, wFrac: 1.03, dFrac: 1.03, colorMul: 0.65, rough: 0.6, metal: 0.1 },
    { key: "ac", geo: "box", y0: 0.97, hFrac: 0.05, wFrac: 0.2, dFrac: 0.2, colorMul: 0.55, rough: 0.7, metal: 0.4 },
  ],
  house: [
    { key: "base", geo: "box", y0: 0, hFrac: 0.6, wFrac: 1, dFrac: 1, colorMul: 1.0, rough: 0.85, metal: 0.02 },
    { key: "roof", geo: "pyramid", y0: 0.6, hFrac: 0.38, wFrac: 1.12, dFrac: 1.12, colorMul: 0.55, rough: 0.7, metal: 0.05 },
    { key: "chimney", geo: "box", y0: 0.82, hFrac: 0.2, wFrac: 0.09, dFrac: 0.09, colorMul: 0.45, rough: 0.8, metal: 0.0 },
  ],
  apartment: [
    { key: "base", geo: "box", y0: 0, hFrac: 0.9, wFrac: 1, dFrac: 1, colorMul: 0.95, rough: 0.8, metal: 0.03 },
    { key: "roof", geo: "box", y0: 0.9, hFrac: 0.06, wFrac: 1.04, dFrac: 1.04, colorMul: 0.6, rough: 0.7, metal: 0.05 },
    { key: "balcony", geo: "box", y0: 0.12, hFrac: 0.55, wFrac: 0.06, dFrac: 1.08, colorMul: 0.5, rough: 0.6, metal: 0.3 },
  ],
  mall: [
    { key: "base", geo: "box", y0: 0, hFrac: 0.55, wFrac: 1, dFrac: 1, colorMul: 0.85, rough: 0.55, metal: 0.15 },
    { key: "roof", geo: "box", y0: 0.55, hFrac: 0.07, wFrac: 1.05, dFrac: 1.05, colorMul: 0.6, rough: 0.6, metal: 0.1 },
    { key: "sign", geo: "box", y0: 0.62, hFrac: 0.13, wFrac: 0.5, dFrac: 0.05, colorMul: 1.5, rough: 0.4, metal: 0.1 },
  ],
  warehouse: [
    { key: "base", geo: "box", y0: 0, hFrac: 0.85, wFrac: 1, dFrac: 1, colorMul: 0.8, rough: 0.75, metal: 0.35 },
    { key: "ridge", geo: "box", y0: 0.85, hFrac: 0.1, wFrac: 0.9, dFrac: 0.32, colorMul: 0.6, rough: 0.7, metal: 0.3 },
    { key: "vent", geo: "cyl", y0: 0.95, hFrac: 0.09, wFrac: 0.09, dFrac: 0.09, colorMul: 0.95, rough: 0.5, metal: 0.5 },
  ],
  campus: [
    { key: "base", geo: "box", y0: 0, hFrac: 0.68, wFrac: 1, dFrac: 1, colorMul: 0.9, rough: 0.75, metal: 0.05 },
    { key: "roof", geo: "box", y0: 0.68, hFrac: 0.06, wFrac: 1.06, dFrac: 1.06, colorMul: 0.62, rough: 0.7, metal: 0.05 },
    { key: "entrance", geo: "box", y0: 0, hFrac: 0.34, wFrac: 0.22, dFrac: 1.18, colorMul: 0.5, rough: 0.6, metal: 0.1 },
  ],
  terminal: [
    { key: "base", geo: "box", y0: 0, hFrac: 0.4, wFrac: 1.3, dFrac: 0.9, colorMul: 0.85, rough: 0.4, metal: 0.4 },
    { key: "roof", geo: "box", y0: 0.4, hFrac: 0.06, wFrac: 1.35, dFrac: 0.95, colorMul: 0.6, rough: 0.5, metal: 0.3 },
    { key: "tower", geo: "cyl", y0: 0.4, hFrac: 0.6, wFrac: 0.14, dFrac: 0.14, colorMul: 1.1, rough: 0.3, metal: 0.5 },
  ],
  hospital: [
    { key: "base", geo: "box", y0: 0, hFrac: 0.85, wFrac: 1, dFrac: 1, colorMul: 0.95, rough: 0.65, metal: 0.05 },
    { key: "roof", geo: "box", y0: 0.85, hFrac: 0.05, wFrac: 1.04, dFrac: 1.04, colorMul: 0.75, rough: 0.6, metal: 0.05 },
    { key: "sign", geo: "box", y0: 0.9, hFrac: 0.1, wFrac: 0.28, dFrac: 0.06, colorMul: 1.0, rough: 0.3, metal: 0.1 },
  ],
};

function nearestRoadsFor(d, n, roads) {
  return roads
    .map((r, i) => ({ i, dist: r.axis === "x" ? Math.abs(r.pos - d.cz) : Math.abs(r.pos - d.cx) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n)
    .map((x) => x.i);
}

function archetypeFor(districtId, rand) {
  switch (districtId) {
    case "downtown": return rand() < 0.7 ? "tower" : "office";
    case "residential": return rand() < 0.55 ? "house" : "apartment";
    case "commercial": return rand() < 0.5 ? "office" : "mall";
    case "industrial": return "warehouse";
    case "university": return "campus";
    case "airport": return "terminal";
    case "hospital": return "hospital";
    case "shopping": return "mall";
    default: return "office";
  }
}

function archTint(b) {
  if (b.archetype === "hospital") return "#e8edf3";
  if (b.archetype === "warehouse") return "#7a8390";
  if (b.archetype === "terminal") return "#9fb0c4";
  if (b.archetype === "apartment") return b.brickTone || "#8b4a3a";
  return b.baseColor;
}

const INTERIOR_PRESETS = {
  house: {
    title: "Residence — Ground Floor",
    rooms: [
      { name: "Living Room", items: ["Sofa", "TV Console", "Coffee Table"], color: "#f59e0b" },
      { name: "Kitchen", items: ["Counter", "Island", "Fridge"], color: "#22d3ee" },
      { name: "Bedroom", items: ["Bed", "Wardrobe", "Desk"], color: "#a855f7" },
      { name: "Bathroom", items: ["Sink", "Shower"], color: "#3b82f6" },
    ],
  },
  tower: {
    title: "Landmark Tower — Lobby & Office Floor",
    rooms: [
      { name: "Reception", items: ["Front Desk", "Waiting Seats", "Digital Directory"], color: "#22d3ee" },
      { name: "Open Workstations", items: ["Desks ×24", "Breakout Pods"], color: "#3b82f6" },
      { name: "Meeting Room", items: ["Conference Table", "Display Screen"], color: "#a855f7" },
      { name: "Executive Suite", items: ["Desk", "Lounge Seating", "City View"], color: "#f59e0b" },
    ],
  },
  hospital: {
    title: "Medical Center — Ground Floor",
    rooms: [
      { name: "Reception", items: ["Check-in Desk", "Waiting Area"], color: "#22d3ee" },
      { name: "Emergency Wing", items: ["Triage Bay", "Trauma Room"], color: "#ef4444" },
      { name: "Patient Rooms", items: ["Beds ×12", "Nurse Station"], color: "#3b82f6" },
      { name: "Pharmacy", items: ["Dispensary Counter"], color: "#34d399" },
    ],
  },
  university: {
    title: "Campus Hall — Main Floor",
    rooms: [
      { name: "Classroom", items: ["Lecture Seating", "Projector"], color: "#a855f7" },
      { name: "Laboratory", items: ["Lab Benches", "Equipment Racks"], color: "#22d3ee" },
      { name: "Library", items: ["Reading Tables", "Stacks"], color: "#f59e0b" },
    ],
  },
};

function generateCity(seed = 1337) {
  const rand = mulberry32(seed);
  const buildings = [];
  let id = 0;
  let firstHouse = null, firstHospital = null, firstSchool = null;
  DISTRICTS.forEach((d) => {
    for (let i = 0; i < d.count; i++) {
      const x = d.cx + (rand() - 0.5) * d.hw * 2;
      const z = d.cz + (rand() - 0.5) * d.hd * 2;
      const inPark = PARKS.some((p) => Math.abs(x - p.x) < p.w && Math.abs(z - p.z) < p.d);
      if (inPark) continue;
      const h = d.hMin + rand() * (d.hMax - d.hMin);
      const w = 2.2 + rand() * 2.2;
      const dep = 2.2 + rand() * 2.2;
      const isHospital = d.id === "hospital";
      const isSchool = d.id === "university" && i === 0;
      const archetype = archetypeFor(d.id, rand);
      const energy = Math.round((h * w * dep) * (0.8 + rand() * 1.6));
      const tint = new THREE.Color(d.color).offsetHSL(0, 0, (rand() - 0.5) * 0.14).getStyle();
      const b = {
        id: id++,
        x, z, w, h, d: dep,
        district: d.name,
        districtId: d.id,
        baseColor: tint,
        archetype,
        brickTone: archetype === "apartment" ? BRICK_TONES[Math.floor(rand() * BRICK_TONES.length)] : null,
        name: `${BUILDING_NAMES[Math.floor(rand() * BUILDING_NAMES.length)]} ${isHospital ? "Medical Center" : isSchool ? "Hall" : "Tower"} ${Math.floor(rand() * 90 + 10)}`,
        floors: Math.max(1, Math.round(h / 3.4)),
        occupancy: Math.round(40 + rand() * 58),
        energy,
        water: Math.round(200 + rand() * 1800),
        year: Math.round(1978 + rand() * 46),
        status: isHospital ? "Operational" : STATUSES[Math.floor(rand() * STATUSES.length)],
        isHospital, isSchool,
        carbon: Math.round(energy * 0.42),
        solar: Math.round(rand() * 30),
        hasInterior: false,
        interiorKind: null,
      };
      if (archetype === "house" && !firstHouse) firstHouse = b;
      if (isHospital && !firstHospital) firstHospital = b;
      if (isSchool && !firstSchool) firstSchool = b;
      buildings.push(b);
    }
  });
  [ [firstHouse, "house"], [firstHospital, "hospital"], [firstSchool, "university"] ].forEach(([b, kind]) => {
    if (b) { b.hasInterior = true; b.interiorKind = kind; }
  });

  const roads = [];
  const rtrand = mulberry32(seed + 99);
  for (let v = -60; v <= 60; v += 10) {
    roads.push({ axis: "x", pos: v, len: 130, traffic: rtrand() });
    roads.push({ axis: "z", pos: v, len: 130, traffic: rtrand() });
  }

  return { buildings, roads };
}

const TRAFFIC_COLORS = [
  [0.10, "#22c55e"], [0.35, "#eab308"], [0.65, "#f97316"], [1.01, "#ef4444"],
];
function trafficColor(level) {
  for (const [t, c] of TRAFFIC_COLORS) if (level <= t) return c;
  return "#ef4444";
}
function trafficLabel(level) {
  if (level <= 0.1) return "Low";
  if (level <= 0.35) return "Moderate";
  if (level <= 0.65) return "Heavy";
  return "Severe";
}

const TIME_PRESETS = [
  { h: 6, label: "06:00", sky: 0x2a2440, ambient: 0x4a3a5a, ambientI: 0.55, sun: 0xffab73, sunI: 1.1, night: false },
  { h: 9, label: "09:00", sky: 0x8fb8e0, ambient: 0xcfe0f5, ambientI: 0.9, sun: 0xfff3d6, sunI: 1.6, night: false },
  { h: 12, label: "12:00", sky: 0x9fd0f0, ambient: 0xffffff, ambientI: 1.05, sun: 0xffffff, sunI: 1.9, night: false },
  { h: 15, label: "15:00", sky: 0x8fc3ec, ambient: 0xffe9c9, ambientI: 0.95, sun: 0xffe3b0, sunI: 1.6, night: false },
  { h: 18, label: "18:00", sky: 0x3a2a55, ambient: 0xff9d6c, ambientI: 0.7, sun: 0xff7a4d, sunI: 1.3, night: false },
  { h: 21, label: "21:00", sky: 0x05070f, ambient: 0x1a2140, ambientI: 0.35, sun: 0x4a6bdb, sunI: 0.35, night: true },
  { h: 0, label: "00:00", sky: 0x02030a, ambient: 0x0e1430, ambientI: 0.22, sun: 0x2a3a80, sunI: 0.15, night: true },
];

const WEATHER_MODES = [
  { id: "clear", label: "Clear", icon: Sun, fog: 0x0a0e1a, density: 0.0015 },
  { id: "cloudy", label: "Cloudy", icon: Cloud, fog: 0x2a3140, density: 0.004 },
  { id: "rain", label: "Rain", icon: CloudRain, fog: 0x1a2230, density: 0.008 },
  { id: "storm", label: "Storm", icon: CloudLightning, fog: 0x141a26, density: 0.012 },
  { id: "fog", label: "Fog", icon: CloudFog, fog: 0x8892a0, density: 0.028 },
];

const AQI_LEVELS = [
  { max: 50, label: "Good", color: "#10b981" },
  { max: 100, label: "Moderate", color: "#eab308" },
  { max: 150, label: "Unhealthy", color: "#f97316" },
  { max: 200, label: "Very Unhealthy", color: "#ef4444" },
  { max: 999, label: "Hazardous", color: "#7c1fae" },
];

const SIM_DEFAULT = { traffic: 50, population: 50, energy: 50, water: 50, transport: 50, construction: 0, weatherSeverity: 0 };

const DRAG_CHIPS = [
  { id: "traffic30", label: "Traffic +30%", key: "traffic", delta: 30, color: "#f97316" },
  { id: "pop20", label: "Population +20%", key: "population", delta: 20, color: "#3b82f6" },
  { id: "energy25", label: "Energy +25%", key: "energy", delta: 25, color: "#eab308" },
  { id: "transportNeg15", label: "Transport -15%", key: "transport", delta: -15, color: "#10b981" },
];

const EMERGENCY_IMPACT = {
  Fire: { radius: 12, popFactor: 45, infra: "Power lines, nearby structures", response: "Dispatch 2 fire units, evacuate 150m radius" },
  Flood: { radius: 18, popFactor: 60, infra: "Roads, basements, water treatment", response: "Deploy pumps, close low-lying roads" },
  "Traffic accident": { radius: 6, popFactor: 8, infra: "Adjacent road segment", response: "Dispatch traffic unit, reroute nearby roads" },
  "Power outage": { radius: 14, popFactor: 70, infra: "Electrical grid, traffic signals", response: "Dispatch grid repair crew, activate backup generators" },
  "Water leak": { radius: 9, popFactor: 20, infra: "Water main, nearby roads", response: "Dispatch water utility crew, shut off local valve" },
};
const EMERGENCY_ICONS = { Fire: Flame, Flood: Droplets, "Traffic accident": Car, "Power outage": Zap, "Water leak": Droplets };

/* ------------------------------------------------------------------ */
/* Canvas-generated textures — cheap, no network fetch, no external    */
/* asset licensing concerns. See the README section this PR adds for  */
/* how to swap these (or the procedural buildings) for real GLTF/GLB. */
/* ------------------------------------------------------------------ */
function makeAsphaltTexture() {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#22262d"; ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const v = 20 + Math.random() * 18;
    ctx.fillStyle = `rgba(${v + 10},${v + 10},${v + 14},${0.15 + Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1.4, 1.4);
  }
  return new THREE.CanvasTexture(c);
}
function makeLaneTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(24, 4, 16, 30);
  return new THREE.CanvasTexture(c);
}
function makeTerrainTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0d2415"; ctx.fillRect(0, 0, 512, 512);
  const toPx = (world) => (world + 130) * (512 / 260);
  const zone = (cx, cz, hw, hd, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(toPx(cx - hw), toPx(cz - hd), (hw * 2) * (512 / 260), (hd * 2) * (512 / 260));
  };
  zone(0, 0, 26, 26, "#12161d");
  zone(46, 8, 28, 32, "#151a22");
  zone(-46, 20, 28, 28, "#191d24");
  zone(48, -42, 30, 20, "#20222a");
  zone(0, -48, 50, 22, "#153a22");
  zone(-40, -38, 22, 20, "#123420");
  zone(36, 36, 20, 18, "#151a22");
  for (let i = 0; i < 4000; i++) {
    const v = Math.random() * 10 - 5;
    ctx.fillStyle = `rgba(${20 + v},${60 + v},${35 + v},0.25)`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
  }
  return new THREE.CanvasTexture(c);
}

/* Phase 3 shipped a one-off inline GLTF scaffold here. Phase 4 replaced it */
/* with the proper centralized system: src/data/modelRegistry.ts (every    */
/* known model slot, with license/availability tracking) and              */
/* src/3d/assets/assetLoader.ts (loadRegisteredModel(id) — returns null    */
/* and lets the caller fall back to procedural geometry when an entry     */
/* isn't marked `available`). See those files, and README.md → "Adding    */
/* your own 3D models", for how to wire a real .glb into the archetype    */
/* system or the villa/hospital/university/landmark buildings.            */

/* ------------------------------------------------------------------ */

export default function CityVerse() {
  const [screen, setScreen] = useState("landing");
  return screen === "landing" ? (
    <Landing onEnter={() => setScreen("city")} />
  ) : (
    <CityApp />
  );
}

/* ============================== LANDING ============================== */
function Landing({ onEnter }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setPhase(1), 200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white font-sans select-none">
      <style>{`
        @keyframes drift { 0%{transform:translateY(0) scale(1)} 100%{transform:translateY(-40px) scale(1.06)} }
        @keyframes riseIn { 0%{opacity:0; transform:translateY(24px)} 100%{opacity:1; transform:translateY(0)} }
        @keyframes gridPan { 0%{background-position:0 0} 100%{background-position:0 120px} }
      `}</style>
      <div className="absolute inset-0" style={{
        background: "radial-gradient(circle at 50% 20%, #0d2440 0%, #060912 55%, #000000 100%)",
      }} />
      <div className="absolute inset-0 opacity-70" style={{
        backgroundImage: "radial-gradient(1px 1px at 20% 30%, #fff 100%, transparent), radial-gradient(1px 1px at 70% 15%, #fff 100%, transparent), radial-gradient(1px 1px at 85% 55%, #fff 100%, transparent), radial-gradient(1px 1px at 40% 70%, #fff 100%, transparent), radial-gradient(1px 1px at 60% 40%, #fff 100%, transparent)",
        backgroundSize: "cover",
      }} />
      <div className="absolute bottom-0 left-0 right-0 h-[42%]" style={{ animation: "drift 14s ease-in-out infinite alternate" }}>
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="sky-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#04060c" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="1" />
            </linearGradient>
          </defs>
          {Array.from({ length: 26 }).map((_, i) => {
            const w = 8 + (i % 5) * 2;
            const h = 20 + ((i * 37) % 70);
            const x = i * 16 - 10;
            return <rect key={i} x={x} y={100 - h} width={w} height={h} fill="#0a1120" />;
          })}
          <rect x="0" y="0" width="400" height="100" fill="url(#sky-fade)" />
        </svg>
        <div className="absolute inset-0" style={{
          backgroundImage: "repeating-linear-gradient(90deg, rgba(34,211,238,0.06) 0 1px, transparent 1px 40px)",
        }} />
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 opacity-40" style={{
        backgroundImage: "linear-gradient(rgba(34,211,238,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.35) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        transform: "perspective(220px) rotateX(60deg)",
        transformOrigin: "bottom",
        animation: "gridPan 3s linear infinite",
        maskImage: "linear-gradient(to top, black, transparent)",
      }} />

      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 text-center">
        <div style={{ opacity: phase ? 1 : 0, animation: phase ? "riseIn .9s ease-out" : "none" }}>
          <div className="flex items-center justify-center gap-2 mb-4 text-cyan-300/90 tracking-[0.3em] text-[10px] font-medium">
            <Sparkles size={12} /> AI-POWERED DIGITAL TWIN
          </div>
          <h1 className="text-4xl leading-tight font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}>
            Explore the<br />
            <span className="bg-gradient-to-r from-cyan-300 via-sky-300 to-purple-400 bg-clip-text text-transparent">
              Future of Cities.
            </span>
          </h1>
          <p className="mt-4 text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
            An interactive digital twin that lets you understand, monitor, and simulate an entire smart city.
          </p>
          <button
            onClick={onEnter}
            className="mt-8 group relative inline-flex items-center gap-2 px-7 py-3 rounded-full font-semibold text-sm text-black bg-gradient-to-r from-cyan-300 to-sky-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] active:scale-95 transition-transform"
          >
            Enter City <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
          <div className="mt-3 text-[10px] text-slate-500">Demo data — no real-world sensors connected</div>
        </div>
      </div>
    </div>
  );
}

/* ============================== CITY APP ============================== */
function CityApp() {
  const mountRef = useRef(null);
  const stateRef = useRef({});
  const districtRefs = useRef({});
  const [ready, setReady] = useState(false);

  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [energyMode, setEnergyMode] = useState(false);
  const [interiorView, setInteriorView] = useState(null);
  const [villaOpen, setVillaOpen] = useState(false);
  const [villaFade, setVillaFade] = useState(false);
  const [streetLevel, setStreetLevel] = useState(false);
  const [hour, setHour] = useState(2);
  const [weather, setWeather] = useState("clear");
  const [layers, setLayers] = useState({ buildings: true, roads: true, traffic: true, parks: true, water: true, energy: false, emergency: false });
  const [panel, setPanel] = useState(null);
  const [emergency, setEmergency] = useState(null);
  const [pendingEmergencyType, setPendingEmergencyType] = useState("Fire");
  const [aiMessages, setAiMessages] = useState([
    { role: "assistant", text: "I'm the CityVerse assistant. Ask me about traffic, energy, air quality, or run a simulation and I'll analyze the results." },
  ]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const [simMode, setSimMode] = useState(false);
  const [simParams, setSimParams] = useState(SIM_DEFAULT);
  const [baseline, setBaseline] = useState(null);
  const [tool, setTool] = useState("none");
  const [roadClosures, setRoadClosures] = useState(() => new Set());
  const [roadClosurePending, setRoadClosurePending] = useState(null);
  const [constructionZones, setConstructionZones] = useState([]);
  const [districtBoosts, setDistrictBoosts] = useState({});
  const [impactResult, setImpactResult] = useState(null);
  const [dragChip, setDragChip] = useState(null);
  const [lightningFlash, setLightningFlash] = useState(false);

  const cityData = useRef(generateCity(2026)).current;
  const districtRoadMap = {};
  DISTRICTS.forEach((d) => { districtRoadMap[d.id] = nearestRoadsFor(d, 3, cityData.roads); });

  const LANDMARK = useRef({
    id: -1, x: 0, z: 0, name: "CityVerse Tower — Landmark", district: "Downtown",
    floors: 62, occupancy: 88, energy: 9800, water: 3200, year: 2024,
    status: "Operational", baseColor: "#7dd3fc", hasInterior: true, interiorKind: "tower",
    carbon: 4100, solar: 210, w: 8, h: 92, d: 8,
  }).current;

  /* ---------- three.js setup (runs once) ---------- */
  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth, height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    /* ---------------- terrain ---------------- */
    const terrainTex = makeTerrainTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ map: terrainTex, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const grid = new THREE.GridHelper(260, 52, 0x1c2a3f, 0x121a28);
    grid.position.y = 0.002;
    grid.material.opacity = 0.35; grid.material.transparent = true;
    scene.add(grid);

    /* ---------------- lights ---------------- */
    const ambient = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(60, 90, 40);
    scene.add(sun);
    const hemi = new THREE.HemisphereLight(0x88aaff, 0x0a0a12, 0.4);
    scene.add(hemi);

    /* ---------------- unit geometries (shared, centered at origin) ---------------- */
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const unitCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    const unitPyramid = new THREE.ConeGeometry(0.5, 1, 4);
    const unitSphere = new THREE.SphereGeometry(0.5, 10, 8);
    const unitWindow = new THREE.BoxGeometry(0.3, 0.42, 0.03);

    /* ---------------- buildings: archetype part meshes ---------------- */
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    const archMeshes = {};
    const pickMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), Math.max(1, cityData.buildings.length));
    pickMesh.count = cityData.buildings.length;
    cityData.buildings.forEach((b, i) => {
      dummy.position.set(b.x, b.h / 2, b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(b.w, b.h, b.d);
      dummy.updateMatrix();
      pickMesh.setMatrixAt(i, dummy.matrix);
    });
    scene.add(pickMesh);

    Object.keys(ARCHETYPES).forEach((archKey) => {
      const parts = ARCHETYPES[archKey];
      const matching = cityData.buildings.filter((b) => b.archetype === archKey);
      archMeshes[archKey] = {};
      parts.forEach((part) => {
        const geo = part.geo === "cyl" ? unitCyl : part.geo === "pyramid" ? unitPyramid : unitBox;
        const mat = new THREE.MeshStandardMaterial({ roughness: part.rough, metalness: part.metal, vertexColors: true });
        const count = Math.max(1, matching.length);
        const mesh = new THREE.InstancedMesh(geo, mat, count);
        mesh.count = matching.length;
        matching.forEach((b, i) => {
          const w = b.w * part.wFrac, h = b.h * part.hFrac, d = b.d * part.dFrac;
          dummy.position.set(b.x, (part.y0 + part.hFrac / 2) * b.h, b.z);
          dummy.rotation.set(0, part.geo === "pyramid" ? Math.PI / 4 : 0, 0);
          dummy.scale.set(w, h, d);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          tmpColor.set(archTint(b)).multiplyScalar(part.colorMul);
          if (archKey === "hospital" && part.key === "sign") tmpColor.set("#ef4444");
          if (archKey === "mall" && part.key === "sign") tmpColor.set(archTint(b)).offsetHSL(0, 0.1, 0.15);
          mesh.setColorAt(i, tmpColor);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        scene.add(mesh);
        archMeshes[archKey][part.key] = mesh;
      });
    });

    /* ---------------- windows ---------------- */
    const windows = [];
    cityData.buildings.forEach((b) => {
      if (b.archetype === "terminal") return;
      const rows = clamp(Math.round(b.floors * 0.55), 1, 9);
      const colsFront = clamp(Math.round(b.w / 1.3), 1, 6);
      const colsSide = clamp(Math.round(b.d / 1.3), 1, 6);
      const faces = [
        { axis: "z", sign: 1, cols: colsFront },
        { axis: "z", sign: -1, cols: colsFront },
        { axis: "x", sign: 1, cols: colsSide },
        { axis: "x", sign: -1, cols: colsSide },
      ];
      faces.forEach((face) => {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < face.cols; c++) {
            const ty = ((r + 0.5) / rows) * b.h * 0.78 + b.h * 0.08;
            const along = (c + 0.5) / face.cols - 0.5;
            let wx, wz, rotY;
            if (face.axis === "z") {
              wx = b.x + along * b.w * 0.82; wz = b.z + face.sign * (b.d / 2 + 0.025); rotY = 0;
            } else {
              wx = b.x + face.sign * (b.w / 2 + 0.025); wz = b.z + along * b.d * 0.82; rotY = Math.PI / 2;
            }
            windows.push({ x: wx, y: ty, z: wz, rotY, isLit: Math.random() < 0.36, warm: Math.random() < 0.6 });
          }
        }
      });
    });
    const windowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const windowMesh = new THREE.InstancedMesh(unitWindow, windowMat, Math.max(1, windows.length));
    windowMesh.count = windows.length;
    windows.forEach((win, i) => {
      dummy.position.set(win.x, win.y, win.z);
      dummy.rotation.set(0, win.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      windowMesh.setMatrixAt(i, dummy.matrix);
      windowMesh.setColorAt(i, new THREE.Color("#0e2a3d"));
    });
    windowMesh.instanceMatrix.needsUpdate = true;
    scene.add(windowMesh);

    /* ---------------- selection highlight ---------------- */
    const selectionBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0x67e8f9 })
    );
    selectionBox.visible = false;
    scene.add(selectionBox);

    /* ---------------- landmark (custom, one-off) ---------------- */
    const landmarkGroup = new THREE.Group();
    {
      const tiers = [
        { y0: 0, h: 8, w: 9, mat: 0.5 },
        { y0: 8, h: 30, w: 7.4, mat: 0.7 },
        { y0: 38, h: 30, w: 5.6, mat: 0.85 },
        { y0: 68, h: 20, w: 3.8, mat: 1.0 },
      ];
      tiers.forEach((t) => {
        const m = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.08, metalness: 0.75 }));
        m.scale.set(t.w, t.h, t.w);
        m.position.set(0, t.y0 + t.h / 2, 0);
        landmarkGroup.add(m);
        const bandCount = Math.max(2, Math.floor(t.h / 6));
        for (let i = 1; i < bandCount; i++) {
          const band = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0x22d3ee }));
          band.scale.set(t.w + 0.06, 0.12, t.w + 0.06);
          band.position.set(0, t.y0 + (t.h / bandCount) * i, 0);
          landmarkGroup.add(band);
        }
      });
      const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 12, 8), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.2, metalness: 0.9 }));
      spire.scale.set(1.4, 1, 1.4);
      spire.position.set(0, 88 + 6, 0);
      landmarkGroup.add(spire);
      const plaza = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0x1c2333, roughness: 0.8 }));
      plaza.position.set(0, 0.15, 0);
      landmarkGroup.add(plaza);
      const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.6, 24), new THREE.MeshStandardMaterial({ color: 0x22303f, roughness: 0.6 }));
      fountainBase.position.set(0, 0.45, 0);
      landmarkGroup.add(fountainBase);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.08, 24), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 }));
      water.position.set(0, 0.78, 0);
      landmarkGroup.add(water);
      stateRef.current._fountainWater = water;
    }
    scene.add(landmarkGroup);
    const landmarkPick = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 92, 12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    landmarkPick.position.set(0, 46, 0);
    scene.add(landmarkPick);

    /* ---------------- parks, trees, bushes ---------------- */
    const parkGroup = new THREE.Group();
    const treeCanopyGeos = [unitSphere, new THREE.ConeGeometry(0.5, 1, 7), new THREE.IcosahedronGeometry(0.5, 0)];
    const treeHues = [0x14532d, 0x166534, 0x3f6212, 0x0f5132];
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2a1a, roughness: 0.9 });
    const treeSpots = [];
    PARKS.forEach((p) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w * 2, p.d * 2), new THREE.MeshStandardMaterial({ color: 0x0f5132, roughness: 1 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(p.x, 0.02, p.z);
      parkGroup.add(m);
      for (let i = 0; i < 10; i++) {
        treeSpots.push({ x: p.x + (Math.random() - 0.5) * p.w * 1.7, z: p.z + (Math.random() - 0.5) * p.d * 1.7, scale: 0.85 + Math.random() * 0.5 });
      }
      // path
      const path = new THREE.Mesh(new THREE.RingGeometry(p.w * 0.5, p.w * 0.58, 24, 1, 0, Math.PI * 1.4), new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      path.rotation.x = -Math.PI / 2; path.position.set(p.x, 0.03, p.z);
      parkGroup.add(path);
      // small fountain in the largest park
      if (p === PARKS[0]) {
        const fb = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.35, 20), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 }));
        fb.position.set(p.x, 0.2, p.z);
        parkGroup.add(fb);
        const fw = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.06, 20), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 }));
        fw.position.set(p.x, 0.4, p.z);
        parkGroup.add(fw);
        stateRef.current._parkFountainWater = fw;
      }
    });
    // scatter extra street-side trees & bushes near residential/park edges
    for (let i = 0; i < 46; i++) {
      const ang = Math.random() * Math.PI * 2, rad = 35 + Math.random() * 40;
      treeSpots.push({ x: Math.cos(ang) * rad * 0.5, z: -48 + Math.sin(ang) * 22, scale: 0.6 + Math.random() * 0.5 });
    }
    const trunkMesh = new THREE.InstancedMesh(unitCyl, treeTrunkMat, treeSpots.length);
    const canopyMeshes = treeCanopyGeos.map((g) => new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), treeSpots.length));
    const canopyCounts = [0, 0, 0];
    treeSpots.forEach((t, i) => {
      dummy.position.set(t.x, 0.5 * t.scale, t.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.16 * t.scale, t.scale, 0.16 * t.scale);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      const shapeIdx = Math.floor(Math.random() * treeCanopyGeos.length);
      const cm = canopyMeshes[shapeIdx];
      const idx = canopyCounts[shapeIdx]++;
      dummy.position.set(t.x, (1.1 + Math.random() * 0.3) * t.scale, t.z);
      dummy.scale.set(1.5 * t.scale, 1.9 * t.scale, 1.5 * t.scale);
      dummy.updateMatrix();
      cm.setMatrixAt(idx, dummy.matrix);
      cm.setColorAt(idx, new THREE.Color(treeHues[Math.floor(Math.random() * treeHues.length)]));
    });
    canopyMeshes.forEach((cm, i) => { cm.count = canopyCounts[i]; cm.instanceMatrix.needsUpdate = true; if (cm.instanceColor) cm.instanceColor.needsUpdate = true; scene.add(cm); });
    trunkMesh.instanceMatrix.needsUpdate = true;
    scene.add(trunkMesh);
    scene.add(parkGroup);

    // bushes near buildings
    const bushSpots = [];
    cityData.buildings.forEach((b) => { if (Math.random() < 0.22) bushSpots.push({ x: b.x + (Math.random() - 0.5) * b.w * 1.6, z: b.z + b.d / 2 + 0.8 + Math.random() * 0.6 }); });
    const bushMesh = new THREE.InstancedMesh(unitSphere, new THREE.MeshStandardMaterial({ color: 0x1f5c34, roughness: 0.9 }), Math.max(1, bushSpots.length));
    bushMesh.count = bushSpots.length;
    bushSpots.forEach((s, i) => {
      dummy.position.set(s.x, 0.28, s.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0.55 + Math.random() * 0.3, 0.4 + Math.random() * 0.2, 0.55 + Math.random() * 0.3);
      dummy.updateMatrix();
      bushMesh.setMatrixAt(i, dummy.matrix);
    });
    bushMesh.instanceMatrix.needsUpdate = true;
    scene.add(bushMesh);

    /* ---------------- parking lots (decorative, near a few districts) ---------------- */
    const parkingGroup = new THREE.Group();
    const parkingLineTex = makeLaneTexture();
    [[46, 8, "commercial"], [16, 18, "hospital"], [-40, -38, "university"], [36, 36, "shopping"]].forEach(([px, pz]) => {
      const lot = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.95 }));
      lot.rotation.x = -Math.PI / 2; lot.position.set(px + 10, 0.025, pz + 10);
      parkingGroup.add(lot);
      for (let s = -3; s <= 3; s++) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 5.2), new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.6 }));
        stripe.rotation.x = -Math.PI / 2; stripe.position.set(px + 10 + s * 1.3, 0.03, pz + 10);
        parkingGroup.add(stripe);
      }
    });
    scene.add(parkingGroup);

    /* ---------------- roads: asphalt + lanes + sidewalks + curbs ---------------- */
    const asphaltTex = makeAsphaltTexture();
    asphaltTex.wrapS = asphaltTex.wrapT = THREE.RepeatWrapping;
    const asphaltTexX = asphaltTex.clone(); asphaltTexX.needsUpdate = true; asphaltTexX.repeat.set(14, 1);
    const asphaltTexZ = asphaltTex.clone(); asphaltTexZ.needsUpdate = true; asphaltTexZ.repeat.set(1, 14);
    const laneTex = makeLaneTexture(); laneTex.wrapS = laneTex.wrapT = THREE.RepeatWrapping;
    const laneTexX = laneTex.clone(); laneTexX.needsUpdate = true; laneTexX.repeat.set(24, 1);
    const laneTexZ = laneTex.clone(); laneTexZ.needsUpdate = true; laneTexZ.repeat.set(1, 24);

    const roadGroup = new THREE.Group();
    const sidewalkGroup = new THREE.Group();
    const curbGroup = new THREE.Group();
    const roadMeshes = [];
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.95 });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xaeb4c0, roughness: 0.7 });
    cityData.roads.forEach((r) => {
      const isX = r.axis === "x";
      const geo = new THREE.PlaneGeometry(isX ? r.len : 2.6, isX ? 2.6 : r.len);
      const mat = new THREE.MeshStandardMaterial({ map: isX ? asphaltTexX : asphaltTexZ, color: trafficColor(r.traffic), roughness: 0.95, metalness: 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(isX ? 0 : r.pos, 0.015, isX ? r.pos : 0);
      roadGroup.add(mesh);
      roadMeshes.push({ mesh, r });

      const laneGeo = new THREE.PlaneGeometry(isX ? r.len : 0.16, isX ? 0.16 : r.len);
      const laneMat = new THREE.MeshBasicMaterial({ map: isX ? laneTexX : laneTexZ, transparent: true, depthWrite: false });
      const lane = new THREE.Mesh(laneGeo, laneMat);
      lane.rotation.x = -Math.PI / 2;
      lane.position.set(isX ? 0 : r.pos, 0.021, isX ? r.pos : 0);
      roadGroup.add(lane);

      [-1, 1].forEach((side) => {
        const off = side * 1.95;
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(isX ? r.len : 1.1, isX ? 1.1 : r.len), sidewalkMat);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(isX ? 0 : r.pos + off, 0.009, isX ? r.pos + off : 0);
        sidewalkGroup.add(sw);

        const curb = new THREE.Mesh(unitBox, curbMat);
        curb.scale.set(isX ? r.len : 0.09, 0.09, isX ? 0.09 : r.len);
        curb.position.set(isX ? 0 : r.pos + side * 1.38, 0.05, isX ? r.pos + side * 1.38 : 0);
        curbGroup.add(curb);
      });
    });
    scene.add(sidewalkGroup); scene.add(curbGroup); scene.add(roadGroup);

    /* wet-road puddle decals (toggled by weather) */
    const puddleGroup = new THREE.Group();
    for (let i = 0; i < 22; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.5 + Math.random() * 0.7, 10), new THREE.MeshBasicMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.28 }));
      p.rotation.x = -Math.PI / 2;
      const r = cityData.roads[Math.floor(Math.random() * cityData.roads.length)];
      const along = (Math.random() - 0.5) * r.len * 0.8;
      p.position.set(r.axis === "x" ? along : r.pos, 0.022, r.axis === "x" ? r.pos : along);
      puddleGroup.add(p);
    }
    puddleGroup.visible = false;
    scene.add(puddleGroup);

    /* ---------------- street lamps ---------------- */
    const lampSpots = [];
    cityData.roads.forEach((r) => {
      for (let t = -r.len / 2 + 8; t < r.len / 2; t += 22) {
        lampSpots.push({ x: r.axis === "x" ? t : r.pos + 2.3, z: r.axis === "x" ? r.pos + 2.3 : t });
      }
    });
    const lampPoleMesh = new THREE.InstancedMesh(unitCyl, new THREE.MeshStandardMaterial({ color: 0x2b3240, roughness: 0.6, metalness: 0.4 }), lampSpots.length);
    const lampHeadMesh = new THREE.InstancedMesh(unitSphere, new THREE.MeshBasicMaterial({ vertexColors: true }), lampSpots.length);
    lampSpots.forEach((s, i) => {
      dummy.position.set(s.x, 1.6, s.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.06, 3.2, 0.06); dummy.updateMatrix();
      lampPoleMesh.setMatrixAt(i, dummy.matrix);
      dummy.position.set(s.x, 3.25, s.z); dummy.scale.set(0.22, 0.22, 0.22); dummy.updateMatrix();
      lampHeadMesh.setMatrixAt(i, dummy.matrix);
      lampHeadMesh.setColorAt(i, new THREE.Color("#33210a"));
    });
    lampPoleMesh.instanceMatrix.needsUpdate = true;
    lampHeadMesh.instanceMatrix.needsUpdate = true;
    scene.add(lampPoleMesh); scene.add(lampHeadMesh);

    // a handful of REAL point lights near downtown, capped for performance
    const realLamps = lampSpots
      .map((s, i) => ({ s, i, dist: Math.hypot(s.x, s.z) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10)
      .map(({ s }) => {
        const pl = new THREE.PointLight(0xffb46b, 0, 11, 2);
        pl.position.set(s.x, 3.3, s.z);
        scene.add(pl);
        return pl;
      });

    /* ---------------- intersections: traffic lights at district cores ---------------- */
    const intersections = DISTRICTS.map((d) => {
      const ix = Math.round(d.cx / 10) * 10, iz = Math.round(d.cz / 10) * 10;
      const roadIdx = cityData.roads.findIndex((r) => r.axis === "x" && r.pos === iz);
      return { x: ix + 1.7, z: iz + 1.7, roadIdx };
    });
    const lightPoleMesh = new THREE.InstancedMesh(unitCyl, new THREE.MeshStandardMaterial({ color: 0x1f2530, roughness: 0.6 }), intersections.length);
    const bulbGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const bulbRed = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), intersections.length);
    const bulbYellow = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), intersections.length);
    const bulbGreen = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ vertexColors: true }), intersections.length);
    intersections.forEach((s, i) => {
      dummy.position.set(s.x, 1.4, s.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.07, 2.8, 0.07); dummy.updateMatrix();
      lightPoleMesh.setMatrixAt(i, dummy.matrix);
      [[bulbRed, 2.55], [bulbYellow, 2.3], [bulbGreen, 2.05]].forEach(([m, y]) => {
        dummy.position.set(s.x, y, s.z); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      });
    });
    [lightPoleMesh, bulbRed, bulbYellow, bulbGreen].forEach((m) => { m.instanceMatrix.needsUpdate = true; scene.add(m); });

    /* ---------------- water feature (river) ---------------- */
    const waterUniforms = { uTime: { value: 0 } };
    const riverMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: waterUniforms,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform float uTime;
        void main(){
          float wave = sin(vUv.x*18.0 + uTime*1.2) * 0.5 + 0.5;
          float wave2 = sin(vUv.y*9.0 - uTime*0.8) * 0.5 + 0.5;
          vec3 deep = vec3(0.02,0.13,0.22);
          vec3 light = vec3(0.16,0.55,0.66);
          vec3 col = mix(deep, light, wave*0.5+wave2*0.3);
          gl_FragColor = vec4(col, 0.82);
        }
      `,
    });
    const river = new THREE.Mesh(new THREE.PlaneGeometry(30, 130), riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(-92, 0.03, 0);
    scene.add(river);

    /* ---------------- energy overlay ---------------- */
    const waterPipeGroup = new THREE.Group();
    cityData.roads.filter((_, i) => i % 3 === 0).forEach((r) => {
      const geo = new THREE.PlaneGeometry(r.axis === "x" ? r.len : 0.35, r.axis === "x" ? 0.35 : r.len);
      const mat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(r.axis === "x" ? 0 : r.pos, 0.023, r.axis === "x" ? r.pos : 0);
      waterPipeGroup.add(mesh);
    });
    scene.add(waterPipeGroup);

    const energyGroup = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const a = DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)];
      const b = DISTRICTS[Math.floor(Math.random() * DISTRICTS.length)];
      const p0 = new THREE.Vector3(a.cx, 14, a.cz);
      const p2 = new THREE.Vector3(b.cx, 14, b.cz);
      const mid = p0.clone().lerp(p2, 0.5).add(new THREE.Vector3(0, 10, 0));
      const curve = new THREE.QuadraticBezierCurve3(p0, mid, p2);
      const geo = new THREE.TubeGeometry(curve, 20, 0.06, 6, false);
      const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55 });
      energyGroup.add(new THREE.Mesh(geo, mat));
    }
    energyGroup.visible = false;
    scene.add(energyGroup);

    /* ---------------- vehicles: chassis + cabin + emergency lightbars ---------------- */
    const CAR_COUNT = 60;
    const chassisMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 }), CAR_COUNT);
    const cabinMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.1 }), CAR_COUNT);
    const carPalette = [0xe2e8f0, 0x1e293b, 0xef4444, 0x3b82f6, 0xfbbf24, 0x94a3b8];
    const cars = Array.from({ length: CAR_COUNT }).map((_, idx) => {
      const rIdx = Math.floor(Math.random() * cityData.roads.length);
      const rand = Math.random();
      const kind = idx < 2 ? "emergency" : rand < 0.72 ? "car" : rand < 0.86 ? "bus" : "truck";
      return { r: cityData.roads[rIdx], roadIndex: rIdx, t: Math.random(), speed: 0.02 + Math.random() * 0.05, kind, color: carPalette[Math.floor(Math.random() * carPalette.length)] };
    });
    const emergencyIdx = cars.map((c, i) => (c.kind === "emergency" ? i : -1)).filter((i) => i >= 0);
    const lightbarMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshBasicMaterial({ vertexColors: true }), Math.max(1, emergencyIdx.length));
    lightbarMesh.count = emergencyIdx.length;
    const wheelMesh = new THREE.InstancedMesh(unitCyl, new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.7, metalness: 0.2 }), CAR_COUNT * 4);
    scene.add(chassisMesh); scene.add(cabinMesh); scene.add(lightbarMesh); scene.add(wheelMesh);

    /* ---------------- pedestrians (small, capped, near university/shopping) ---------------- */
    const PED_COUNT = 16;
    const pedZones = [
      { cx: -40, cz: -38, r: 14 }, // university
      { cx: 36, cz: 36, r: 12 },   // shopping
      { cx: 0, cz: 0, r: 16 },     // downtown plaza
    ];
    const pedestrians = Array.from({ length: PED_COUNT }).map((_, i) => {
      const zone = pedZones[i % pedZones.length];
      const ang = Math.random() * Math.PI * 2;
      const x0 = zone.cx + Math.cos(ang) * zone.r, z0 = zone.cz + Math.sin(ang) * zone.r;
      const x1 = zone.cx + Math.cos(ang + Math.PI) * zone.r, z1 = zone.cz + Math.sin(ang + Math.PI) * zone.r;
      return { x0, z0, x1, z1, t: Math.random(), speed: 0.15 + Math.random() * 0.1, hue: [0x60a5fa, 0xfbbf24, 0xf87171, 0xa78bfa, 0x34d399][i % 5] };
    });
    const pedBodyMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), PED_COUNT);
    const pedHeadMesh = new THREE.InstancedMesh(unitSphere, new THREE.MeshStandardMaterial({ color: 0xe7c9a9, roughness: 0.7 }), PED_COUNT);
    scene.add(pedBodyMesh); scene.add(pedHeadMesh);

    /* ---------------- rain ---------------- */
    const RAIN_COUNT = 1200;
    const rainPos = new Float32Array(RAIN_COUNT * 3);
    for (let i = 0; i < RAIN_COUNT; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 140;
      rainPos[i * 3 + 1] = Math.random() * 60;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 140;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rainMat = new THREE.PointsMaterial({ color: 0x9fd0ff, size: 0.25, transparent: true, opacity: 0.6 });
    const rain = new THREE.Points(rainGeo, rainMat);
    rain.visible = false;
    scene.add(rain);

    const emMarker = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 16), new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.55 }));
    emMarker.visible = false; scene.add(emMarker);
    const emZone = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), new THREE.MeshBasicMaterial({ color: 0xff1744, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    emZone.rotation.x = -Math.PI / 2; emZone.visible = false; scene.add(emZone);

    const constructionGroup = new THREE.Group();
    scene.add(constructionGroup);

    /* ---------------- camera control ---------------- */
    const orbit = { theta: 0.7, phi: 0.85, radius: 95, target: new THREE.Vector3(0, 4, 0) };
    const flyTarget = { theta: orbit.theta, phi: orbit.phi, radius: orbit.radius, tx: 0, ty: 4, tz: 0 };
    function applyCamera() {
      orbit.theta += (flyTarget.theta - orbit.theta) * 0.06;
      orbit.phi += (flyTarget.phi - orbit.phi) * 0.06;
      orbit.radius += (flyTarget.radius - orbit.radius) * 0.06;
      orbit.target.x += (flyTarget.tx - orbit.target.x) * 0.06;
      orbit.target.y += (flyTarget.ty - orbit.target.y) * 0.06;
      orbit.target.z += (flyTarget.tz - orbit.target.z) * 0.06;
      const phi = Math.max(0.12, Math.min(1.5, orbit.phi));
      camera.position.set(
        orbit.target.x + orbit.radius * Math.sin(phi) * Math.sin(orbit.theta),
        orbit.target.y + orbit.radius * Math.cos(phi),
        orbit.target.z + orbit.radius * Math.sin(phi) * Math.cos(orbit.theta)
      );
      camera.lookAt(orbit.target);
    }
    applyCamera();

    let dragging = false, lastX = 0, lastY = 0;
    const dom = renderer.domElement;
    const onDown = (e) => { dragging = true; const p = e.touches ? e.touches[0] : e; lastX = p.clientX; lastY = p.clientY; };
    const onUp = () => { dragging = false; };
    const onMove = (e) => {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - lastX, dy = p.clientY - lastY;
      lastX = p.clientX; lastY = p.clientY;
      flyTarget.theta -= dx * 0.006;
      flyTarget.phi -= dy * 0.006;
      flyTarget.phi = Math.max(0.15, Math.min(1.48, flyTarget.phi));
    };
    const onWheel = (e) => { flyTarget.radius = Math.max(3, Math.min(160, flyTarget.radius + e.deltaY * 0.05)); };
    dom.addEventListener("mousedown", onDown);
    dom.addEventListener("mouseup", onUp);
    dom.addEventListener("mouseleave", onUp);
    dom.addEventListener("mousemove", onMove);
    dom.addEventListener("wheel", onWheel, { passive: true });
    dom.addEventListener("touchstart", onDown, { passive: true });
    dom.addEventListener("touchend", onUp);
    dom.addEventListener("touchmove", onMove, { passive: true });

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pickTargets = [pickMesh, landmarkPick, ground, ...roadMeshes.map((rm) => rm.mesh)];
    let downX = 0, downY = 0;
    const onClickCandidate = (e) => { const p = e.changedTouches ? e.changedTouches[0] : e; downX = p.clientX; downY = p.clientY; };
    const onClickRelease = (e) => {
      const p = e.changedTouches ? e.changedTouches[0] : e;
      if (Math.hypot(p.clientX - downX, p.clientY - downY) > 6) return;
      const rect = dom.getBoundingClientRect();
      ndc.x = ((p.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((p.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(pickTargets, false)[0];
      if (!hit) return;
      const payload = { point: hit.point };
      if (hit.object === pickMesh && hit.instanceId != null) payload.buildingIndex = hit.instanceId;
      else if (hit.object === landmarkPick) payload.landmark = true;
      else if (hit.object === ground) payload.ground = true;
      else {
        const idx = roadMeshes.findIndex((rm) => rm.mesh === hit.object);
        if (idx >= 0) payload.roadIndex = idx;
      }
      stateRef.current.onSceneInteraction && stateRef.current.onSceneInteraction(payload);
    };
    dom.addEventListener("mousedown", onClickCandidate);
    dom.addEventListener("mouseup", onClickRelease);
    dom.addEventListener("touchstart", onClickCandidate, { passive: true });
    dom.addEventListener("touchend", onClickRelease);

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
      if (stateRef.current.paused) return;
      const dt = clock.getDelta();
      applyCamera();
      waterUniforms.uTime.value += dt;
      if (stateRef.current._fountainWater) stateRef.current._fountainWater.position.y = 0.78 + Math.sin(clock.elapsedTime * 3) * 0.02;
      if (stateRef.current._parkFountainWater) stateRef.current._parkFountainWater.position.y = 0.4 + Math.sin(clock.elapsedTime * 3.4) * 0.015;

      const responder = stateRef.current.responder;
      cars.forEach((c, i) => {
        let x, z, rotY;
        if (responder && emergencyIdx[0] === i) {
          const t = clamp(responder.t, 0, 1);
          x = lerp(responder.sx, responder.tx, t);
          z = lerp(responder.sz, responder.tz, t);
          rotY = Math.atan2(responder.tx - responder.sx, responder.tz - responder.sz);
          responder.t += dt * 0.35;
        } else {
          const eff = stateRef.current.effectiveTraffic;
          const lvl = eff && eff[c.roadIndex] != null ? eff[c.roadIndex] : c.r.traffic;
          const speedScale = clamp(1 - lvl * 0.55, 0.12, 1);
          c.t += c.speed * speedScale * dt * 10;
          if (c.t > 1) c.t = 0;
          const half = c.r.len / 2;
          const along = -half + c.t * c.r.len;
          x = c.r.axis === "x" ? along : c.r.pos + 0.8;
          z = c.r.axis === "x" ? c.r.pos + 0.8 : along;
          rotY = c.r.axis === "x" ? Math.PI / 2 : 0;
        }
        const scaleMul = c.kind === "bus" ? [1.9, 1.5, 0.95] : c.kind === "truck" ? [2.1, 1.6, 1.0] : [1, 1, 1];
        dummy.position.set(x, 0.28 * scaleMul[1], z);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(0.75 * scaleMul[0], 0.42 * scaleMul[1], 0.42 * scaleMul[2]);
        dummy.updateMatrix();
        chassisMesh.setMatrixAt(i, dummy.matrix);
        tmpColor.set(c.kind === "emergency" ? 0xffffff : c.color);
        chassisMesh.setColorAt(i, tmpColor);
        dummy.position.set(x, 0.28 * scaleMul[1] + 0.26 * scaleMul[1], z);
        dummy.scale.set(0.5 * scaleMul[0], 0.32 * scaleMul[1], 0.4 * scaleMul[2]);
        dummy.updateMatrix();
        cabinMesh.setMatrixAt(i, dummy.matrix);
        tmpColor.set(c.kind === "emergency" ? 0xdc2626 : c.kind === "bus" ? 0x3b82f6 : 0x1e293b);
        cabinMesh.setColorAt(i, tmpColor);

        // wheels: 4 per car, at the corners of the chassis footprint
        const wLen = 0.75 * scaleMul[0], wWid = 0.42 * scaleMul[2];
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], wi) => {
          const localX = sx * wLen * 0.34, localZ = sz * wWid * 0.42;
          const wx = x + localX * Math.cos(rotY) - localZ * Math.sin(rotY);
          const wz = z + localX * Math.sin(rotY) + localZ * Math.cos(rotY);
          dummy.position.set(wx, 0.14, wz);
          dummy.rotation.set(0, 0, Math.PI / 2);
          dummy.scale.set(0.16, 0.05, 0.16);
          dummy.updateMatrix();
          wheelMesh.setMatrixAt(i * 4 + wi, dummy.matrix);
        });

        if (c.kind === "emergency") {
          const ei = emergencyIdx.indexOf(i);
          if (ei >= 0) {
            dummy.position.set(x, 0.6, z);
            dummy.scale.set(0.5, 0.08, 0.2);
            dummy.updateMatrix();
            lightbarMesh.setMatrixAt(ei, dummy.matrix);
            const flash = Math.sin(clock.elapsedTime * 10 + ei * 3) > 0;
            tmpColor.set(flash ? 0xff2244 : 0x2255ff);
            lightbarMesh.setColorAt(ei, tmpColor);
          }
        }
      });
      chassisMesh.instanceMatrix.needsUpdate = true; if (chassisMesh.instanceColor) chassisMesh.instanceColor.needsUpdate = true;
      cabinMesh.instanceMatrix.needsUpdate = true; if (cabinMesh.instanceColor) cabinMesh.instanceColor.needsUpdate = true;
      wheelMesh.instanceMatrix.needsUpdate = true;
      if (emergencyIdx.length) { lightbarMesh.instanceMatrix.needsUpdate = true; if (lightbarMesh.instanceColor) lightbarMesh.instanceColor.needsUpdate = true; }

      // pedestrians: walk back and forth between two points near their zone
      pedestrians.forEach((p, i) => {
        p.t += p.speed * dt * 0.2;
        const cycle = (Math.sin(p.t) + 1) / 2;
        const px = lerp(p.x0, p.x1, cycle), pz = lerp(p.z0, p.z1, cycle);
        const bob = Math.abs(Math.sin(clock.elapsedTime * 6 + i)) * 0.04;
        const facing = Math.atan2(p.x1 - p.x0, p.z1 - p.z0) + (cycle > 0.5 ? Math.PI : 0);
        dummy.position.set(px, 0.55 + bob, pz);
        dummy.rotation.set(0, facing, 0);
        dummy.scale.set(0.28, 0.62, 0.18);
        dummy.updateMatrix();
        pedBodyMesh.setMatrixAt(i, dummy.matrix);
        tmpColor.set(p.hue);
        pedBodyMesh.setColorAt(i, tmpColor);
        dummy.position.set(px, 0.98 + bob, pz);
        dummy.scale.set(0.16, 0.16, 0.16);
        dummy.updateMatrix();
        pedHeadMesh.setMatrixAt(i, dummy.matrix);
      });
      pedBodyMesh.instanceMatrix.needsUpdate = true; if (pedBodyMesh.instanceColor) pedBodyMesh.instanceColor.needsUpdate = true;
      pedHeadMesh.instanceMatrix.needsUpdate = true;

      if (rain.visible) {
        const pos = rainGeo.attributes.position.array;
        for (let i = 0; i < RAIN_COUNT; i++) {
          pos[i * 3 + 1] -= dt * 40;
          if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 60;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }

      if (emMarker.visible) {
        const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.25;
        emMarker.scale.set(s, s, s);
      }

      renderer.render(scene, camera);
    }
    animate();

    stateRef.current = {
      ...stateRef.current,
      scene, camera, renderer, ambient, sun, hemi,
      archMeshes, windowMesh, windows, pickMesh, selectionBox, landmarkGroup, landmarkPick,
      roadMeshesList: roadMeshes, sidewalkGroup, curbGroup, puddleGroup,
      lampPoleMesh, lampHeadMesh, realLamps, lightPoleMesh, bulbRed, bulbYellow, bulbGreen, intersections,
      trunkMesh, canopyMeshes, bushMesh, parkingGroup,
      chassisMesh, cabinMesh, lightbarMesh, cars, emergencyIdx,
      rain, emMarker, emZone, energyGroup, parkGroup, waterPipeGroup, roadGroup, constructionGroup,
      river,
      flyTarget, dummy, tmpColor, clock,
    };
    setReady(true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      dom.removeEventListener("mousedown", onDown);
      dom.removeEventListener("mouseup", onUp);
      dom.removeEventListener("mouseleave", onUp);
      dom.removeEventListener("mousemove", onMove);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("touchstart", onDown);
      dom.removeEventListener("touchend", onUp);
      dom.removeEventListener("touchmove", onMove);
      dom.removeEventListener("mousedown", onClickCandidate);
      dom.removeEventListener("mouseup", onClickRelease);
      dom.removeEventListener("touchstart", onClickCandidate);
      dom.removeEventListener("touchend", onClickRelease);
      renderer.dispose();
      if (mount.contains(dom)) mount.removeChild(dom);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- register scene click behavior each render ---------- */
  useEffect(() => {
    stateRef.current.onSceneInteraction = (payload) => {
      if (tool === "construction" && payload.point) { placeConstructionAt(payload.point); return; }
      if (tool === "emergency" && payload.point) { placeEmergencyAt(payload.point); return; }
      if (tool === "road-closure" && payload.roadIndex != null) { selectRoadForClosure(payload.roadIndex); return; }
      if (payload.landmark) { setSelectedBuilding(LANDMARK); setEnergyMode(false); return; }
      if (payload.buildingIndex != null) { setSelectedBuilding(cityData.buildings[payload.buildingIndex]); setEnergyMode(false); }
    };
  });

  /* ---------- selection highlight + fly-to-building ---------- */
  useEffect(() => {
    const s = stateRef.current;
    if (!s.selectionBox) return;
    if (selectedBuilding) {
      const b = selectedBuilding;
      s.selectionBox.visible = true;
      s.selectionBox.position.set(b.x, b.h / 2, b.z);
      s.selectionBox.scale.set(b.w * 1.08, b.h * 1.04, b.d * 1.08);
      if (!streetLevel) {
        s.flyTarget.tx = b.x; s.flyTarget.ty = b.h * 0.55; s.flyTarget.tz = b.z;
        s.flyTarget.radius = Math.max(14, Math.max(b.w, b.d, b.h) * 1.8);
      }
    } else {
      s.selectionBox.visible = false;
    }
  }, [selectedBuilding, ready]);

  /* ---------- street-level camera mode ---------- */
  useEffect(() => {
    const s = stateRef.current;
    if (!s.flyTarget) return;
    if (streetLevel) {
      s.flyTarget.tx = 0; s.flyTarget.ty = 1.6; s.flyTarget.tz = 30;
      s.flyTarget.radius = 7; s.flyTarget.phi = 1.42; s.flyTarget.theta = 0.4;
    } else if (!selectedBuilding) {
      s.flyTarget.tx = 0; s.flyTarget.ty = 4; s.flyTarget.tz = 0;
      s.flyTarget.radius = 95; s.flyTarget.phi = 0.85; s.flyTarget.theta = 0.7;
    }
  }, [streetLevel, ready]);

  /* ---------- layer visibility ---------- */
  useEffect(() => {
    const s = stateRef.current;
    if (!s.archMeshes) return;
    Object.values(s.archMeshes).forEach((parts) => Object.values(parts).forEach((m) => { m.visible = layers.buildings; }));
    s.windowMesh.visible = layers.buildings;
    s.landmarkGroup.visible = layers.buildings;
    s.parkGroup.visible = layers.parks;
    if (s.trunkMesh) s.trunkMesh.visible = layers.parks;
    if (s.canopyMeshes) s.canopyMeshes.forEach((m) => { m.visible = layers.parks; });
    if (s.bushMesh) s.bushMesh.visible = layers.parks;
    if (s.parkingGroup) s.parkingGroup.visible = layers.buildings;
    s.roadGroup.visible = layers.roads;
    s.sidewalkGroup.visible = layers.roads;
    s.curbGroup.visible = layers.roads;
    s.lampHeadMesh.visible = layers.roads;
    if (s.lampPoleMesh) s.lampPoleMesh.visible = layers.roads;
    s.lightPoleMesh.visible = layers.roads;
    [s.bulbRed, s.bulbYellow, s.bulbGreen].forEach((m) => { if (m) m.visible = layers.roads; });
    s.waterPipeGroup.visible = layers.water;
    s.river.visible = layers.water;
    s.energyGroup.visible = layers.energy;
    s.roadMeshesList.forEach(({ mesh }) => { mesh.visible = layers.roads && layers.traffic; });
  }, [layers, ready]);

  /* ---------- time of day: sky, sun, windows, streetlights ---------- */
  useEffect(() => {
    const s = stateRef.current;
    if (!s.ambient) return;
    const preset = TIME_PRESETS[hour];
    s.scene.background = new THREE.Color(preset.sky);
    s.ambient.color.set(preset.ambient);
    s.ambient.intensity = preset.ambientI;
    s.sun.color.set(preset.sun);
    s.sun.intensity = preset.sunI;

    // windows: lit warm/cool at night, dim glass-blue by day
    const dayColor = new THREE.Color("#7dd8f0");
    const nightWarm = new THREE.Color("#ffd18a");
    const nightCool = new THREE.Color("#bfe6ff");
    const nightOff = new THREE.Color("#0e1b28");
    s.windows.forEach((win, i) => {
      let c;
      if (preset.night) c = win.isLit ? (win.warm ? nightWarm : nightCool) : nightOff;
      else c = dayColor;
      s.windowMesh.setColorAt(i, c);
    });
    if (s.windowMesh.instanceColor) s.windowMesh.instanceColor.needsUpdate = true;

    // street lamps + intersection lamps: glow only at night
    const lampOn = new THREE.Color("#ffc773");
    const lampOff = new THREE.Color("#2c220f");
    for (let i = 0; i < (s.lampHeadMesh.count || 0); i++) s.lampHeadMesh.setColorAt(i, preset.night ? lampOn : lampOff);
    if (s.lampHeadMesh.instanceColor) s.lampHeadMesh.instanceColor.needsUpdate = true;
    s.realLamps.forEach((pl) => { pl.intensity = preset.night ? 1.1 : 0; });
  }, [hour, ready]);

  /* ---------- weather ---------- */
  useEffect(() => {
    const s = stateRef.current;
    if (!s.scene) return;
    const w = WEATHER_MODES.find((m) => m.id === weather);
    const extra = simMode ? (simParams.weatherSeverity / 100) * 0.02 : 0;
    s.scene.fog = new THREE.FogExp2(w.fog, w.density + extra);
    const wet = weather === "rain" || weather === "storm";
    s.rain.visible = wet || (simMode && simParams.weatherSeverity > 55);
    if (s.puddleGroup) s.puddleGroup.visible = wet;
    s.roadMeshesList.forEach(({ mesh }) => {
      mesh.material.roughness = wet ? 0.35 : 0.95;
      mesh.material.metalness = wet ? 0.35 : 0.05;
    });
  }, [weather, simMode, simParams.weatherSeverity, ready]);

  /* ---------- lightning flash during storms ---------- */
  useEffect(() => {
    if (weather !== "storm") return;
    const id = setInterval(() => {
      if (Math.random() < 0.4) {
        setLightningFlash(true);
        setTimeout(() => setLightningFlash(false), 120);
      }
    }, 1800);
    return () => clearInterval(id);
  }, [weather]);

  /* ---------- traffic / simulation-driven road + intersection light coloring ---------- */
  useEffect(() => {
    const s = stateRef.current;
    if (!s.roadMeshesList) return;
    const trafficMult = simMode ? clamp((simParams.traffic / 50) * (1 - simParams.transport / 300), 0.1, 3) : 1;
    const closureBoost = {};
    const distBoost = {};
    if (simMode) {
      roadClosures.forEach((ci) => {
        const cr = cityData.roads[ci];
        cityData.roads.forEach((r2, i2) => {
          if (i2 !== ci && r2.axis === cr.axis && Math.abs(Math.abs(r2.pos - cr.pos) - 10) < 0.01) {
            closureBoost[i2] = (closureBoost[i2] || 0) + 0.3;
          }
        });
      });
      DISTRICTS.forEach((d) => {
        const b = districtBoosts[d.id]?.traffic;
        if (b) districtRoadMap[d.id].forEach((ri) => { distBoost[ri] = (distBoost[ri] || 0) + b / 100; });
      });
    }
    const effective = cityData.roads.map((r, i) => {
      if (simMode && roadClosures.has(i)) return 0;
      const lvl = r.traffic * trafficMult + (closureBoost[i] || 0) + (distBoost[i] || 0);
      return clamp(lvl, 0, 1);
    });
    s.effectiveTraffic = effective;
    s.roadMeshesList.forEach(({ mesh }, i) => {
      const closed = simMode && roadClosures.has(i);
      mesh.material.color.set(closed ? "#15171d" : trafficColor(effective[i]));
      mesh.material.opacity = closed ? 0.6 : 1;
    });

    // intersection traffic lights follow the nearest x-axis road's level
    if (s.intersections) {
      const dim = 0.12;
      s.intersections.forEach((it, i) => {
        const lvl = it.roadIdx >= 0 ? effective[it.roadIdx] : 0.2;
        const bucket = lvl <= 0.35 ? "green" : lvl <= 0.65 ? "yellow" : "red";
        const setBulb = (mesh, name, bright) => {
          const c = name === "red" ? 0xff3b30 : name === "yellow" ? 0xffcc33 : 0x2ee66b;
          const col = new THREE.Color(c).multiplyScalar(bright ? 1 : dim);
          mesh.setColorAt(i, col);
        };
        setBulb(s.bulbRed, "red", bucket === "red");
        setBulb(s.bulbYellow, "yellow", bucket === "yellow");
        setBulb(s.bulbGreen, "green", bucket === "green");
      });
      [s.bulbRed, s.bulbYellow, s.bulbGreen].forEach((m) => { if (m && m.instanceColor) m.instanceColor.needsUpdate = true; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simMode, simParams.traffic, simParams.transport, roadClosures, districtBoosts, ready]);

  /* ---------- emergency marker + responder dispatch ---------- */
  useEffect(() => {
    const s = stateRef.current;
    if (!s.emMarker) return;
    if (emergency) {
      s.emMarker.visible = true;
      s.emMarker.position.set(emergency.x, 6, emergency.z);
      const rad = emergency.radius || 10;
      s.emZone.visible = true;
      s.emZone.position.set(emergency.x, 0.05, emergency.z);
      s.emZone.scale.set(rad, rad, 1);
      if (s.cars && s.cars.length) {
        const cur = s.cars[0];
        const half = cur.r.len / 2;
        const along = -half + cur.t * cur.r.len;
        const sx = cur.r.axis === "x" ? along : cur.r.pos + 0.8;
        const sz = cur.r.axis === "x" ? cur.r.pos + 0.8 : along;
        s.responder = { sx, sz, tx: emergency.x, tz: emergency.z, t: 0 };
      }
    } else {
      s.emMarker.visible = false;
      if (s.emZone) s.emZone.visible = false;
      s.responder = null;
    }
  }, [emergency, ready]);

  /* ---------- construction zones ---------- */
  useEffect(() => {
    const s = stateRef.current;
    if (!s.constructionGroup) return;
    while (s.constructionGroup.children.length) s.constructionGroup.remove(s.constructionGroup.children[0]);
    constructionZones.forEach((z) => {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(z.radius, z.radius, 0.25, 20), new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.3 }));
      disc.position.set(z.x, 0.14, z.z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(z.radius, 0.14, 8, 24), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
      ring.rotation.x = Math.PI / 2; ring.position.set(z.x, 0.2, z.z);
      const crane = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), new THREE.MeshStandardMaterial({ color: 0xfbbf24 }));
      crane.position.set(z.x, 3, z.z);
      s.constructionGroup.add(disc, ring, crane);
    });
  }, [constructionZones, ready]);

  const flyToDistrict = useCallback((d) => {
    const s = stateRef.current;
    if (!s.flyTarget) return;
    setStreetLevel(false);
    setSelectedBuilding(null);
    s.flyTarget.tx = d.cx; s.flyTarget.ty = 4; s.flyTarget.tz = d.cz;
    s.flyTarget.radius = d.camR;
    setPanel(null);
  }, []);

  /* ---------- drag-to-simulate: pointer tracking ---------- */
  useEffect(() => {
    if (!dragChip) return;
    const move = (e) => {
      const p = e.touches ? e.touches[0] : e;
      setDragChip((d) => (d ? { ...d, x: p.clientX, y: p.clientY } : d));
    };
    const up = (e) => {
      const p = e.changedTouches ? e.changedTouches[0] : e;
      let hitDistrict = null;
      Object.entries(districtRefs.current).forEach(([id, node]) => {
        if (!node) return;
        const r = node.getBoundingClientRect();
        if (p.clientX >= r.left && p.clientX <= r.right && p.clientY >= r.top && p.clientY <= r.bottom) hitDistrict = id;
      });
      setDragChip((current) => {
        if (hitDistrict && current) applyDistrictImpact(current.chip, hitDistrict);
        return null;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragChip]);

  /* ---------- derived analytics (demo data, simulation-aware) ---------- */
  const energyByDistrict = DISTRICTS.map((d) => {
    const base = cityData.buildings.filter((b) => b.districtId === d.id).reduce((a, b) => a + b.energy, 0);
    const boost = simMode ? (districtBoosts[d.id]?.energy || 0) / 100 : 0;
    const mult = simMode ? simParams.energy / 50 : 1;
    return { name: d.name.split(" ")[0], energy: Math.round(base * mult * (1 + boost)) };
  });
  const trafficByHour = [6, 8, 9, 12, 15, 18, 21, 0].map((h) => {
    const base = Math.round(20 + (h === 9 || h === 18 ? 65 : h === 12 ? 40 : 15) + Math.sin(h) * 8);
    const mult = simMode ? simParams.traffic / 50 : 1;
    return { h: `${String(h).padStart(2, "0")}:00`, traffic: Math.round(clamp(base * mult, 0, 100)) };
  });
  const totalEnergy = Math.round(cityData.buildings.reduce((a, b) => a + b.energy, 0) * (simMode ? simParams.energy / 50 : 1));
  const avgOccupancy = Math.round(cityData.buildings.reduce((a, b) => a + b.occupancy, 0) / cityData.buildings.length * (simMode ? simParams.population / 50 : 1));
  const baseScore = Math.round(
    (100 - Math.min(40, trafficByHour[2].traffic / 2)) * 0.2 +
    (100 - Math.min(35, totalEnergy / 20000)) * 0.2 +
    78 * 0.2 + clamp(avgOccupancy, 0, 100) * 0.2 + 84 * 0.2
  );
  const simPenalty = simMode
    ? Math.round((simParams.traffic - 50) * 0.15 + (simParams.energy - 50) * 0.1 + roadClosures.size * 1.5 + constructionZones.length * 1.2)
    : 0;
  const cityScore = clamp(baseScore - simPenalty, 0, 100);

  /* ---------- simulation actions ---------- */
  const districtBaseline = (d) => {
    const buildings = cityData.buildings.filter((b) => b.districtId === d.id);
    const roads = districtRoadMap[d.id].map((i) => cityData.roads[i]);
    const traffic = Math.round((roads.reduce((a, r) => a + r.traffic, 0) / roads.length) * 100);
    const energy = Math.min(100, Math.round(buildings.reduce((a, b) => a + b.energy, 0) / buildings.length / 35));
    const population = Math.round(buildings.reduce((a, b) => a + b.occupancy, 0) / buildings.length);
    return { traffic, energy, population, transport: 50 };
  };

  const applyDistrictImpact = (chip, districtId) => {
    const d = DISTRICTS.find((x) => x.id === districtId);
    if (!d) return;
    const base = districtBaseline(d);
    const currentBoost = districtBoosts[districtId]?.[chip.key] || 0;
    const before = clamp(Math.round(base[chip.key] + currentBoost), 0, 100);
    const after = clamp(before + chip.delta, 0, 100);
    setDistrictBoosts((prev) => ({
      ...prev,
      [districtId]: { ...prev[districtId], [chip.key]: (prev[districtId]?.[chip.key] || 0) + chip.delta },
    }));
    const rows = [{ label: `${capitalize(chip.key)} — ${d.name}`, before: `${before}%`, after: `${after}%` }];
    if (chip.key === "traffic") {
      rows.push({ label: "Estimated delay", before: "0 min", after: `+${Math.max(0, Math.round((after - before) * 0.6))} min` });
    }
    setImpactResult({
      title: `${chip.label} → ${d.name}`,
      rows,
      note: `Affected roads: ${districtRoadMap[d.id].map((i) => `${cityData.roads[i].axis.toUpperCase()}-${cityData.roads[i].pos}`).join(", ")}`,
    });
  };

  const placeConstructionAt = (point) => {
    const weeks = 4 + Math.round(Math.random() * 20);
    const nearest = DISTRICTS.reduce((best, d) => {
      const dist = Math.hypot(d.cx - point.x, d.cz - point.z);
      return !best || dist < best.dist ? { d, dist } : best;
    }, null);
    const zone = {
      id: Date.now(), x: point.x, z: point.z, radius: 4 + Math.random() * 3, weeks,
      district: nearest.d.name,
      trafficImpact: Math.round(15 + Math.random() * 25),
      popImpact: Math.round(50 + Math.random() * 400),
    };
    setConstructionZones((zs) => [...zs, zone]);
    setImpactResult({
      title: `Construction added — ${nearest.d.name}`,
      rows: [
        { label: "Traffic increase (nearby)", before: "0%", after: `+${zone.trafficImpact}%` },
        { label: "Estimated timeline", before: "—", after: `${weeks} weeks` },
        { label: "Nearby residents affected", before: "0", after: `${zone.popImpact}` },
      ],
      note: "Construction zone added to the 3D city — visible as a rotating amber marker. Nearby roads will see elevated congestion for the duration of the project.",
    });
    setTool("none");
  };

  const selectRoadForClosure = (idx) => {
    const r = cityData.roads[idx];
    const eff = stateRef.current.effectiveTraffic;
    const before = Math.round((eff && eff[idx] != null ? eff[idx] : r.traffic) * 100);
    const altIdx = cityData.roads.findIndex((r2, i2) => i2 !== idx && r2.axis === r.axis && Math.abs(Math.abs(r2.pos - r.pos) - 10) < 0.01);
    const affected = DISTRICTS.filter((d) => districtRoadMap[d.id].includes(idx)).map((d) => d.name);
    setRoadClosurePending({
      idx, before, delay: Math.round(before * 0.5 + 8),
      affected: affected.length ? affected : ["No adjacent district"],
      alternative: altIdx >= 0 ? `${cityData.roads[altIdx].axis.toUpperCase()}-axis road at ${cityData.roads[altIdx].pos}` : "None nearby",
    });
    setPanel("road-confirm");
  };

  const confirmRoadClosure = () => {
    if (!roadClosurePending) return;
    setRoadClosures((set) => new Set([...set, roadClosurePending.idx]));
    setImpactResult({
      title: "Road closed",
      rows: [
        { label: "Traffic (this road)", before: `${roadClosurePending.before}%`, after: "0%" },
        { label: "Estimated delay", before: "0 min", after: `+${roadClosurePending.delay} min` },
      ],
      note: `Affected: ${roadClosurePending.affected.join(", ")}. Alternative route: ${roadClosurePending.alternative}.`,
    });
    setRoadClosurePending(null);
    setPanel(null);
    setTool("none");
  };

  const triggerEmergency = (type) => {
    const b = cityData.buildings[Math.floor(Math.random() * cityData.buildings.length)];
    const impact = EMERGENCY_IMPACT[type];
    setEmergency({
      type, x: b.x, z: b.z, district: b.district,
      severity: ["Low", "Moderate", "High", "Critical"][Math.floor(Math.random() * 4)],
      eta: Math.round(3 + Math.random() * 12),
      radius: impact.radius,
      popAffected: Math.round(impact.popFactor * (0.7 + Math.random() * 0.6)),
      infra: impact.infra, response: impact.response,
    });
    setLayers((l) => ({ ...l, emergency: true }));
    setPanel(null);
  };

  const placeEmergencyAt = (point) => {
    const type = pendingEmergencyType || "Fire";
    const impact = EMERGENCY_IMPACT[type];
    const nearest = DISTRICTS.reduce((best, d) => {
      const dist = Math.hypot(d.cx - point.x, d.cz - point.z);
      return !best || dist < best.dist ? { d, dist } : best;
    }, null);
    setEmergency({
      type, x: point.x, z: point.z, district: nearest.d.name,
      severity: ["Low", "Moderate", "High", "Critical"][Math.floor(Math.random() * 4)],
      eta: Math.round(3 + Math.random() * 12),
      radius: impact.radius,
      popAffected: Math.round(impact.popFactor * (0.7 + Math.random() * 0.6)),
      infra: impact.infra, response: impact.response,
    });
    setLayers((l) => ({ ...l, emergency: true }));
    setTool("none");
  };

  const resetSimulation = () => {
    setSimParams(SIM_DEFAULT);
    setRoadClosures(new Set());
    setConstructionZones([]);
    setDistrictBoosts({});
    setImpactResult(null);
    setTool("none");
    setBaseline({ score: cityScore, traffic: Math.round(trafficByHour[2].traffic), energy: totalEnergy });
  };

  const toggleSimMode = () => {
    if (!simMode) setBaseline({ score: cityScore, traffic: Math.round(trafficByHour[2].traffic), energy: totalEnergy });
    setSimMode((m) => !m);
  };

  /* ---------- walkable villa interior: fade transition + render pause ---------- */
  const enterVilla = () => {
    setVillaFade(true);
    setTimeout(() => {
      setVillaOpen(true);
      if (stateRef.current) stateRef.current.paused = true;
    }, 420);
    setTimeout(() => setVillaFade(false), 900);
  };
  const exitVilla = () => {
    setVillaFade(true);
    setTimeout(() => {
      setVillaOpen(false);
      if (stateRef.current) { stateRef.current.paused = false; stateRef.current.clock?.getDelta(); }
    }, 420);
    setTimeout(() => setVillaFade(false), 900);
  };

  const genReport = () => {
    const lines = [
      "CITYVERSE — CITY REPORT (simulated demo data)",
      `Generated: ${new Date().toLocaleString()}`,
      "",
      `City Intelligence Score: ${cityScore}/100${simMode ? ` (baseline ${baseline?.score ?? "n/a"})` : ""}`,
      `Total simulated energy demand: ${totalEnergy.toLocaleString()} kWh`,
      `Average building occupancy: ${avgOccupancy}%`,
      `Buildings tracked: ${cityData.buildings.length}`,
      simMode ? `Simulation active — Traffic ${simParams.traffic}%, Population ${simParams.population}%, Energy ${simParams.energy}%, Water ${simParams.water}%, Transport ${simParams.transport}%` : "Simulation mode: off",
      simMode && roadClosures.size ? `Closed roads: ${[...roadClosures].map((i) => `${cityData.roads[i].axis}-axis@${cityData.roads[i].pos}`).join(", ")}` : "",
      simMode && constructionZones.length ? `Construction zones: ${constructionZones.length}` : "",
      "",
      "Energy by district:",
      ...energyByDistrict.map((e) => `  - ${e.name}: ${e.energy.toLocaleString()} kWh`),
      "",
      "Traffic by hour (demo):",
      ...trafficByHour.map((t) => `  - ${t.h}: ${t.traffic}% congestion index`),
    ].filter(Boolean).join("\n");
    const blob = new Blob([lines], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cityverse-report.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  const aqiFor = (districtId) => {
    const map = { industrial: 138, downtown: 78, commercial: 62, residential: 34, university: 40, shopping: 55, airport: 90, hospital: 48 };
    let v = map[districtId] ?? 50;
    if (simMode) v = clamp(Math.round(v * (0.7 + simParams.energy / 160)), 5, 300);
    return { v, ...AQI_LEVELS.find((l) => v <= l.max) };
  };

  /* ---------- AI assistant (calls Claude via the Anthropic API) ---------- */
  const sendAiMessage = async () => {
    const q = aiInput.trim();
    if (!q || aiBusy) return;
    setAiInput("");
    setAiMessages((m) => [...m, { role: "user", text: q }]);
    setAiBusy(true);
    try {
      const topEnergy = [...cityData.buildings].sort((a, b) => b.energy - a.energy).slice(0, 5)
        .map((b) => `${b.name} (${b.district}): ${b.energy} kWh`).join("; ");
      const busiestRoads = cityData.roads
        .map((r, i) => ({ r, i, lvl: stateRef.current.effectiveTraffic ? stateRef.current.effectiveTraffic[i] : r.traffic }))
        .sort((a, b) => b.lvl - a.lvl).slice(0, 4)
        .map((x) => `${x.r.axis}-axis road at ${x.r.pos}: ${trafficLabel(x.lvl)}${roadClosures.has(x.i) ? " (CLOSED)" : ""}`).join("; ");
      const districtSummary = DISTRICTS.map((d) => `${d.name} (${cityData.buildings.filter((b) => b.districtId === d.id).length} buildings)`).join("; ");

      const simSummary = simMode
        ? `SIMULATION MODE IS ACTIVE. Parameters — Traffic ${simParams.traffic}%, Population ${simParams.population}%, Energy demand ${simParams.energy}%, Water demand ${simParams.water}%, Public transport usage ${simParams.transport}%, Construction activity ${simParams.construction}%, Weather severity ${simParams.weatherSeverity}%. Closed roads: ${roadClosures.size ? [...roadClosures].map((i) => `${cityData.roads[i].axis}-axis at ${cityData.roads[i].pos}`).join(", ") : "none"}. Active construction zones: ${constructionZones.length ? constructionZones.map((z) => `${z.district} (+${z.trafficImpact}% traffic, ${z.weeks}w)`).join("; ") : "none"}. District-specific boosts applied: ${Object.keys(districtBoosts).length ? Object.entries(districtBoosts).map(([id, v]) => `${DISTRICTS.find((d) => d.id === id)?.name}: ${Object.entries(v).map(([k, val]) => `${k} ${val > 0 ? "+" : ""}${val}%`).join(", ")}`).join("; ") : "none"}. Baseline before simulation — City Score ${baseline?.score ?? "n/a"}, Traffic ${baseline?.traffic ?? "n/a"}%, Energy ${baseline?.energy?.toLocaleString() ?? "n/a"} kWh. Current City Score: ${cityScore}.`
        : `Simulation mode is OFF — describe the baseline (non-simulated) city. You can still explain what WOULD happen if the user enabled simulation and changed a parameter, clearly labeled as a hypothetical estimate, not a live simulation result.`;

      const system = `You are the CityVerse AI assistant embedded in a 3D smart-city digital twin demo with a live simulation engine. Answer using ONLY this simulated demo data, and always make clear figures are simulated, not real. Be concise (2-5 sentences), concrete, and reference specific districts/buildings/roads/numbers from the data below. Never invent numbers not derivable from this context.
Districts: ${districtSummary}
City score: ${cityScore}/100. Average building occupancy: ${avgOccupancy}%. Total energy demand: ${totalEnergy} kWh (simulated).
Top energy-consuming buildings: ${topEnergy}.
Busiest roads right now: ${busiestRoads}.
Air quality demo: Downtown Moderate, Industrial Unhealthy, Residential Good, Parks Good.
Current emergency: ${emergency ? `${emergency.type} in ${emergency.district}, severity ${emergency.severity}, ~${emergency.popAffected} people affected` : "none active"}.
${simSummary}`;

      const resp = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          messages: [{ role: "user", content: q }],
        }),
      });
      const data = await resp.json();
      const text = (data.content || []).map((c) => c.text || "").join("\n").trim() || "I couldn't generate a response just now — try again.";
      setAiMessages((m) => [...m, { role: "assistant", text }]);
    } catch (e) {
      setAiMessages((m) => [...m, { role: "assistant", text: "I'm having trouble reaching the analysis engine right now. Please try again." }]);
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden font-sans">
      <style>{`
        .glass { background: rgba(10,14,24,0.72); backdrop-filter: blur(16px); border: 1px solid rgba(148,163,184,0.15); }
        .sheet { animation: sheetUp .28s cubic-bezier(.2,.8,.2,1); }
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes simPulse { 0%,100%{ box-shadow: inset 0 0 0 2px rgba(34,211,238,.25);} 50%{ box-shadow: inset 0 0 0 2px rgba(168,85,247,.55);} }
        @keyframes fadeBlack { 0%{opacity:0} 45%{opacity:1} 100%{opacity:0} }
      `}</style>

      <div ref={mountRef} className="absolute inset-0" />

      {lightningFlash && <div className="absolute inset-0 bg-white pointer-events-none z-40" style={{ opacity: 0.35 }} />}

      {villaFade && <div className="absolute inset-0 bg-black z-[60] pointer-events-none" style={{ animation: "fadeBlack 0.9s ease-in-out" }} />}
      {villaOpen && <VillaInterior hour={hour} weather={weather} onExit={exitVilla} />}

      {simMode && (
        <div className="absolute inset-0 pointer-events-none z-10" style={{ animation: "simPulse 2.4s ease-in-out infinite" }} />
      )}

      {dragChip && (
        <div className="fixed z-50 pointer-events-none px-3 py-1.5 rounded-full text-[10px] font-semibold shadow-lg"
          style={{ left: dragChip.x - 45, top: dragChip.y - 16, background: dragChip.chip.color, color: "#000" }}>
          {dragChip.chip.label}
        </div>
      )}

      {/* top status bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 pointer-events-none z-20">
        <div className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 pointer-events-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          <span className="text-[11px] font-semibold tracking-wide">CITYVERSE</span>
        </div>
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button onClick={toggleSimMode}
            className={`rounded-full px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-semibold ${simMode ? "bg-gradient-to-r from-cyan-400 to-purple-400 text-black" : "glass text-white"}`}>
            <SlidersHorizontal size={12} /> {simMode ? "Simulating" : "Simulate"}
          </button>
          <button onClick={() => setPanel(panel === "score" ? null : "score")} className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <Gauge size={12} className="text-emerald-400" />
            <span className="text-[11px] font-semibold">{cityScore}</span>
          </button>
        </div>
      </div>

      <div className="absolute top-14 left-4 pointer-events-none z-20">
        <div className="glass rounded-lg px-2.5 py-1 text-[10px] text-slate-300 flex items-center gap-1">
          <Clock size={10} /> {TIME_PRESETS[hour].label} · {WEATHER_MODES.find((w) => w.id === weather).label}
        </div>
      </div>

      {/* street-level explore toggle */}
      <div className="absolute bottom-[74px] left-3 z-20">
        <button
          onClick={() => { setSelectedBuilding(null); setStreetLevel((v) => !v); }}
          className={`glass rounded-full px-3 py-2 flex items-center gap-1.5 text-[10.5px] font-semibold ${streetLevel ? "border-cyan-400/60 text-cyan-300" : "text-slate-200"}`}
        >
          <Eye size={13} /> {streetLevel ? "Return to Sky View" : "Explore at Street Level"}
        </button>
      </div>

      {panel === "score" && (
        <div className="absolute top-14 right-4 w-56 glass rounded-2xl p-4 sheet z-30">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">City Intelligence Score</div>
          <div className="text-3xl font-bold text-emerald-400 mb-2">{cityScore}<span className="text-sm text-slate-500">/100</span></div>
          {simMode && baseline && (
            <div className="text-[10px] text-slate-400 mb-2">Baseline before simulation: {baseline.score}</div>
          )}
          <div className="space-y-1.5 text-[11px] text-slate-300">
            <ScoreRow label="Transportation" v={clamp(82 - (simMode ? Math.round((simParams.traffic - 50) * 0.3) : 0), 0, 100)} />
            <ScoreRow label="Energy" v={clamp(74 - (simMode ? Math.round((simParams.energy - 50) * 0.3) : 0), 0, 100)} />
            <ScoreRow label="Environment" v={78} />
            <ScoreRow label="Infrastructure" v={clamp(88 - (simMode ? constructionZones.length * 2 : 0), 0, 100)} />
            <ScoreRow label="Public Safety" v={emergency ? 62 : 91} />
            <ScoreRow label="Sustainability" v={69} />
          </div>
        </div>
      )}

      {tool !== "none" && (
        <div className="absolute top-24 left-4 right-4 glass rounded-xl px-3 py-2 flex items-center justify-between z-20">
          <span className="text-[11px] text-slate-300">
            {tool === "construction" && "Tap the city to place a construction zone"}
            {tool === "road-closure" && "Tap a road to select it for closure"}
            {tool === "emergency" && `Tap the city to place a ${pendingEmergencyType} incident`}
          </span>
          <button onClick={() => setTool("none")} className="text-[10px] text-slate-400 shrink-0 ml-2">Cancel</button>
        </div>
      )}

      {emergency && tool === "none" && (
        <div className="absolute top-24 left-4 right-4 glass rounded-xl px-3 py-2 flex items-start gap-2 z-20">
          <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-red-300">{emergency.type} — {emergency.district}</div>
            <div className="text-[10px] text-slate-400">Severity: {emergency.severity} · ETA {emergency.eta} min · ~{emergency.popAffected} affected · responder en route</div>
          </div>
          <button onClick={() => { setEmergency(null); setLayers((l) => ({ ...l, emergency: false })); }} className="text-slate-400"><X size={14} /></button>
        </div>
      )}

      {selectedBuilding && !interiorView && (
        <div className="absolute bottom-16 left-0 right-0 px-3 z-30">
          <div className="glass rounded-2xl p-4 sheet max-w-md mx-auto">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">{selectedBuilding.district}</div>
                <div className="text-base font-semibold">{selectedBuilding.name}</div>
              </div>
              <button onClick={() => { setSelectedBuilding(null); setEnergyMode(false); }} className="text-slate-400"><X size={16} /></button>
            </div>
            <div
              className="w-full h-16 rounded-lg mb-3 flex items-end justify-center gap-[3px] p-2"
              style={{ background: `linear-gradient(180deg, ${selectedBuilding.baseColor}22, transparent)` }}
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="w-2 rounded-t-sm" style={{
                  height: `${20 + ((i * 13 + selectedBuilding.id) % 40)}px`,
                  background: selectedBuilding.baseColor,
                  opacity: energyMode ? 0.35 : 0.85,
                }} />
              ))}
            </div>
            {!energyMode ? (
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <Stat label="Floors" value={selectedBuilding.floors} />
                <Stat label="Occupancy" value={`${selectedBuilding.occupancy}%`} />
                <Stat label="Built" value={selectedBuilding.year} />
                <Stat label="Energy" value={`${selectedBuilding.energy} kWh`} icon={<Zap size={10} />} />
                <Stat label="Water" value={`${selectedBuilding.water} L`} icon={<Droplets size={10} />} />
                <Stat label="Status" value={selectedBuilding.status} />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mb-3">
                <Stat label="Current draw" value={`${selectedBuilding.energy} kWh`} icon={<Zap size={10} />} />
                <Stat label="Solar gen" value={`${selectedBuilding.solar} kWh`} />
                <Stat label="Efficiency" value={`${100 - Math.round(selectedBuilding.energy / 40)}%`} />
                <Stat label="Carbon" value={`${selectedBuilding.carbon} kg`} />
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setEnergyMode((e) => !e)}
                className="flex-1 text-[11px] font-medium rounded-lg py-2 bg-cyan-400/10 border border-cyan-400/30 text-cyan-300"
              >
                {energyMode ? "View building details" : "Switch to Energy Mode"}
              </button>
              {selectedBuilding.hasInterior && (
                <button
                  onClick={() => (selectedBuilding.interiorKind === "house" ? enterVilla() : setInteriorView(INTERIOR_PRESETS[selectedBuilding.interiorKind]))}
                  className="flex-1 text-[11px] font-medium rounded-lg py-2 bg-purple-400/10 border border-purple-400/30 text-purple-300 flex items-center justify-center gap-1"
                >
                  <DoorOpen size={13} /> {selectedBuilding.interiorKind === "house" ? "Enter Building (walkable)" : "Enter Building"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* interior preview */}
      {interiorView && (
        <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-3 pb-3">
          <div className="glass w-full max-w-md rounded-2xl p-4 sheet max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <button onClick={() => setInteriorView(null)} className="text-slate-400 flex items-center gap-1 text-[11px]"><ArrowLeft size={14} /> Exit Building</button>
              <span className="text-[9px] text-slate-500">Interior preview</span>
            </div>
            <div className="text-[15px] font-semibold mb-3">{interiorView.title}</div>
            <div className="space-y-2.5">
              {interiorView.rooms.map((room) => (
                <div key={room.name} className="rounded-xl p-3" style={{ background: `${room.color}14`, border: `1px solid ${room.color}40` }}>
                  <div className="text-[12px] font-semibold mb-1.5" style={{ color: room.color }}>{room.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {room.items.map((it) => (
                      <span key={it} className="text-[10px] px-2 py-1 rounded-full bg-black/30 text-slate-300 border border-white/10">{it}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[9px] text-slate-500 leading-relaxed">
              Lightweight interior preview — a stylized floor plan, not yet a walkable 3D room. See the project README for how this becomes a full 3D interior.
            </div>
          </div>
        </div>
      )}

      {impactResult && !selectedBuilding && !interiorView && (
        <div className="absolute bottom-16 left-0 right-0 px-3 z-30">
          <div className="glass rounded-2xl p-4 sheet max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-semibold">{impactResult.title}</span>
              <button onClick={() => setImpactResult(null)} className="text-slate-400"><X size={16} /></button>
            </div>
            <div className="space-y-2 mb-2">
              {impactResult.rows.map((r, i) => <CompareRow key={i} label={r.label} before={r.before} after={r.after} />)}
            </div>
            {impactResult.note && <div className="text-[10px] text-slate-500">{impactResult.note}</div>}
          </div>
        </div>
      )}

      {panel === "districts" && (
        <BottomSheet title="Districts" onClose={() => setPanel(null)}>
          <div className="grid grid-cols-2 gap-2">
            {DISTRICTS.map((d) => (
              <button key={d.id} onClick={() => flyToDistrict(d)} className="glass rounded-xl p-3 text-left">
                <div className="w-2 h-2 rounded-full mb-1.5" style={{ background: d.color }} />
                <div className="text-[12px] font-medium">{d.name}</div>
                <div className="text-[10px] text-slate-500">{cityData.buildings.filter((b) => b.districtId === d.id).length} buildings</div>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {panel === "layers" && (
        <BottomSheet title="City Layers" onClose={() => setPanel(null)}>
          <div className="space-y-1">
            {[
              ["buildings", "Buildings", Building2],
              ["roads", "Roads", MapPin],
              ["traffic", "Traffic", Car],
              ["parks", "Parks", Sparkles],
              ["water", "Water network", Droplets],
              ["energy", "Energy flow", Zap],
            ].map(([key, label, Icon]) => (
              <button key={key} onClick={() => setLayers((l) => ({ ...l, [key]: !l[key] }))}
                className="w-full flex items-center justify-between glass rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 text-[12px]"><Icon size={14} className="text-cyan-300" />{label}</div>
                <div className={`w-9 h-5 rounded-full relative transition-colors ${layers[key] ? "bg-cyan-400" : "bg-slate-700"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${layers[key] ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {panel === "time" && (
        <BottomSheet title="Time & Weather" onClose={() => setPanel(null)}>
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Time of day — {TIME_PRESETS[hour].label}</div>
            <input type="range" min={0} max={TIME_PRESETS.length - 1} value={hour}
              onChange={(e) => setHour(Number(e.target.value))} className="w-full accent-cyan-400" />
            <div className="flex justify-between text-[9px] text-slate-500 mt-1">
              {TIME_PRESETS.map((t) => <span key={t.h}>{t.label}</span>)}
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Weather</div>
          <div className="grid grid-cols-3 gap-2">
            {WEATHER_MODES.map((w) => (
              <button key={w.id} onClick={() => setWeather(w.id)}
                className={`glass rounded-xl py-2.5 flex flex-col items-center gap-1 ${weather === w.id ? "border-cyan-400/60" : ""}`}>
                <w.icon size={16} className={weather === w.id ? "text-cyan-300" : "text-slate-400"} />
                <span className="text-[10px]">{w.label}</span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {panel === "analytics" && (
        <BottomSheet title="Smart City Analytics" onClose={() => setPanel(null)} tall>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Stat label="Population" value={`${(1.24 * (simMode ? simParams.population / 50 : 1)).toFixed(2)}M`} />
            <Stat label="Public transport" value={`${simMode ? clamp(87 - Math.round((50 - simParams.transport) * 0.4), 20, 99) : 87}% uptime`} />
            <Stat label="Infra. health" value={`${clamp(91 - (simMode ? constructionZones.length * 2 + roadClosures.size : 0), 0, 100)}%`} />
            <Stat label="Emergency alerts" value={emergency ? "1 active" : "0 active"} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Energy by district (kWh)</div>
          <div className="h-36 mb-4 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={energyByDistrict}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: "#94a3b8" }} interval={0} angle={-30} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} width={30} />
                <RTooltip contentStyle={{ background: "#0a0e1a", border: "1px solid #1e293b", fontSize: 11 }} />
                <Bar dataKey="energy" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Traffic congestion index (24h demo)</div>
          <div className="h-32 mb-4 -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trafficByHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="h" tick={{ fontSize: 8, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 8, fill: "#94a3b8" }} width={26} />
                <RTooltip contentStyle={{ background: "#0a0e1a", border: "1px solid #1e293b", fontSize: 11 }} />
                <Line type="monotone" dataKey="traffic" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Air quality by district</div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {DISTRICTS.slice(0, 6).map((d) => {
              const aq = aqiFor(d.id);
              return (
                <div key={d.id} className="glass rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-300">{d.name.split(" ")[0]}</span>
                  <span className="text-[10px] font-semibold" style={{ color: aq.color }}>{aq.label}</span>
                </div>
              );
            })}
          </div>
          <button onClick={genReport} className="w-full text-[11px] font-medium rounded-lg py-2.5 bg-white/10 border border-white/15 flex items-center justify-center gap-1.5">
            <BarChart3 size={13} /> Export city report (.txt)
          </button>
          <div className="mt-3 text-[9px] text-slate-500 leading-relaxed">
            All figures are simulated demo data for illustration — no live sensors or external APIs are connected. Architecture supports future integration with real weather, traffic, GIS and IoT feeds.
          </div>
        </BottomSheet>
      )}

      {panel === "ai" && (
        <BottomSheet title="AI City Assistant" onClose={() => setPanel(null)} tall>
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1" style={{ maxHeight: "42vh" }}>
              {aiMessages.map((m, i) => (
                <div key={i} className={`text-[12px] rounded-xl px-3 py-2 max-w-[88%] leading-relaxed ${m.role === "user" ? "ml-auto bg-cyan-400/15 text-cyan-100" : "glass"}`}>
                  {m.text}
                </div>
              ))}
              {aiBusy && <div className="text-[11px] text-slate-500 px-1">Analyzing city data…</div>}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {["What will happen if traffic increases by 40%?", "Which district is most affected right now?", "Where should we build another hospital?", "How can we reduce energy consumption?"].map((q) => (
                <button key={q} onClick={() => setAiInput(q)} className="text-[10px] glass rounded-full px-2.5 py-1 text-slate-300">{q}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendAiMessage()}
                placeholder="Ask about the city or simulation…"
                className="flex-1 glass rounded-full px-3.5 py-2 text-[12px] outline-none placeholder:text-slate-500"
              />
              <button onClick={sendAiMessage} disabled={aiBusy} className="w-9 h-9 rounded-full bg-cyan-400 text-black flex items-center justify-center shrink-0 disabled:opacity-50">
                <Send size={14} />
              </button>
            </div>
          </div>
        </BottomSheet>
      )}

      {panel === "emergency" && (
        <BottomSheet title="Emergency Management" onClose={() => setPanel(null)} tall>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {Object.keys(EMERGENCY_IMPACT).map((t) => {
              const Icon = EMERGENCY_ICONS[t];
              return (
                <button key={t} onClick={() => triggerEmergency(t)} className="glass rounded-xl p-3 flex flex-col items-center gap-1.5 border-red-500/20">
                  <Icon size={18} className="text-red-400" />
                  <span className="text-[11px]">{t}</span>
                </button>
              );
            })}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Or place manually on the map</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.keys(EMERGENCY_IMPACT).map((t) => (
              <button key={t} onClick={() => { setPendingEmergencyType(t); setTool("emergency"); setPanel(null); }}
                className={`text-[10px] rounded-full px-2.5 py-1 glass ${pendingEmergencyType === t ? "border-red-400/60 text-red-300" : ""}`}>{t}</button>
            ))}
          </div>
          {emergency && (
            <div className="glass rounded-xl p-3 mb-2 text-[11px] space-y-1">
              <div className="font-semibold text-red-300">{emergency.type} — {emergency.district}</div>
              <div className="text-slate-400">Severity: {emergency.severity} · ETA {emergency.eta} min</div>
              <div className="text-slate-400">Population affected: ~{emergency.popAffected}</div>
              <div className="text-slate-400">Infrastructure: {emergency.infra}</div>
              <div className="text-slate-400">Response: {emergency.response}</div>
              <div className="text-slate-400">A responder vehicle is animated driving to the incident in the 3D view.</div>
            </div>
          )}
          {emergency && (
            <button onClick={() => { setEmergency(null); setLayers((l) => ({ ...l, emergency: false })); setPanel(null); }}
              className="w-full text-[11px] rounded-lg py-2 bg-white/10 border border-white/15">
              Clear active alert
            </button>
          )}
        </BottomSheet>
      )}

      {panel === "road-confirm" && roadClosurePending && (
        <BottomSheet title="Close Road?" onClose={() => { setPanel(null); setTool("none"); setRoadClosurePending(null); }}>
          <div className="space-y-2 mb-3">
            <CompareRow label="Traffic" before={`${roadClosurePending.before}%`} after="0% (closed)" />
            <div className="text-[11px] text-slate-400">Affected districts: {roadClosurePending.affected.join(", ")}</div>
            <div className="text-[11px] text-slate-400">Estimated delay: +{roadClosurePending.delay} min</div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1"><Route size={12} /> Alternative: {roadClosurePending.alternative}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setPanel(null); setTool("none"); setRoadClosurePending(null); }} className="flex-1 text-[11px] rounded-lg py-2 bg-white/10 border border-white/15">Cancel</button>
            <button onClick={confirmRoadClosure} className="flex-1 text-[11px] rounded-lg py-2 bg-red-500/20 border border-red-500/40 text-red-300 flex items-center justify-center gap-1"><Ban size={13} /> Close Road</button>
          </div>
        </BottomSheet>
      )}

      {panel === "sim" && (
        <BottomSheet title="Simulation Mode" onClose={() => setPanel(null)} tall>
          <button
            onClick={toggleSimMode}
            className={`w-full rounded-xl py-3 mb-4 font-semibold text-[12px] flex items-center justify-center gap-2 ${simMode ? "bg-gradient-to-r from-cyan-400 to-purple-400 text-black" : "bg-white/10 border border-white/15 text-white"}`}
          >
            <SlidersHorizontal size={15} /> {simMode ? "Simulation Mode: ON" : "Enable Simulation Mode"}
          </button>

          {!simMode ? (
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Simulation Mode lets you stress-test the city: adjust traffic, population, energy and water demand, close roads, add construction, and drag impacts onto districts — all live against the 3D city and analytics. Nothing here affects real data.
            </div>
          ) : (
            <>
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Drag-to-simulate</div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {DRAG_CHIPS.map((chip) => (
                    <div key={chip.id}
                      onPointerDown={(e) => { setDragChip({ chip, x: e.clientX, y: e.clientY }); }}
                      onTouchStart={(e) => { const p = e.touches[0]; setDragChip({ chip, x: p.clientX, y: p.clientY }); }}
                      className="text-[10px] font-medium rounded-full px-3 py-1.5 cursor-grab active:cursor-grabbing touch-none"
                      style={{ background: `${chip.color}22`, border: `1px solid ${chip.color}55`, color: chip.color }}
                    >
                      {chip.label}
                    </div>
                  ))}
                </div>
                <div className="text-[9px] text-slate-500 mb-2">Drag a chip onto a district to simulate a local impact</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {DISTRICTS.map((d) => (
                    <div key={d.id} ref={(node) => (districtRefs.current[d.id] = node)} className="glass rounded-lg py-2 text-center">
                      <div className="w-1.5 h-1.5 rounded-full mx-auto mb-1" style={{ background: d.color }} />
                      <div className="text-[8.5px] text-slate-300">{d.name.split(" ")[0]}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4 space-y-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Global parameters</div>
                {[
                  ["traffic", "Traffic Volume", "#f97316"],
                  ["population", "Population", "#3b82f6"],
                  ["energy", "Energy Demand", "#eab308"],
                  ["water", "Water Demand", "#22d3ee"],
                  ["transport", "Public Transport Usage", "#10b981"],
                  ["construction", "Construction Activity", "#a855f7"],
                  ["weatherSeverity", "Weather Severity", "#94a3b8"],
                ].map(([key, label, c]) => (
                  <div key={key}>
                    <div className="flex justify-between text-[10px] mb-1"><span>{label}</span><span style={{ color: c }}>{simParams[key]}%</span></div>
                    <input type="range" min={0} max={100} value={simParams[key]}
                      onChange={(e) => setSimParams((p) => ({ ...p, [key]: Number(e.target.value) }))}
                      className="w-full" style={{ accentColor: c }} />
                  </div>
                ))}
              </div>

              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">City tools — tap the 3D city to place</div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { setTool(tool === "construction" ? "none" : "construction"); setPanel(null); }}
                    className={`glass rounded-xl py-2.5 flex flex-col items-center gap-1 ${tool === "construction" ? "border-amber-400/60" : ""}`}>
                    <HardHat size={16} className={tool === "construction" ? "text-amber-300" : "text-slate-400"} />
                    <span className="text-[10px]">Add Construction</span>
                  </button>
                  <button onClick={() => { setTool(tool === "road-closure" ? "none" : "road-closure"); setPanel(null); }}
                    className={`glass rounded-xl py-2.5 flex flex-col items-center gap-1 ${tool === "road-closure" ? "border-red-400/60" : ""}`}>
                    <Ban size={16} className={tool === "road-closure" ? "text-red-300" : "text-slate-400"} />
                    <span className="text-[10px]">Close a Road</span>
                  </button>
                </div>
              </div>

              {constructionZones.length > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Active construction ({constructionZones.length})</div>
                  <div className="space-y-1.5">
                    {constructionZones.map((z) => (
                      <div key={z.id} className="glass rounded-lg px-3 py-2 flex items-center justify-between">
                        <div>
                          <div className="text-[11px]">{z.district}</div>
                          <div className="text-[9px] text-slate-500">+{z.trafficImpact}% traffic · {z.weeks}w timeline</div>
                        </div>
                        <button onClick={() => setConstructionZones((zs) => zs.filter((x) => x.id !== z.id))} className="text-slate-400"><X size={13} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {roadClosures.size > 0 && (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Closed roads ({roadClosures.size})</div>
                  <div className="space-y-1.5">
                    {[...roadClosures].map((idx) => {
                      const r = cityData.roads[idx];
                      return (
                        <div key={idx} className="glass rounded-lg px-3 py-2 flex items-center justify-between">
                          <span className="text-[11px]">{r.axis.toUpperCase()}-axis at {r.pos}</span>
                          <button onClick={() => setRoadClosures((set) => { const n = new Set(set); n.delete(idx); return n; })} className="text-[10px] text-cyan-300">Reopen</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {baseline && (
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Before / After — since simulation started</div>
                  <div className="space-y-1.5">
                    <CompareRow label="City Score" before={baseline.score} after={cityScore} />
                    <CompareRow label="Traffic (avg)" before={`${baseline.traffic}%`} after={`${trafficByHour[2].traffic}%`} />
                    <CompareRow label="Energy demand" before={`${baseline.energy.toLocaleString()} kWh`} after={`${totalEnergy.toLocaleString()} kWh`} />
                  </div>
                </div>
              )}

              <button onClick={resetSimulation} className="w-full text-[11px] rounded-lg py-2 bg-white/10 border border-white/15">Reset simulation</button>
            </>
          )}
        </BottomSheet>
      )}

      {panel === null && (
        <div className="absolute bottom-16 right-3 glass rounded-xl px-2.5 py-2 text-[9px] space-y-1 pointer-events-none z-10">
          <div className="text-slate-400 mb-0.5">Traffic</div>
          <LegendDot c="#22c55e" l="Low" /><LegendDot c="#eab308" l="Moderate" /><LegendDot c="#f97316" l="Heavy" /><LegendDot c="#ef4444" l="Severe" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 pb-4 pt-2 px-2">
        <div className="glass rounded-2xl px-1.5 py-2 flex items-center justify-between max-w-md mx-auto">
          <DockBtn icon={MapPin} label="Districts" active={panel === "districts"} onClick={() => setPanel(panel === "districts" ? null : "districts")} />
          <DockBtn icon={LayersIcon} label="Layers" active={panel === "layers"} onClick={() => setPanel(panel === "layers" ? null : "layers")} />
          <DockBtn icon={Clock} label="Time" active={panel === "time"} onClick={() => setPanel(panel === "time" ? null : "time")} />
          <DockBtn icon={SlidersHorizontal} label="Simulate" active={panel === "sim" || simMode} onClick={() => setPanel(panel === "sim" ? null : "sim")} />
          <DockBtn icon={BarChart3} label="Analytics" active={panel === "analytics"} onClick={() => setPanel(panel === "analytics" ? null : "analytics")} />
          <DockBtn icon={Sparkles} label="AI" active={panel === "ai"} onClick={() => setPanel(panel === "ai" ? null : "ai")} />
          <DockBtn icon={AlertTriangle} label="Alert" active={panel === "emergency"} onClick={() => setPanel(panel === "emergency" ? null : "emergency")} warn />
        </div>
      </div>
    </div>
  );
}

function DockBtn({ icon: Icon, label, active, onClick, warn }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl min-w-[40px]">
      <Icon size={16} className={active ? (warn ? "text-red-400" : "text-cyan-300") : "text-slate-400"} />
      <span className={`text-[8px] ${active ? "text-white" : "text-slate-500"}`}>{label}</span>
    </button>
  );
}

function BottomSheet({ title, children, onClose, tall }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3">
      <div className={`glass w-full max-w-md rounded-2xl p-4 sheet ${tall ? "max-h-[72vh]" : "max-h-[60vh]"} overflow-y-auto`}>
        <div className="flex items-center justify-between mb-3 sticky top-0">
          <span className="text-[12px] font-semibold tracking-wide">{title}</span>
          <button onClick={onClose} className="text-slate-400"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="glass rounded-lg py-2 px-1.5">
      <div className="text-[13px] font-semibold flex items-center justify-center gap-1">{icon}{value}</div>
      <div className="text-[8.5px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function ScoreRow({ label, v }) {
  return (
    <div>
      <div className="flex justify-between mb-0.5"><span>{label}</span><span className="text-slate-500">{v}</span></div>
      <div className="h-1 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function CompareRow({ label, before, after }) {
  return (
    <div className="glass rounded-lg px-3 py-2 flex items-center justify-between">
      <span className="text-[11px] text-slate-300">{label}</span>
      <span className="text-[11px] flex items-center gap-1.5">
        <span className="text-slate-500">{before}</span>
        <ChevronRight size={11} className="text-slate-600" />
        <span className="font-semibold text-cyan-300">{after}</span>
      </span>
    </div>
  );
}

function LegendDot({ c, l }) {
  return <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{ background: c }} /><span className="text-slate-400">{l}</span></div>;
}
