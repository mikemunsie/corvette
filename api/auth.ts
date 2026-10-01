import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  deleteSession,
  getSession,
  listCredentials,
  saveChallenge,
  saveCredential,
  saveSession,
  takeChallenge,
  type CredentialRecord,
} from "./store.ts";

const LOCAL_ORIGIN = "http://localhost:3000";

const COOKIE = "corvette_session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function requestOrigin(origin: string | undefined) {
  const configured = process.env.ORIGIN;
  if (origin === LOCAL_ORIGIN || (origin && configured && origin === configured)) return origin;
  if (configured) return configured;
  return LOCAL_ORIGIN;
}

export function rpIDFor(origin: string) {
  return new URL(origin).hostname;
}

/** Set only by the local API process. Production never defines this. */
export function localPasskeyBypass(origin: string | undefined) {
  if (process.env.LOCALHOST_OPEN !== "1") return false;
  const host = new URL(requestOrigin(origin)).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function setupCode() {
  return process.env.SETUP_CODE ?? "";
}

export function codesMatch(given: string) {
  const expected = setupCode();
  const left = Buffer.from(given);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function bytesToB64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function b64ToBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

function toCredential(record: CredentialRecord) {
  return {
    id: record.id,
    publicKey: b64ToBytes(record.publicKey),
    counter: record.counter,
    transports: record.transports as AuthenticatorTransport[],
  };
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

export async function beginRegistration(origin: string) {
  const credentials = await listCredentials();
  const options = await generateRegistrationOptions({
    rpName: "Corvette",
    rpID: rpIDFor(origin),
    userName: "owner",
    userID: createHash("sha256").update("corvette-owner").digest(),
    userDisplayName: "Owner",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: credentials.map((credential) => ({ id: credential.id })),
  });
  const id = randomBytes(16).toString("hex");
  await saveChallenge({
    id,
    challenge: options.challenge,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return { challengeId: id, options };
}

export async function finishRegistration(origin: string, challengeId: string, response: RegistrationResponseJSON) {
  const pending = await takeChallenge(challengeId);
  if (!pending) return null;
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: origin,
    expectedRPID: rpIDFor(origin),
  });
  if (!verification.verified) return null;
  const credential = verification.registrationInfo.credential;
  await saveCredential({
    id: credential.id,
    publicKey: bytesToB64(credential.publicKey),
    counter: credential.counter,
    transports: response.response.transports ?? [],
  });
  return openSession(origin);
}

export async function beginLogin(origin: string) {
  const credentials = await listCredentials();
  const options = await generateAuthenticationOptions({
    rpID: rpIDFor(origin),
    allowCredentials: credentials.map((credential) => ({ id: credential.id })),
    userVerification: "preferred",
  });
  const id = randomBytes(16).toString("hex");
  await saveChallenge({
    id,
    challenge: options.challenge,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return { challengeId: id, options };
}

export async function finishLogin(origin: string, challengeId: string, response: AuthenticationResponseJSON) {
  const pending = await takeChallenge(challengeId);
  if (!pending) return null;
  const credentials = await listCredentials();
  const record = credentials.find((credential) => credential.id === response.id);
  if (!record) return null;
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: pending.challenge,
    expectedOrigin: origin,
    expectedRPID: rpIDFor(origin),
    credential: toCredential(record),
  });
  if (!verification.verified) return null;
  await saveCredential({
    ...record,
    counter: verification.authenticationInfo.newCounter,
  });
  return openSession(origin);
}

async function openSession(origin: string) {
  const id = randomBytes(32).toString("hex");
  await saveSession({ id, expiresAt: Date.now() + SESSION_MS });
  return sessionCookie(id, origin);
}

export async function endSession(cookieHeader: string | undefined, origin: string) {
  const id = readSessionId(cookieHeader);
  if (id) await deleteSession(id);
  return sessionCookie("", origin, 0);
}
