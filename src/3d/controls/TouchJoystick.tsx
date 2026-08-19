// @ts-nocheck
import React, { useRef, useState } from "react";

/**
 * On-screen virtual joystick. Reports a normalized {x, y} vector (-1..1 on
 * each axis) via onChange, live while dragging and reset to {0,0} on
 * release. Only responds to touches/drags that start inside its own hit
 * area, so it can coexist with a full-screen "look around" drag handler.
 */
export default function TouchJoystick({ onChange, size = 108 }) {
  const baseRef = useRef(null);
  const [nub, setNub] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const originRef = useRef({ x: 0, y: 0 });
  const maxR = size / 2 - 14;

  const startAt = (clientX, clientY) => {
    const rect = baseRef.current.getBoundingClientRect();
    originRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    dragging.current = true;
    update(clientX, clientY);
  };
  const update = (clientX, clientY) => {
    const dx = clientX - originRef.current.x;
    const dy = clientY - originRef.current.y;
    const dist = Math.min(maxR, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    const nx = Math.cos(ang) * dist;
    const ny = Math.sin(ang) * dist;
    setNub({ x: nx, y: ny });
    onChange({ x: clamp(nx / maxR), y: clamp(ny / maxR) });
  };
  const end = () => {
    dragging.current = false;
    setNub({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  React.useEffect(() => {
    const onMove = (e) => { if (dragging.current) update(e.clientX, e.clientY); };
    const onUp = () => { if (dragging.current) end(); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);


  return (
    <div
      ref={baseRef}
      onTouchStart={(e) => { const t = e.touches[0]; startAt(t.clientX, t.clientY); }}
      onTouchMove={(e) => { if (dragging.current) { const t = e.touches[0]; update(t.clientX, t.clientY); } }}
      onTouchEnd={end}
      onMouseDown={(e) => startAt(e.clientX, e.clientY)}
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "rgba(10,14,24,0.55)", border: "1px solid rgba(148,163,184,0.3)",
        position: "relative", touchAction: "none",
      }}
    >
      <div style={{
        position: "absolute", left: "50%", top: "50%", width: 44, height: 44, borderRadius: "50%",
        background: "rgba(103,232,249,0.75)",
        transform: `translate(calc(-50% + ${nub.x}px), calc(-50% + ${nub.y}px))`,
        transition: dragging.current ? "none" : "transform 0.15s ease-out",
      }} />
    </div>
  );
}

function clamp(v) { return Math.max(-1, Math.min(1, v)); }
