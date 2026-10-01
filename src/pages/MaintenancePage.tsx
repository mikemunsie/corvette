import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useGarage } from "@/lib/garage";
import { compareNextDue, forecastHit, itemStatus, nextDue } from "@/lib/status";
import type { ServiceItem } from "@/lib/types";

function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function intervalText(item: ServiceItem) {
  const parts: string[] = [];
  if (item.intervalMiles != null) parts.push(`${item.intervalMiles.toLocaleString()} mi`);
  if (item.intervalMonths != null) {
    parts.push(item.intervalMonths % 12 === 0 ? `${item.intervalMonths / 12} yr` : `${item.intervalMonths} mo`);
  }
  return parts.length > 0 ? `Every ${parts.join(" or ")}` : "";
}

export function MaintenancePage({
  forecast = null,
}: {
  forecast?: { odometer: number; now: Date } | null;
}) {
  const { garage, error, save } = useGarage();
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const now = new Date();
  const simulating = forecast != null;

  useEffect(() => {
    if (simulating) setOpenId(null);
  }, [simulating]);

  if (!garage) return <p className="text-cyan">{error ?? "Loading service..."}</p>;

  const clock = forecast ?? { odometer: garage.odometer, now };
  const needle = query.trim().toLowerCase();
  const visible = garage.items
    .filter((item) => {
      if (forecast && !forecastHit(item, forecast.odometer, forecast.now)) return false;
      if (!needle) return true;
      return [item.name, item.group, item.shortLabel].some((value) => value.toLowerCase().includes(needle));
    })
    .sort((a, b) => compareNextDue(a, b, clock.odometer, clock.now));

  function updateItem(id: string, patch: Partial<ServiceItem>) {
    const next = structuredClone(garage);
    if (!next) return;
    const item = next.items.find((entry) => entry.id === id);
    if (!item) return;
    Object.assign(item, patch);
    void save(next);
  }

  return (
    <div className="space-y-4">
      <input
        className="min-h-11 w-full border border-cyan/40 bg-black/40 px-3 py-2"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search the service list"
        aria-label="Search service items"
      />
      {garage.issues.filter((issue) => !issue.resolvedAt).length > 0 ? (
        <section className="panel p-3 sm:p-4">
          <h2 className="display text-xs text-hot">OPEN</h2>
          <ul className="mt-3 space-y-3">
            {garage.issues
              .filter((issue) => !issue.resolvedAt)
              .map((issue) => (
                <li key={issue.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span>{issue.description}</span>
                  {simulating ? (
                    <span className="display text-[10px] text-white/40">Already open</span>
                  ) : (
                    <Button
                      variant="ghost"
                      className="min-h-11 w-full sm:min-h-0 sm:w-auto"
                      onClick={() => {
                        const next = structuredClone(garage);
                        const target = next.issues.find((entry) => entry.id === issue.id);
                        if (target) target.resolvedAt = today();
                        void save(next);
                      }}
                    >
                      Mark fixed
                    </Button>
                  )}
                </li>
              ))}
          </ul>
        </section>
      ) : null}
      {simulating || visible.length > 0 ? (
        <section className="panel p-3 sm:p-4">
          <h2 className={`display text-xs ${simulating ? "text-magenta" : "text-cyan"}`}>
            {simulating ? "AHEAD" : "NEXT"}
          </h2>
          {simulating ? (
            <p className="mt-2 text-sm text-white/60">Preview only. These would come due. Logging stays off.</p>
          ) : null}
          {visible.length === 0 ? (
            <p className="mt-3 text-white/60">
              {needle ? `Nothing matches "${query.trim()}".` : "Nothing comes due this far out."}
            </p>
          ) : (
          <ul className="mt-3 divide-y divide-white/10">
            {visible.map((item) => {
              const status = itemStatus(item, clock.odometer, clock.now);
              const due = nextDue(item, clock.odometer, clock.now);
              const interval = intervalText(item);
              const tone = status === "overdue" ? "text-hot" : status === "soon" || simulating ? "text-soon" : "text-cyan";
              const canLog = !simulating && item.kind !== "problem-only";
              const showLog = canLog && openId !== item.id;
              return (
                <li key={item.id} className="py-4 sm:py-3">
                  <div className="sm:flex sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 sm:flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 leading-snug">{item.name}</p>
                        <span className={`${tone} shrink-0 text-sm sm:hidden`}>{due.label}</span>
                      </div>
                      {item.detail ? (
                        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-white/70">{item.detail}</p>
                      ) : null}
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/55 sm:text-sm">
                        <span>{item.group}</span>
                        <Dot />
                        <span className={item.work === "inspect" ? "text-check" : "text-soon/80"}>
                          {item.work === "inspect" ? "Inspect" : "Replace"}
                        </span>
                        {interval ? (
                          <>
                            <Dot />
                            <span>{interval}</span>
                          </>
                        ) : null}
                        <Dot />
                        <span>{historyText(item)}</span>
                      </p>
                    </div>
                    <div
                      className={`${showLog ? "mt-3 flex" : "hidden sm:flex"} items-center gap-3 sm:mt-0 sm:shrink-0`}
                    >
                      <span className={`${tone} hidden sm:inline`}>{due.label}</span>
                      {showLog ? (
                        <Button
                          variant="ghost"
                          className="min-h-11 w-full sm:min-h-0 sm:w-auto"
                          onClick={() => setOpenId(item.id)}
                        >
                          Log
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {!simulating && openId === item.id ? (
                    <ItemEditor
                      item={item}
                      odometer={garage.odometer}
                      onClose={() => setOpenId(null)}
                      onDone={(patch) => {
                        updateItem(item.id, { ...patch, stillOriginal: false });
                        setOpenId(null);
                      }}
                      onInterval={(miles, months) =>
                        updateItem(item.id, { intervalMiles: miles, intervalMonths: months, intervalsEdited: true })
                      }
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          )}
        </section>
      ) : needle ? (
        <p className="text-white/60">Nothing matches "{query.trim()}".</p>
      ) : null}
      {garage.issues.some((issue) => issue.resolvedAt) ? (
        <section className="panel p-3 sm:p-4">
          <h2 className="display text-xs text-white/50">FIXED</h2>
          <ul className="mt-2 space-y-1 text-sm text-white/60">
            {garage.issues
              .filter((issue) => issue.resolvedAt)
              .map((issue) => (
                <li key={issue.id}>
                  {issue.description} · fixed {issue.resolvedAt}
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-white/25">
      ·
    </span>
  );
}

function historyText(item: ServiceItem) {
  const extras = [
    item.dotDate ? `DOT ${item.dotDate}` : "",
    item.tread32 != null ? `${item.tread32}/32` : "",
  ].filter(Boolean);
  let lead = "No mileage logged";
  if (item.lastMiles != null) {
    lead = `Last ${item.lastDate ?? "unknown date"} · ${item.lastMiles.toLocaleString()} mi`;
  } else if (item.kind === "tire" || item.intervalMiles == null) {
    lead = item.lastDate ? `Last ${item.lastDate}` : "No date";
  }
  return [lead, ...extras].join(" · ");
}

function ItemEditor({
  item,
  odometer,
  onClose,
  onDone,
  onInterval,
}: {
  item: ServiceItem;
  odometer: number;
  onClose: () => void;
  onDone: (patch: Partial<ServiceItem>) => void;
  onInterval: (miles: number | null, months: number | null) => void;
}) {
  const [date, setDate] = useState(today());
  const [miles, setMiles] = useState(String(odometer));
  const [dot, setDot] = useState(item.dotDate ?? "");
  const [tread, setTread] = useState(item.tread32 == null ? "" : String(item.tread32));
  const [thickness, setThickness] = useState(item.thicknessMm == null ? "" : String(item.thicknessMm));
  const [intervalMiles, setIntervalMiles] = useState(item.intervalMiles == null ? "" : String(item.intervalMiles));
  const [intervalMonths, setIntervalMonths] = useState(item.intervalMonths == null ? "" : String(item.intervalMonths));
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <form
      ref={formRef}
      className="relative z-10 mt-3 scroll-mb-8 border border-cyan/40 bg-[#12081c] p-3 sm:p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onDone({
          lastDate: date,
          lastMiles: Number(miles),
          dotDate: item.kind === "tire" ? dot || null : item.dotDate,
          tread32: item.kind === "tire" && tread ? Number(tread) : item.tread32,
          thicknessMm: item.id.includes("pads") && thickness ? Number(thickness) : item.thicknessMm,
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="display text-[10px] tracking-widest text-cyan">MARK IT DONE</p>
        <button
          type="button"
          onClick={onClose}
          className="display -my-2 -mr-2 min-h-11 px-2 text-[10px] tracking-widest text-white/55"
        >
          CLOSE
        </button>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <Field label="Date" type="date" value={date} onChange={setDate} />
        <Field label="Miles" value={miles} onChange={setMiles} />
        {item.kind === "tire" ? (
          <>
            <Field label="DOT month" type="month" value={dot} onChange={setDot} />
            <Field label="Tread /32" value={tread} onChange={setTread} />
          </>
        ) : null}
        {item.id.includes("pads") ? <Field label="Thickness mm" value={thickness} onChange={setThickness} /> : null}
      </div>
      <Button type="submit" className="mt-3 min-h-12 w-full whitespace-nowrap sm:min-h-0 sm:w-auto">
        Mark done
      </Button>

      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="display text-[10px] tracking-widest text-magenta">CHANGE THE SCHEDULE</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Interval miles" value={intervalMiles} onChange={setIntervalMiles} />
          <Field label="Interval months" value={intervalMonths} onChange={setIntervalMonths} />
        </div>
        <Button
          type="button"
          variant="ghost"
          className="mt-3 min-h-12 w-full whitespace-nowrap sm:min-h-0 sm:w-auto"
          onClick={() =>
            onInterval(
              intervalMiles === "" ? null : Number(intervalMiles),
              intervalMonths === "" ? null : Number(intervalMonths),
            )
          }
        >
          Save intervals
        </Button>
      </div>
    </form>
  );
}

function selectField(event: { currentTarget: HTMLInputElement }) {
  event.currentTarget.select();
}

function Field({
  label,
  value,
  onChange,
  type = "number",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const numeric = type === "number";
  return (
    <label className="block">
      <span className="display text-[10px] tracking-widest text-white/55">{label.toUpperCase()}</span>
      {/* 16px keeps iOS from zooming the page when the field takes focus. */}
      <input
        className="mt-1 min-h-12 w-full border border-cyan/50 bg-[#1a0e28] px-3 py-2 text-base text-[#f4f0ff]"
        type={numeric ? "text" : type}
        inputMode={numeric ? "decimal" : undefined}
        autoComplete="off"
        value={value}
        onFocus={numeric ? selectField : undefined}
        onClick={numeric ? selectField : undefined}
        onMouseUp={numeric ? (event) => event.preventDefault() : undefined}
        onChange={(event) => {
          const next = event.target.value;
          if (!numeric || next === "" || /^\d*\.?\d*$/.test(next)) onChange(next);
        }}
      />
    </label>
  );
}
