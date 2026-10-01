import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { zoneSignal } from "@/lib/status";
import type { GarageState, ItemStatus, ItemWork } from "@/lib/types";
import { carBodyPath, frontWheelPath, rearWheelPath } from "./carProfilePath";

type Hotspot = {
  id: string;
  zones: string[];
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rx?: number;
};

const hotspots: Hotspot[] = [
  { id: "tireLf", zones: ["tireLf"], label: "LF tire", x: 164, y: 156, w: 124, h: 124, rx: 62 },
  { id: "tireLr", zones: ["tireLr"], label: "LR tire", x: 697, y: 155, w: 124, h: 124, rx: 62 },
  { id: "cabin", zones: ["cabin"], label: "Cabin", x: 478, y: 86, w: 136, h: 56, rx: 6 },
  { id: "engine", zones: ["engine"], label: "Engine", x: 196, y: 92, w: 156, h: 50, rx: 8 },
  { id: "top", zones: ["top"], label: "Top", x: 652, y: 78, w: 156, h: 38, rx: 10 },
  { id: "exhaust", zones: ["exhaust"], label: "Exhaust", x: 300, y: 236, w: 380, h: 14, rx: 6 },
  { id: "headlights", zones: ["headlights"], label: "Lights", x: 18, y: 148, w: 100, h: 46, rx: 10 },
  { id: "cooling", zones: ["cooling"], label: "Cooling", x: 118, y: 112, w: 72, h: 38, rx: 8 },
  { id: "ac", zones: ["ac"], label: "A/C", x: 248, y: 146, w: 52, h: 22, rx: 6 },
  { id: "steering", zones: ["steering"], label: "Steering", x: 448, y: 96, w: 58, h: 36, rx: 6 },
  { id: "transmission", zones: ["transmission"], label: "Trans", x: 392, y: 176, w: 88, h: 34, rx: 8 },
  { id: "fuel", zones: ["fuel"], label: "Fuel", x: 590, y: 124, w: 78, h: 32, rx: 8 },
  { id: "differential", zones: ["differential"], label: "Rear axle", x: 668, y: 168, w: 64, h: 28, rx: 8 },
  { id: "frontSuspension", zones: ["frontSuspension"], label: "Front susp.", x: 108, y: 188, w: 56, h: 32, rx: 6 },
  { id: "rearSuspension", zones: ["rearSuspension"], label: "Rear susp.", x: 828, y: 186, w: 78, h: 30, rx: 6 },
  { id: "tireRf", zones: ["tireRf"], label: "RF tire", x: 196, y: 128, w: 52, h: 32, rx: 12 },
  { id: "tireRr", zones: ["tireRr"], label: "RR tire", x: 728, y: 126, w: 52, h: 32, rx: 12 },
  { id: "frontBrakes", zones: ["frontBrakes", "brakeFluid"], label: "Front brakes", x: 198, y: 190, w: 56, h: 56, rx: 28 },
  { id: "rearBrakes", zones: ["rearBrakes", "brakeFluid"], label: "Rear brakes", x: 731, y: 189, w: 56, h: 56, rx: 28 },
];

const frontHub = { x: 2311, y: 829.5 };
const rearHub = { x: 7656.5, y: 831.5 };
const IDLE_DPS = 360 / 14;

function Wheel({
  d,
  hub,
  spin,
  rateRef,
}: {
  d: string;
  hub: { x: number; y: number };
  spin: boolean;
  rateRef: RefObject<number>;
}) {
  const ref = useRef<SVGGElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const place = (angle: number) => node.setAttribute("transform", `rotate(${angle} ${hub.x} ${hub.y})`);
    if (!spin) {
      place(0);
      return;
    }
    let frame = 0;
    let angle = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      angle = (angle + (rateRef.current * dt) / 1000) % 360;
      place(angle);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [hub.x, hub.y, rateRef, spin]);
  return (
    <g ref={ref}>
      <path d={d} />
    </g>
  );
}

