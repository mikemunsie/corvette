export type ItemKind = "service" | "tire" | "problem-only";

/** Whether the scheduled job looks the part over or puts a new one in. Drives the diagram colors. */
export type ItemWork = "inspect" | "replace";

export type ServiceItem = {
  id: string;
  zoneId: string;
  group: string;
  name: string;
  shortLabel: string;
  detail?: string;
  kind: ItemKind;
  work: ItemWork;
  intervalMiles: number | null;
  intervalMonths: number | null;
  /** True once the owner has changed the intervals by hand; the defaults stop overriding them. */
  intervalsEdited?: boolean;
  lastDate: string | null;
  lastMiles: number | null;
  stillOriginal: boolean;
  askOnFirstVisit: boolean;
  tread32: number | null;
  dotDate: string | null;
  thicknessMm: number | null;
};

export type OpenIssue = {
  id: string;
  zoneId: string;
  description: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type BuildSheet = {
  engine: string;
  induction: string;
  ecm: string;
  cooling: string;
  exhaust: string;
  drivetrain: string;
  chassis: string;
  ac: string;
};

export type DynoPoint = {
  rpm: number;
  hp: number;
  tq: number;
};

export type GarageState = {
  odometer: number;
  items: ServiceItem[];
  issues: OpenIssue[];
  build: BuildSheet;
  dynoPoints: DynoPoint[];
};

export type ItemStatus = "quiet" | "ok" | "soon" | "overdue";

export type SafetyGroup = {
  id: string;
  title: string;
  hint: string;
  itemIds: string[];
  mode: "dot" | "date";
};
