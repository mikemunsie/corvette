import { useRef } from "react";
import { MILES_PER_YEAR } from "@/lib/status";

export const FORECAST_YEARS = 2;

export function TimeSlider({
  years,
  onChange,
}: {
  years: number;
  onChange: (years: number, yearsPerSecond: number) => void;
}) {
  const last = useRef<{ value: number; time: number } | null>(null);
  const fill = `${(years / FORECAST_YEARS) * 100}%`;

  function change(value: number) {
    const time = performance.now();
    let perSecond = 0;
    if (last.current) {
      const dt = (time - last.current.time) / 1000;
      if (dt > 0.001) perSecond = Math.abs(value - last.current.value) / dt;
    }
    last.current = { value, time };
    onChange(Math.min(FORECAST_YEARS, Math.max(0, value)), perSecond);
  }

  const added = Math.round(years * MILES_PER_YEAR);
  const ahead = years <= 0 ? "Now" : years >= FORECAST_YEARS ? "2 years ahead" : `${years.toFixed(1)} years ahead`;

  return (
    <div className="horizon-slider mt-4 px-3 py-3 sm:px-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <label htmlFor="time-slider" className="display text-[10px] text-magenta">
            LOOK AHEAD
          </label>
          {added > 0 ? <span className="display text-[10px] text-soon">+{added.toLocaleString()} MI</span> : null}
        </div>
        <p className="display text-[10px] text-cyan/80">{MILES_PER_YEAR.toLocaleString()} MI / YR</p>
      </div>
      <div className="relative mt-3 h-11">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full border border-cyan/60 bg-black/70 shadow-[0_0_16px_rgba(255,45,149,0.45)]">
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: fill,
              background: "linear-gradient(90deg, #3dfff5 0%, #ffe36a 46%, #ff2d95 82%, #6d28d9 100%)",
            }}
          />
          <div className="horizon-slider-bars absolute inset-0" />
        </div>
        <input
          id="time-slider"
          className="horizon-range relative z-10 w-full"
          type="range"
          min={0}
          max={FORECAST_YEARS}
          step={0.01}
          value={years}
          aria-label="Look ahead from the current odometer"
          aria-valuetext={ahead}
          onChange={(event) => change(Number(event.target.value))}
        />
      </div>
      <div className="display grid grid-cols-5 text-[9px] tracking-widest text-white/45">
        <span>NOW</span>
        <span className="text-center">6 MO</span>
        <span className="text-center">1 YR</span>
        <span className="text-center">18 MO</span>
        <span className="text-right">2 YR</span>
      </div>
    </div>
  );
}
