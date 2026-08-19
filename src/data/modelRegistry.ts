// @ts-nocheck
//
// Centralized registry of every 3D asset the app knows about — real or
// procedural. Nothing in here is loaded eagerly; components look up an
// entry by id and decide what to do with it (load the .glb if `available`
// is true, otherwise fall back to the procedural version already built
// into CityVerse.tsx / the archetype system).
//
// IMPORTANT: no .glb files ship with this project. Every entry below has
// `available: false` and a placeholder `path` until you add a real file —
// see public/models/README.md for the exact steps. `license` and `source`
// are required fields specifically so nothing gets added here without
// someone recording where it came from and what you're allowed to do with
// it.

export type ModelCategory = "building" | "vehicle" | "landmark" | "interior" | "environment";

export interface LODSetting {
  /** camera distance below which this LOD tier is used */
  distance: number;
  /** 'high' | 'medium' | 'low' | 'procedural' (falls back to the existing instanced/procedural mesh) */
  tier: "high" | "medium" | "low" | "procedural";
}

export interface ModelEntry {
  id: string;
  name: string;
  category: ModelCategory;
  /** public/ relative path to the .glb, once one exists */
  path: string;
  /** whether `path` currently points at a real, present file */
  available: boolean;
  scale: [number, number, number];
  rotation: [number, number, number];
  /** default position offset applied on top of wherever the caller places it */
  position: [number, number, number];
  lod: LODSetting[];
  collision: { enabled: boolean; type: "box" | "cylinder" | "none" };
  /** does this entry have a matching walkable interior module? */
  interiorAvailable: boolean;
  interiorModuleId?: string;
  license: string;
  source: string;
}

const NOT_YET_PROVIDED = "Not yet provided — see public/models/README.md";

export const MODEL_REGISTRY: ModelEntry[] = [
  // ---------------- priority buildings ----------------
  {
    id: "landmark-tower",
    name: "Downtown Landmark",
    category: "landmark",
    path: "/models/landmarks/downtown-landmark.glb",
    available: false,
    scale: [1, 1, 1], rotation: [0, 0, 0], position: [0, 0, 0],
    lod: [{ distance: 60, tier: "high" }, { distance: 160, tier: "medium" }, { distance: Infinity, tier: "procedural" }],
    collision: { enabled: true, type: "cylinder" },
    interiorAvailable: true, interiorModuleId: "tower-lobby-preview",
    license: NOT_YET_PROVIDED, source: NOT_YET_PROVIDED,
  },
  {
    id: "modern-villa",
    name: "Modern Villa",
    category: "building",
    path: "/models/buildings/modern-villa.glb",
    available: false,
    scale: [1, 1, 1], rotation: [0, 0, 0], position: [0, 0, 0],
    lod: [{ distance: 40, tier: "high" }, { distance: 120, tier: "medium" }, { distance: Infinity, tier: "procedural" }],
    collision: { enabled: true, type: "box" },
    interiorAvailable: true, interiorModuleId: "villa-interior",
    license: NOT_YET_PROVIDED, source: NOT_YET_PROVIDED,
  },
  {
    id: "hospital-main",
    name: "Hospital",
    category: "building",
    path: "/models/buildings/hospital.glb",
    available: false,
    scale: [1, 1, 1], rotation: [0, 0, 0], position: [0, 0, 0],
    lod: [{ distance: 50, tier: "high" }, { distance: 140, tier: "medium" }, { distance: Infinity, tier: "procedural" }],
    collision: { enabled: true, type: "box" },
    interiorAvailable: true, interiorModuleId: "hospital-ground-floor-preview",
    license: NOT_YET_PROVIDED, source: NOT_YET_PROVIDED,
  },
  {
    id: "university-hall",
    name: "University",
    category: "building",
    path: "/models/buildings/university-hall.glb",
    available: false,
    scale: [1, 1, 1], rotation: [0, 0, 0], position: [0, 0, 0],
    lod: [{ distance: 50, tier: "high" }, { distance: 140, tier: "medium" }, { distance: Infinity, tier: "procedural" }],
    collision: { enabled: true, type: "box" },
    interiorAvailable: true, interiorModuleId: "university-hall-preview",
    license: NOT_YET_PROVIDED, source: NOT_YET_PROVIDED,
  },
  {
    id: "shopping-mall",
    name: "Shopping Mall",
    category: "building",
    path: "/models/buildings/shopping-mall.glb",
    available: false,
    scale: [1, 1, 1], rotation: [0, 0, 0], position: [0, 0, 0],
    lod: [{ distance: 50, tier: "high" }, { distance: 140, tier: "medium" }, { distance: Infinity, tier: "procedural" }],
    collision: { enabled: true, type: "box" },
    interiorAvailable: false,
    license: NOT_YET_PROVIDED, source: NOT_YET_PROVIDED,
  },
  {
    id: "airport-terminal",
    name: "Airport Terminal",
    category: "building",
    path: "/models/buildings/airport-terminal.glb",
    available: false,
    scale: [1, 1, 1], rotation: [0, 0, 0], position: [0, 0, 0],
    lod: [{ distance: 70, tier: "high" }, { distance: 180, tier: "medium" }, { distance: Infinity, tier: "procedural" }],
    collision: { enabled: true, type: "box" },
    interiorAvailable: false,
    license: NOT_YET_PROVIDED, source: NOT_YET_PROVIDED,
  },
  {
    id: "office-tower",
    name: "Office Tower",
    category: "building",
    path: "/models/buildings/office-tower.glb",
    available: false,
    scale: [1, 1, 1], rotation: [0, 0, 0], position: [0, 0, 0],
    lod: [{ distance: 50, tier: "high" }, { distance: 140, tier: "medium" }, { distance: Infinity, tier: "procedural" }],
    collision: { enabled: true, type: "box" },
    interiorAvailable: false,
    license: NOT_YET_PROVIDED, source: NOT_YET_PROVIDED,
  },
  {
    id: "apartment-block",
    name: "Apartment Building",
    category: "building",
    path: "/models/buildings/apartment-block.glb",
    available: false,
    scale: [1, 1, 1], rotation: [0, 0, 0], position: [0, 0, 0],
    lod: [{ distance: 45, tier: "high" }, { distance: 130, tier: "medium" }, { distance: Infinity, tier: "procedural" }],
    collision: { enabled: true, type: "box" },
    interiorAvailable: false,
    license: NOT_YET_PROVIDED, source: NOT_YET_PROVIDED,
  },

  // ---------------- vehicles ----------------
  ...(["car", "bus", "ambulance", "fire-truck", "police-car"] as const).map((v) => ({
    id: `vehicle-${v}`,
    name: v.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    category: "vehicle" as ModelCategory,
    path: `/models/vehicles/${v}.glb`,
    available: false,
    scale: [1, 1, 1] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    position: [0, 0, 0] as [number, number, number],
    lod: [{ distance: 25, tier: "high" as const }, { distance: Infinity, tier: "procedural" as const }],
    collision: { enabled: false, type: "none" as const },
    interiorAvailable: false,
    license: NOT_YET_PROVIDED, source: NOT_YET_PROVIDED,
  })),
];

export function getModelEntry(id: string): ModelEntry | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

export function isModelAvailable(id: string): boolean {
  return !!getModelEntry(id)?.available;
}
