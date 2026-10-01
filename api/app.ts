import { Hono } from "hono";
import { BUDGET_LIMIT_USD } from "../src/lib/budget.ts";
import type { GarageState } from "../src/lib/types.ts";
import {
  currentSession,
  endSession,
  localOpen,
  loginWithSetupCode,
  requestOrigin,
} from "./auth.ts";
import { getApiEnabled, getGarage, saveGarage } from "./store.ts";

export const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true }));

app.use("/api/*", async (c, next) => {
  if (c.req.path === "/api/health") return next();
  const enabled = await getApiEnabled();
  if (!enabled) {
    return c.json(
      { error: `APIs are paused to keep hosting under $${BUDGET_LIMIT_USD}/month.` },
      503,
    );
  }
  return next();
});

app.get("/api/auth/me", async (c) => {
  const open = localOpen(c.req.header("origin"));
  const session = open || Boolean(await currentSession(c.req.header("cookie")));
  return c.json({ authenticated: session, localOpen: open });
});

app.post("/api/auth/login", async (c) => {
  const origin = requestOrigin(c.req.header("origin"));
  const body = await c.req.json().catch(() => ({}));
  const setupCode = typeof body.setupCode === "string" ? body.setupCode : "";
  const cookie = await loginWithSetupCode(origin, setupCode);
  if (!cookie) return c.json({ error: "Setup code is wrong." }, 401);
  c.header("set-cookie", cookie);
  return c.json({ ok: true });
});

app.post("/api/auth/logout", async (c) => {
  const origin = requestOrigin(c.req.header("origin"));
  c.header("set-cookie", await endSession(c.req.header("cookie"), origin));
  return c.json({ ok: true });
});

app.use("/api/garage", async (c, next) => {
  if (await signedIn(c.req.header("cookie"), c.req.header("origin"))) return next();
  return c.json({ error: "Sign in required." }, 401);
});

app.use("/api/garage/*", async (c, next) => {
  if (await signedIn(c.req.header("cookie"), c.req.header("origin"))) return next();
  return c.json({ error: "Sign in required." }, 401);
});

app.get("/api/garage", async (c) => c.json(await getGarage()));

app.get("/api/garage/export", async (c) => {
  const state = await getGarage();
  c.header("content-disposition", "attachment; filename=corvette-garage.json");
  return c.json(state);
});

app.put("/api/garage", async (c) => {
  const text = await c.req.text();
  if (text.length > 200_000) return c.json({ error: "That garage file is too large." }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return c.json({ error: "Garage data was not valid JSON." }, 400);
  }
  if (!isGarage(body)) return c.json({ error: "Garage data is missing required fields." }, 400);
  return c.json(await saveGarage(body));
});

async function signedIn(cookie: string | undefined, origin: string | undefined) {
  if (localOpen(origin)) return true;
  return Boolean(await currentSession(cookie));
}

function isGarage(value: unknown): value is GarageState {
  if (!value || typeof value !== "object") return false;
  const garage = value as GarageState;
  return (
    typeof garage.odometer === "number" &&
    garage.odometer >= 0 &&
    garage.odometer < 10_000_000 &&
    Array.isArray(garage.items) &&
    Array.isArray(garage.issues) &&
    Array.isArray(garage.dynoPoints) &&
    Boolean(garage.build)
  );
}