/** Idle cruise, with a kick that fades out. Faster slider drags spin the wheels harder. */
export function useWheelDrive() {
  const rateRef = useRef(IDLE_DPS);
  const targetRef = useRef(IDLE_DPS);
  const motionRef = useRef(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      motionRef.current = !media.matches;
      if (!motionRef.current) {
        rateRef.current = 0;
        targetRef.current = 0;
      } else if (targetRef.current === 0) {
        targetRef.current = IDLE_DPS;
        rateRef.current = IDLE_DPS;
      }
    };
    apply();
    media.addEventListener("change", apply);

    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (motionRef.current) {
        targetRef.current = IDLE_DPS + (targetRef.current - IDLE_DPS) * Math.exp(-dt * 2.4);
        rateRef.current += (targetRef.current - rateRef.current) * (1 - Math.exp(-dt * 12));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", apply);
    };
  }, []);

  const kick = useCallback((yearsPerSecond: number) => {
    if (!motionRef.current) return;
    const extra = Math.min(1200, Math.abs(yearsPerSecond) * 170);
    targetRef.current = Math.max(targetRef.current, IDLE_DPS + extra);
  }, []);

  return { rateRef, kick };
}

/** Quiet zones first, then yellow checks, then red replacements, so red paints on top. */
function paintRank(signal: { status: ItemStatus; heat: number; work: ItemWork }) {
  const showing = signal.status === "soon" || signal.status === "overdue" || signal.heat > 0.04;
  if (!showing) return 0;
  return signal.work === "replace" ? 2 : 1;
}

export function CarDiagram({
  garage,
  now,
  selected,
  onSelect,
  rateRef,
}: {
  garage: GarageState;
  now: Date;
  selected: string | null;
  onSelect: (id: string | null) => void;
  rateRef?: RefObject<number>;
}) {
  const spin = useSpin();
  const fallbackRate = useRef(IDLE_DPS);
  const spinRate = rateRef ?? fallbackRate;
  const signals = hotspots.map((spot) => zoneSignal(spot.zones, garage, now));
  return (
    <svg
      viewBox="0 0 998 297"
      className="h-auto w-full"
      role="img"
      aria-label="1988 Corvette convertible"
      onClick={(event) => {
        const target = event.target as Element;
        if (target.getAttribute("role") === "button") return;
        onSelect(null);
      }}
    >
      <rect width="998" height="297" fill="transparent" pointerEvents="all" />
      <defs>
        <mask id="car-wheel-cutout" maskUnits="userSpaceOnUse">
          <rect width="998" height="297" fill="white" />
          <circle cx="231" cy="214" r="76" fill="black" />
          <circle cx="766" cy="214" r="76" fill="black" />
        </mask>
      </defs>
      <g mask="url(#car-wheel-cutout)" fill="#3dfff5" pointerEvents="none">
        <g transform="translate(0 297) scale(0.1 -0.1)">
          <path d={carBodyPath} />
        </g>
      </g>
      <g transform="translate(0 297) scale(0.1 -0.1)" fill="#3dfff5" pointerEvents="none">
        <Wheel d={frontWheelPath} hub={frontHub} spin={spin} rateRef={spinRate} />
        <Wheel d={rearWheelPath} hub={rearHub} spin={spin} rateRef={spinRate} />
      </g>
      {hotspots
        .map((spot, index) => ({ spot, signal: signals[index] }))
        .sort((a, b) => paintRank(a.signal) - paintRank(b.signal))
        .map(({ spot, signal }) => {
        const { status, heat, work } = signal;
        const showing = status === "soon" || status === "overdue" || heat > 0;
        const paint = showing ? zonePaint(heat, status, work) : undefined;
        const style =
          selected === spot.id
            ? { ...paint, stroke: "#ffffff", strokeWidth: 2.5 }
            : paint;
        return (
          <rect
            key={spot.id}
            x={spot.x}
            y={spot.y}
            width={spot.w}
            height={spot.h}
            rx={spot.rx ?? 8}
            className={["zone-spot", showing ? "" : "zone-hidden", status === "overdue" ? "zone-pulse" : ""]
              .filter(Boolean)
              .join(" ")}
            style={style}
            role="button"
            tabIndex={0}
            aria-label={spot.label}
            onClick={(event) => {
              const next = selected === spot.id ? null : spot.id;
              if (next == null) event.currentTarget.blur();
              onSelect(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(selected === spot.id ? null : spot.id);
              }
            }}
          />
        );
      })}
    </svg>
  );
}

