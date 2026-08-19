// @ts-nocheck
import { useEffect, useRef } from "react";

/**
 * Tracks WASD/arrow-key state without causing re-renders — reads happen
 * every animation frame via the returned ref, not through React state.
 * Returns { current: { forward, back, left, right } } (booleans).
 */
export function useKeyboardControls() {
  const keys = useRef({ forward: false, back: false, left: false, right: false });

  useEffect(() => {
    const map = {
      KeyW: "forward", ArrowUp: "forward",
      KeyS: "back", ArrowDown: "back",
      KeyA: "left", ArrowLeft: "left",
      KeyD: "right", ArrowRight: "right",
    };
    const onDown = (e) => { const k = map[e.code]; if (k) keys.current[k] = true; };
    const onUp = (e) => { const k = map[e.code]; if (k) keys.current[k] = false; };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  return keys;
}
