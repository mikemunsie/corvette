import type { GarageState, ItemStatus, ItemWork, ServiceItem } from "./types";

const DAY = 24 * 60 * 60 * 1000;
/** Miles this car is assumed to cover in a year. Ranks mileage against the calendar, and drives the look-ahead. */
export const MILES_PER_YEAR = 10000;

const HEAT_START = 0.5;
const HEAT_END = 1.05;

const rank: Record<ItemStatus, number> = {
  quiet: 0,
  ok: 1,
  soon: 2,
  overdue: 3,
};

export function worst(a: ItemStatus, b: ItemStatus): ItemStatus {
  return rank[a] >= rank[b] ? a : b;
}

export function addMonths(isoDate: string, months: number) {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + months, day));
}

/** Moves a clock forward by a fractional number of years, month by month. */
export function shiftDate(now: Date, years: number) {
  const months = years * 12;
  const whole = Math.trunc(months);
  const fraction = months - whole;
  const shifted = new Date(now.getTime());
  shifted.setMonth(shifted.getMonth() + whole);
  if (fraction === 0) return shifted;
  const next = new Date(shifted.getTime());
  next.setMonth(next.getMonth() + 1);
  return new Date(shifted.getTime() + fraction * (next.getTime() - shifted.getTime()));
}

export function forecastOdometer(odometer: number, years: number) {
  return Math.round(odometer + years * MILES_PER_YEAR);
}

function yearsBetween(isoMonth: string, now: Date) {
  const [year, month] = isoMonth.split("-").map(Number);
  const then = Date.UTC(year, (month || 1) - 1, 1);
  return (now.getTime() - then) / (365.25 * DAY);
}

/** Miles left on the distance clock. With no logged mileage, the count starts at 0. */
function mileRemaining(item: ServiceItem, odometer: number) {
  if (item.intervalMiles == null || item.intervalMiles <= 0) return null;
  return item.intervalMiles - (odometer - (item.lastMiles ?? 0));
}

function clockStatus(item: ServiceItem, odometer: number, now: Date): ItemStatus {
  let status: ItemStatus = "ok";
  const remaining = mileRemaining(item, odometer);
  if (remaining != null && item.intervalMiles != null) {
    if (remaining <= 0) status = "overdue";
    else if (remaining <= item.intervalMiles * 0.1) status = worst(status, "soon");
  }
  if (item.intervalMonths != null && item.lastDate) {
    const due = addMonths(item.lastDate, item.intervalMonths);
    const soonAt = due.getTime() - 30 * DAY;
    if (now.getTime() >= due.getTime()) status = "overdue";
    else if (now.getTime() >= soonAt) status = worst(status, "soon");
  }
  if (item.thicknessMm != null) {
    if (item.thicknessMm <= 2) status = "overdue";
    else if (item.thicknessMm <= 3) status = worst(status, "soon");
  }
  return status;
}

export function itemStatus(item: ServiceItem, odometer: number, now: Date): ItemStatus {
  if (item.stillOriginal) return "overdue";
  if (item.kind === "problem-only") return "quiet";
  if (item.kind === "tire") {
    let status: ItemStatus = "quiet";
    if (!item.dotDate) status = "soon";
    else {
      const age = yearsBetween(item.dotDate, now);
      if (age >= 10) status = "overdue";
      else if (age >= 6) status = "soon";
      else status = "ok";
    }
    if (item.tread32 != null) {
      if (item.tread32 <= 2) status = "overdue";
      else if (item.tread32 <= 4) status = worst(status, "soon");
      else status = worst(status, "ok");
    }
    return worst(status, clockStatus(item, odometer, now));
  }
  if (!item.lastDate && item.lastMiles == null) {
    return item.askOnFirstVisit ? "soon" : "quiet";
  }
  if (item.intervalMiles == null && item.intervalMonths == null) return "ok";
  return clockStatus(item, odometer, now);
}

function formatSpan(days: number) {
  const abs = Math.abs(days);
  if (abs < 45) {
    const rounded = Math.max(1, Math.round(abs));
    return `${rounded} day${rounded === 1 ? "" : "s"}`;
  }
  const months = Math.round(abs / 30.44);
  if (months < 24) return `${months} mo`;
  const years = Math.max(1, Math.round(months / 12));
  return `${years} yr`;
}

function duePhrase(days: number) {
  if (days > -1 && days < 1) return "Due now";
  if (days < 0) return `Overdue ${formatSpan(days)}`;
  return `Due in ${formatSpan(days)}`;
}

