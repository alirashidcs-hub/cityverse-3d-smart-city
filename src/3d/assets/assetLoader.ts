// @ts-nocheck
//
// Thin wrapper around GLTFLoader that respects the model registry: if an
// entry isn't `available`, callers should never even try to fetch it —
// this module exists so that check lives in one place instead of being
// re-implemented at every call site.
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getModelEntry } from "../../data/modelRegistry";

const loader = new GLTFLoader();
const cache = new Map();

/**
 * Load a registry entry's .glb if (and only if) it's marked available.
 * Returns null when there's nothing to load — callers fall back to their
 * procedural version in that case, e.g.:
 *
 *   const group = await loadRegisteredModel("modern-villa");
 *   if (group) scene.add(group); else scene.add(buildProceduralVilla());
 */
export async function loadRegisteredModel(id) {
  const entry = getModelEntry(id);
  if (!entry || !entry.available) return null;
  if (cache.has(id)) return cache.get(id).clone();
  const gltf = await new Promise((resolve, reject) => {
    loader.load(entry.path, resolve, undefined, reject);
  });
  cache.set(id, gltf.scene);
  return gltf.scene.clone();
}

export function clearModelCache() {
  cache.clear();
}
