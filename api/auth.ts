import { randomBytes, timingSafeEqual } from "node:crypto";
import { deleteSession, getSession, saveSession } from "./store.ts";

const LOCAL_ORIGIN = "http://localhost:3000";

const COOKIE = "corvette_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function requestOrigin(origin: string | undefined) {
  const configured = process.env.ORIGIN;
  if (origin === LOCAL_ORIGIN || (origin && configured && origin === configured)) return origin;
  if (configured) return configured;
  return LOCAL_ORIGIN;
}

/** Set only by the local API process. Production never defines this. */
export function localOpen(origin: string | undefined) {
  if (process.env.LOCALHOST_OPEN !== "1") return false;
  const host = new URL(requestOrigin(origin)).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function codesMatch(given: string) {
  const expected = process.env.SETUP_CODE ?? "";
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function readSessionId(cookieHeader: string | undefined) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(id: string, origin: string, maxAge = SESSION_MS / 1000) {
  const secure = origin.startsWith("https:") ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(id)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function currentSession(cookieHeader: string | undefined) {
  const id = readSessionId(cookieHeader);
  if (!id) return null;
  return getSession(id);
}

export async function loginWithSetupCode(origin: string, given: string) {
  if (!codesMatch(given)) return null;
  const id = randomBytes(32).toString("hex");
  await saveSession({ id, expiresAt: Date.now() + SESSION_MS });
  return sessionCookie(id, origin);
}

export async function endSession(cookieHeader: string | undefined, origin: string) {
  const id = readSessionId(cookieHeader);
  if (id) await deleteSession(id);
  return sessionCookie("", origin, 0);
}