/** Miles left for ordering. Blank until the part has a date or a logged mileage. */
function listedMiles(item: ServiceItem, odometer: number) {
  if (!item.lastDate && item.lastMiles == null) return null;
  return mileRemaining(item, odometer);
}

/** The label on a next-up row. Mileage wins over the calendar when both exist. */
export function nextDue(item: ServiceItem, odometer: number, now: Date): { days: number; label: string } {
  if (item.stillOriginal) return { days: Number.NEGATIVE_INFINITY, label: "Original" };
  if (item.kind === "problem-only") return { days: Number.POSITIVE_INFINITY, label: "No schedule" };

  const clocks: { days: number; label: string }[] = [];
  const remaining = listedMiles(item, odometer);
  if (remaining != null) {
    const miles = Math.round(remaining);
    const days = remaining / (MILES_PER_YEAR / 365.25);
    const shown = Math.abs(miles).toLocaleString();
    clocks.push({
      days,
      label: miles < 0 ? `Overdue ${shown} mi` : miles === 0 ? "Due now" : `Due in ${shown} mi`,
    });
  } else if (item.intervalMonths != null && item.lastDate && item.intervalMonths > 0) {
    const due = addMonths(item.lastDate, item.intervalMonths);
    const days = (due.getTime() - now.getTime()) / DAY;
    clocks.push({ days, label: duePhrase(days) });
  }
  if (item.kind === "tire" && item.dotDate) {
    const days = (10 - yearsBetween(item.dotDate, now)) * 365.25;
    clocks.push({ days, label: duePhrase(days) });
  }
  if (item.tread32 != null && item.tread32 <= 4) {
    const days = (item.tread32 - 2) * 30;
    clocks.push({ days, label: item.tread32 <= 2 ? "Tread worn out" : "Tread low" });
  }
  if (item.thicknessMm != null && item.thicknessMm <= 3) {
    const days = (item.thicknessMm - 2) * 30;
    clocks.push({ days, label: item.thicknessMm <= 2 ? "Pads worn out" : "Pads low" });
  }

  if (clocks.length === 0) {
    if (item.kind === "tire" && !item.dotDate) return { days: 0, label: "Not logged" };
    if (!item.lastDate && item.lastMiles == null && item.askOnFirstVisit) return { days: 0, label: "Not logged" };
    if (!item.lastDate && item.lastMiles == null) return { days: Number.POSITIVE_INFINITY, label: "Not logged" };
    return { days: Number.POSITIVE_INFINITY, label: "No schedule" };
  }
  return clocks.reduce((soonest, clock) => (clock.days < soonest.days ? clock : soonest));
}

export function compareNextDue(a: ServiceItem, b: ServiceItem, odometer: number, now: Date) {
  if (a.stillOriginal !== b.stillOriginal) return a.stillOriginal ? -1 : 1;
  const leftMiles = listedMiles(a, odometer);
  const rightMiles = listedMiles(b, odometer);
  if (leftMiles != null && rightMiles != null && leftMiles !== rightMiles) {
    return leftMiles < rightMiles ? -1 : 1;
  }
  if ((leftMiles == null) !== (rightMiles == null)) return leftMiles == null ? 1 : -1;
  const left = nextDue(a, odometer, now).days;
  const right = nextDue(b, odometer, now).days;
  if (left < right) return -1;
  if (left > right) return 1;
  return a.name.localeCompare(b.name);
}

function heatFromPressure(pressure: number) {
  if (pressure < HEAT_START) return 0;
  if (pressure >= HEAT_END) return 1;
  const t = (pressure - HEAT_START) / (HEAT_END - HEAT_START);
  // The curve is 0 right at 50%, so hold a visible hint the moment the threshold is crossed.
  return Math.max(0.12, t * t * (3 - 2 * t));
}

