"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type KeyboardEvent } from "react";

type ThemePreference = "light" | "dark" | "system";
type TextScale = "100" | "125";
type Preferences = { theme: ThemePreference; scale: TextScale };
type Position = { left: number; top: number };

const STORAGE_KEY = "solenos_display_preferences_v1";
const POSITION_KEY = "solenos_display_control_position_v1";
const EDGE_GAP = 8;
const DEFAULTS: Preferences = { theme: "system", scale: "100" };

function validPreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object") return DEFAULTS;
  const candidate = value as Partial<{ theme: unknown; scale: unknown }>;
  const scale: TextScale =
    candidate.scale === "125" || candidate.scale === "150" || candidate.scale === "200"
      ? "125"
      : "100";
  return {
    theme:
      candidate.theme === "light" || candidate.theme === "dark" || candidate.theme === "system"
        ? candidate.theme
        : DEFAULTS.theme,
    scale,
  };
}

function clampPosition(position: Position, width: number, height: number): Position {
  return {
    left: Math.max(EDGE_GAP, Math.min(position.left, window.innerWidth - width - EDGE_GAP)),
    top: Math.max(EDGE_GAP, Math.min(position.top, window.innerHeight - height - EDGE_GAP)),
  };
}

export function GlobalDisplayPreferences() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [announcement, setAnnouncement] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setPrefs(validPreferences(JSON.parse(stored)));
      const savedPosition = window.localStorage.getItem(POSITION_KEY);
      if (savedPosition) {
        const parsed = JSON.parse(savedPosition) as Position;
        if (Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
          const rect = rootRef.current?.getBoundingClientRect();
          setPosition(clampPosition(parsed, rect?.width ?? 120, rect?.height ?? 48));
        }
      }
    } catch {
      // Keep safe defaults when browser storage is unavailable or corrupt.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || position) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setPosition(clampPosition({ left: rect.left, top: rect.top }, rect.width, rect.height));
  }, [ready, position]);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    root.dataset.solenosTheme = prefs.theme === "dark" ? "dark" : "light";
    root.style.setProperty("--solenos-text-scale", String(Number(prefs.scale) / 100));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // The active preference still applies for this session.
    }
  }, [prefs, ready]);

  useEffect(() => {
    if (!position) return;
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition((current) => current ? clampPosition(current, rect.width, rect.height) : current);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [position]);

  function update(next: Partial<Preferences>) {
    setPrefs((current) => ({ ...current, ...next }));
  }

  function savePosition(next: Position) {
    const rect = rootRef.current?.getBoundingClientRect();
    const bounded = clampPosition(next, rect?.width ?? 120, rect?.height ?? 48);
    setPosition(bounded);
    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(bounded));
    } catch {
      // Movement remains available for this session.
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    suppressClickRef.current = true;
    const rect = rootRef.current?.getBoundingClientRect();
    setPosition(clampPosition({ left: drag.left + dx, top: drag.top + dy }, rect?.width ?? 120, rect?.height ?? 48));
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      const rect = rootRef.current?.getBoundingClientRect();
      const current = rootRef.current?.getBoundingClientRect();
      if (current) savePosition({ left: current.left, top: current.top });
      setAnnouncement("Display control moved. Its new position is saved on this device.");
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    dragRef.current = null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!event.altKey || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const step = event.shiftKey ? 40 : 12;
    const next = {
      left: rect.left + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
      top: rect.top + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0),
    };
    savePosition(next);
    setAnnouncement("Display control moved. Its new position is saved on this device.");
  }

  const placement = position
    ? {
        vertical: position.top < viewport.height / 2 ? "below" : "above",
        horizontal: position.left < viewport.width / 2 ? "left" : "right",
      }
    : { vertical: "above", horizontal: "right" };

  const positionStyle: CSSProperties | undefined = position
    ? { left: position.left, top: position.top, right: "auto", bottom: "auto" }
    : undefined;

  return (
    <div ref={rootRef} className="solenos-display-preferences" style={positionStyle} data-panel-vertical={placement.vertical} data-panel-horizontal={placement.horizontal}>
      <button
        type="button"
        className="solenos-display-trigger"
        aria-expanded={open}
        aria-controls="solenos-display-panel"
        aria-label="Display and accessibility settings. Drag to move. Press Alt plus arrow keys to reposition."
        title="Drag to move • Alt + arrow keys to reposition"
        onClick={() => {
          if (suppressClickRef.current) return;
          setOpen((value) => !value);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <span aria-hidden="true">Aa</span>
        <span>Display</span>
        <span className="solenos-display-drag-indicator" aria-hidden="true">⠿</span>
      </button>
      <span className="solenos-display-sr-only" role="status" aria-live="polite">{announcement}</span>
      {open && (
        <section id="solenos-display-panel" className="solenos-display-panel" role="region" aria-label="Display and accessibility settings">
          <div className="solenos-display-panel-heading">
            <h2>Display & accessibility</h2>
            <button type="button" className="solenos-display-close" onClick={() => setOpen(false)} aria-label="Close display settings">×</button>
          </div>
          <fieldset>
            <legend>Colour theme</legend>
            {(["light", "dark", "system"] as const).map((theme) => (
              <label key={theme}>
                <input type="radio" name="solenos-theme" value={theme} checked={prefs.theme === theme} onChange={() => update({ theme })} />
                {theme === "system" ? "System default" : theme === "light" ? "Light" : "Dark"}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Font size</legend>
            {(["100", "125"] as const).map((scale) => (
              <label key={scale}>
                <input type="radio" name="solenos-text-scale" value={scale} checked={prefs.scale === scale} onChange={() => update({ scale })} />
                {scale === "100" ? "Default" : "Large"}
              </label>
            ))}
          </fieldset>
          <p className="solenos-display-note" role="status">Your display preferences are saved on this device.</p>
        </section>
      )}
    </div>
  );
}
