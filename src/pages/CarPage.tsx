import { useEffect, useRef, useState } from "react";
import { safetyGroups } from "@/data/defaults";
import { CarDiagram, hotspotLabel, hotspotZones, useWheelDrive } from "@/components/CarDiagram";
import { Odometer } from "@/components/Odometer";
import { TimeSlider } from "@/components/TimeSlider";
import { Button } from "@/components/ui/button";
import { MaintenancePage } from "@/pages/MaintenancePage";
import { useGarage } from "@/lib/garage";
import { forecastOdometer, itemStatus, shiftDate } from "@/lib/status";

export function CarPage() {
  const { garage, error, save } = useGarage();
  const drive = useWheelDrive();
  const [years, setYears] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const carRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  useEffect(() => {
    if (!selected) return;
    function onPointerDown(event: PointerEvent) {
      if (carRef.current?.contains(event.target as Node)) return;
      setSelected(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [selected]);

  if (!garage) return <p className="text-cyan">{error ?? "Loading the car..."}</p>;

  const pending = safetyGroups.filter((group) =>
    group.itemIds.some((id) => {
      const item = garage.items.find((entry) => entry.id === id);
      if (!item || item.stillOriginal) return false;
      return group.mode === "dot" ? !item.dotDate : !item.lastDate;
    }),
  );
  const lookingAhead = years > 0;
  const viewedMiles = lookingAhead ? forecastOdometer(garage.odometer, years) : garage.odometer;
  const viewedNow = lookingAhead ? shiftDate(now, years) : now;
  const viewedGarage = lookingAhead ? { ...garage, odometer: viewedMiles } : garage;
  const zones = selected ? hotspotZones(selected) : [];
  const selectedItems = garage.items.filter((item) => zones.includes(item.zoneId));

  function exportJson() {
    const blob = new Blob([JSON.stringify(garage, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "corvette-garage.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <section className="panel panel-glass space-y-4 p-3 sm:p-5">
          {error ? <p className="text-hot">{error}</p> : null}
          <Odometer miles={garage.odometer} onSave={(odometer) => save({ ...garage, odometer })} />
          {!dismissed && pending.length > 0 ? (
            <SafetyPrompt
              groups={pending}
              onSkip={() => setDismissed(true)}
              onAnswer={(groupId, mode, value) => {
                const group = safetyGroups.find((entry) => entry.id === groupId);
                if (!group) return;
                const next = structuredClone(garage);
                for (const item of next.items) {
                  if (!group.itemIds.includes(item.id)) continue;
                  if (mode === "original") {
                    item.stillOriginal = true;
                    item.lastDate = null;
                    item.dotDate = null;
                  } else if (group.mode === "dot") {
                    item.dotDate = value;
                    item.lastDate = `${value}-01`;
                    item.lastMiles = next.odometer;
                    item.stillOriginal = false;
                  } else {
                    item.lastDate = value;
                    item.lastMiles = next.odometer;
                    item.stillOriginal = false;
                  }
                }
                void save(next);
              }}
            />
          ) : null}
          <div ref={carRef}>
            <CarDiagram
              garage={viewedGarage}
              now={viewedNow}
              selected={selected}
              onSelect={setSelected}
              rateRef={drive.rateRef}
            />
            <TimeSlider
              years={years}
              onChange={(next, speed) => {
                setYears(next);
                drive.kick(speed);
              }}
            />
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/70">
              {/* <Legend swatch="border border-cyan/60 bg-cyan/10" label="Current" /> */}
              <Legend swatch="border border-check bg-check/10" label="Inspection" />
              <Legend swatch="border border-soon bg-soon/10" label="Replacement" />
              {/* <Legend swatch="border border-hot bg-hot/10" label="Overdue pulses" /> */}
            </div>
            {selected ? (
              <div className="border-t border-white/10 pt-4">
                <h3 className="display text-xs text-magenta">
                  {hotspotLabel(selected)}
                  {lookingAhead ? " · ahead" : ""}
                </h3>
                <ul className="mt-3 space-y-2">
                  {selectedItems.map((item) => {
                    const status = itemStatus(item, viewedMiles, viewedNow);
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <span>{item.name}</span>
                        <StatusText status={status} />
                      </li>
                    );
                  })}
                  {selectedItems.length === 0 ? <li className="text-white/60">Nothing is mapped here yet.</li> : null}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
        {/* <div className="flex justify-end">
          <Button variant="ghost" className="px-2 py-1 text-[10px]" onClick={exportJson}>
            Export JSON
          </Button>
        </div> */}
      </div>
      <MaintenancePage forecast={lookingAhead ? { odometer: viewedMiles, now: viewedNow } : null} />
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 ${swatch}`} />
      {label}
    </span>
  );
}

function StatusText({ status }: { status: string }) {
  const label =
    status === "overdue" ? "Overdue" : status === "soon" ? "Due soon" : status === "ok" ? "Current" : "Not logged";
  const color = status === "overdue" ? "text-hot" : status === "soon" ? "text-soon" : "text-cyan";
  return <span className={color}>{label}</span>;
}

function SafetyPrompt({
  groups,
  onSkip,
  onAnswer,
}: {
  groups: typeof safetyGroups;
  onSkip: () => void;
  onAnswer: (groupId: string, mode: "date" | "original", value: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <div className="border border-soon/70 p-4">
      <h3 className="display text-xs text-soon">AGE CHECK</h3>
      <p className="mt-2 text-sm text-white/75">
        These parts can age out while the odometer barely moves. A date clears the red. Still original turns it bright
        red.
      </p>
      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <form
            key={group.id}
            className="border-t border-white/10 pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (values[group.id]) onAnswer(group.id, "date", values[group.id]);
            }}
          >
            <label className="block max-w-xl text-sm">
              <span className="display text-[10px] text-cyan">{group.title}</span>
              <span className="mt-1 block text-white/60">{group.hint}</span>
              <input
                className="mt-2 w-full max-w-xs border border-cyan/30 bg-black/40 px-2 py-1"
                type={group.mode === "dot" ? "month" : "date"}
                value={values[group.id] ?? ""}
                onChange={(event) => setValues({ ...values, [group.id]: event.target.value })}
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="submit">Save date</Button>
              <Button type="button" variant="magenta" onClick={() => onAnswer(group.id, "original", "")}>
                Still original
              </Button>
            </div>
          </form>
        ))}
      </div>
      <Button variant="ghost" className="mt-4" onClick={onSkip}>
        Not now
      </Button>
    </div>
  );
}