/** How far a part is toward a visible problem. 0 is calm, 1 is fully lit. */
function pressureHeat(item: ServiceItem, odometer: number, now: Date) {
  if (item.stillOriginal || item.kind === "problem-only") return 0;
  let pressure = 0;
  if (item.kind === "tire") {
    if (item.dotDate) pressure = Math.max(pressure, yearsBetween(item.dotDate, now) / 10);
    if (item.tread32 != null) pressure = Math.max(pressure, (10 - item.tread32) / 8);
    if (item.intervalMiles != null && item.intervalMiles > 0) {
      pressure = Math.max(pressure, (odometer - (item.lastMiles ?? 0)) / item.intervalMiles);
    }
    return heatFromPressure(pressure);
  }
  if (!item.lastDate && item.lastMiles == null) return 0;
  if (item.intervalMiles != null && item.intervalMiles > 0) {
    pressure = Math.max(pressure, (odometer - (item.lastMiles ?? 0)) / item.intervalMiles);
  }
  if (item.intervalMonths != null && item.lastDate && item.intervalMonths > 0) {
    const start = Date.parse(`${item.lastDate.slice(0, 10)}T00:00:00Z`);
    const due = addMonths(item.lastDate, item.intervalMonths).getTime();
    const span = due - start;
    if (span > 0) pressure = Math.max(pressure, (now.getTime() - start) / span);
  }
  if (item.thicknessMm != null) pressure = Math.max(pressure, (6 - item.thicknessMm) / 4);
  return heatFromPressure(pressure);
}

export function itemHeat(item: ServiceItem, odometer: number, now: Date) {
  const status = itemStatus(item, odometer, now);
  const floor = status === "overdue" ? 0.92 : status === "soon" ? 0.58 : 0;
  return Math.max(floor, pressureHeat(item, odometer, now));
}

/** True when the look-ahead should list this part. Problem-only rows stay out. */
export function forecastHit(item: ServiceItem, odometer: number, now: Date) {
  if (item.kind === "problem-only") return false;
  const status = itemStatus(item, odometer, now);
  if (status === "soon" || status === "overdue") return true;
  return itemHeat(item, odometer, now) > 0.04;
}

export function zoneHeat(zoneIds: string[], state: GarageState, now: Date) {
  const wanted = new Set(zoneIds);
  let heat = 0;
  for (const item of state.items) {
    if (!wanted.has(item.zoneId)) continue;
    heat = Math.max(heat, itemHeat(item, state.odometer, now));
  }
  for (const issue of state.issues) {
    if (!issue.resolvedAt && wanted.has(issue.zoneId)) heat = 1;
  }
  return heat;
}

/**
 * What a zone should show: how bad it is, how far along it is, and whether a replacement or only a
 * check is driving it. A replacement outranks a check at the same level, and an open problem is
 * always treated as a replacement.
 */
export function zoneSignal(
  zoneIds: string[],
  state: GarageState,
  now: Date,
): { status: ItemStatus; heat: number; work: ItemWork } {
  const status = zoneStatus(zoneIds, state, now);
  const heat = zoneHeat(zoneIds, state, now);
  const wanted = new Set(zoneIds);
  const hasOpenIssue = state.issues.some((issue) => !issue.resolvedAt && wanted.has(issue.zoneId));
  // A due replacement wins even when a check in the same zone is further along.
  const replacementLeads = state.items.some((item) => {
    if (!wanted.has(item.zoneId) || item.work !== "replace") return false;
    const level = itemStatus(item, state.odometer, now);
    if (level === "soon" || level === "overdue") return true;
    return itemHeat(item, state.odometer, now) > 0.04;
  });
  return { status, heat, work: hasOpenIssue || replacementLeads ? "replace" : "inspect" };
}

export function zoneStatus(zoneIds: string[], state: GarageState, now: Date): ItemStatus {
  const wanted = new Set(zoneIds);
  let status: ItemStatus = "quiet";
  for (const item of state.items) {
    if (!wanted.has(item.zoneId)) continue;
    status = worst(status, itemStatus(item, state.odometer, now));
  }
  for (const issue of state.issues) {
    if (!issue.resolvedAt && wanted.has(issue.zoneId)) status = "overdue";
  }
  return status;
}

export function zoneAlert(zoneIds: string[], state: GarageState, now: Date) {
  const status = zoneStatus(zoneIds, state, now);
  if (status !== "soon" && status !== "overdue") return null;
  const wanted = new Set(zoneIds);
  let label = "CHECK";
  let best = 0;
  for (const item of state.items) {
    if (!wanted.has(item.zoneId)) continue;
    const itemLevel = itemStatus(item, state.odometer, now);
    if (rank[itemLevel] >= best && (itemLevel === "soon" || itemLevel === "overdue")) {
      best = rank[itemLevel];
      label = item.shortLabel;
    }
  }
  const hasOpenIssue = state.issues.some((issue) => !issue.resolvedAt && wanted.has(issue.zoneId));
  if (hasOpenIssue && best < rank.overdue) label = "OPEN";
  return { status, label };
}