type Paint = { r: number; g: number; b: number; strokeA: number; fillA: number; glow: number };

function restingPaint(status: ItemStatus, work: ItemWork): Paint {
  if (status === "overdue") {
    return work === "inspect"
      ? { r: 255, g: 227, b: 106, strokeA: 1, fillA: 0.55, glow: 6 }
      : { r: 255, g: 90, b: 122, strokeA: 1, fillA: 0.58, glow: 6 };
  }
  if (status === "soon") {
    return work === "inspect"
      ? { r: 255, g: 197, b: 61, strokeA: 1, fillA: 0.42, glow: 0 }
      : { r: 255, g: 42, b: 42, strokeA: 1, fillA: 0.45, glow: 0 };
  }
  if (status === "ok") return { r: 61, g: 255, b: 245, strokeA: 0.5, fillA: 0.1, glow: 0 };
  return { r: 61, g: 255, b: 245, strokeA: 0.22, fillA: 0.05, glow: 0 };
}

function mixPaint(from: Paint, to: Paint, amount: number): Paint {
  const at = (a: number, b: number) => a + (b - a) * amount;
  return {
    r: at(from.r, to.r),
    g: at(from.g, to.g),
    b: at(from.b, to.b),
    strokeA: at(from.strokeA, to.strokeA),
    fillA: at(from.fillA, to.fillA),
    glow: at(from.glow, to.glow),
  };
}

function zonePaint(heat: number, status: ItemStatus, work: ItemWork) {
  const warm: Paint =
    work === "inspect"
      ? { r: 255, g: 197, b: 61, strokeA: 1, fillA: 0.42, glow: 4 }
      : { r: 255, g: 42, b: 42, strokeA: 1, fillA: 0.45, glow: 4 };
  const hot: Paint =
    work === "inspect"
      ? { r: 255, g: 227, b: 106, strokeA: 1, fillA: 0.55, glow: 10 }
      : { r: 255, g: 90, b: 122, strokeA: 1, fillA: 0.58, glow: 10 };
  const due = status === "soon" || status === "overdue" ? restingPaint(status, work) : warm;
  const faded: Paint = { ...warm, strokeA: 0.7, fillA: 0.22, glow: 0 };
  const paint = heat <= 0 ? due : heat < 0.5 ? mixPaint(faded, due, heat / 0.5) : mixPaint(due, hot, (heat - 0.5) / 0.5);
  const rgb = `${Math.round(paint.r)}, ${Math.round(paint.g)}, ${Math.round(paint.b)}`;
  const filter =
    paint.glow > 0.4
      ? `drop-shadow(0 0 ${paint.glow.toFixed(1)}px rgba(${rgb}, ${Math.min(1, paint.glow / 8).toFixed(2)}))`
      : "none";
  return { fill: `rgba(${rgb}, ${paint.fillA.toFixed(3)})`, stroke: `rgba(${rgb}, ${paint.strokeA.toFixed(3)})`, filter };
}

function useSpin() {
  const [spin, setSpin] = useState(true);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSpin(!media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return spin;
}

export function hotspotZones(id: string) {
  return hotspots.find((spot) => spot.id === id)?.zones ?? [];
}

export function hotspotLabel(id: string) {
  return hotspots.find((spot) => spot.id === id)?.label ?? "Zone";
}
