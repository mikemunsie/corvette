import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { defaultGarage, defaultItems } from "../src/data/defaults.ts";
import type { GarageState } from "../src/lib/types.ts";

export type CredentialRecord = {
  id: string;
  publicKey: string;
  counter: number;
  transports: string[];
};

export type SessionRecord = {
  id: string;
  expiresAt: number;
};

type ChallengeRecord = {
  id: string;
  challenge: string;
  expiresAt: number;
};

type FileDb = {
  apiEnabled: boolean;
  state: GarageState | null;
  credentials: CredentialRecord[];
  sessions: SessionRecord[];
  challenges: ChallengeRecord[];
};

const filePath = path.join(process.cwd(), ".data", "db.json");
let queue: Promise<unknown> = Promise.resolve();

function emptyFile(): FileDb {
  return {
    apiEnabled: true,
    state: null,
    credentials: [],
    sessions: [],
    challenges: [],
  };
}

async function readFileDb(): Promise<FileDb> {
  try {
    const raw = await readFile(filePath, "utf8");
    return { ...emptyFile(), ...JSON.parse(raw) };
  } catch {
    return emptyFile();
  }
}

async function writeFileDb(db: FileDb) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(db, null, 2));
}

function locked<T>(work: () => Promise<T>) {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function useDynamo() {
  return Boolean(process.env.GARAGE_TABLE && process.env.STATS_TABLE);
}

function doc() {
  return DynamoDBDocumentClient.from(new DynamoDBClient({}));
}

export async function getApiEnabled() {
  if (!useDynamo()) {
    const db = await readFileDb();
    return db.apiEnabled !== false;
  }
  const result = await doc().send(
    new GetCommand({
      TableName: process.env.STATS_TABLE,
      Key: { pk: "site" },
    }),
  );
  return result.Item?.apiEnabled !== false;
}

export async function setApiEnabled(enabled: boolean) {
  if (!useDynamo()) {
    await locked(async () => {
      const db = await readFileDb();
      db.apiEnabled = enabled;
      await writeFileDb(db);
    });
    return;
  }
  await doc().send(
    new PutCommand({
      TableName: process.env.STATS_TABLE,
      Item: { pk: "site", apiEnabled: enabled },
    }),
  );
}

/**
 * Lines the saved garage up with the car's current parts list. Retired items drop out, new ones
 * appear, descriptions follow the list, and default intervals apply unless the owner changed them.
 * Service history stays as saved.
 */
function retireItems(state: GarageState): GarageState {
  const saved = new Map(state.items.map((item) => [item.id, item]));
  const items = defaultItems().map((def) => {
    const own = saved.get(def.id);
    if (!own) return def;
    const intervals = own.intervalsEdited
      ? { intervalMiles: own.intervalMiles, intervalMonths: own.intervalMonths }
      : { intervalMiles: def.intervalMiles, intervalMonths: def.intervalMonths };
    return {
      ...own,
      zoneId: def.zoneId,
      group: def.group,
      name: def.name,
      shortLabel: def.shortLabel,
      detail: def.detail,
      kind: def.kind,
      work: def.work,
      askOnFirstVisit: def.askOnFirstVisit,
      ...intervals,
    };
  });
  return { ...state, items };
}

export async function getGarage(): Promise<GarageState> {
  if (!useDynamo()) {
    const db = await readFileDb();
    return retireItems(db.state ?? defaultGarage());
  }
  const result = await doc().send(
    new GetCommand({
      TableName: process.env.GARAGE_TABLE,
      Key: { pk: "garage", sk: "state" },
    }),
  );
  if (!result.Item?.json) return defaultGarage();
  return retireItems(JSON.parse(String(result.Item.json)) as GarageState);
}

export async function saveGarage(input: GarageState): Promise<GarageState> {
  const state = retireItems(input);
  if (!useDynamo()) {
    await locked(async () => {
      const db = await readFileDb();
      db.state = state;
      await writeFileDb(db);
    });
    return state;
  }
  await doc().send(
    new PutCommand({
      TableName: process.env.GARAGE_TABLE,
      Item: { pk: "garage", sk: "state", json: JSON.stringify(state) },
    }),
  );
  return state;
}

export async function listCredentials(): Promise<CredentialRecord[]> {
  if (!useDynamo()) {
    const db = await readFileDb();
    return db.credentials;
  }
  const result = await doc().send(
    new QueryCommand({
      TableName: process.env.GARAGE_TABLE,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: { ":pk": "auth", ":sk": "cred#" },
    }),
  );
  return (result.Items ?? []).map((item) => ({
    id: String(item.id),
    publicKey: String(item.publicKey),
    counter: Number(item.counter),
    transports: (item.transports as string[]) ?? [],
  }));
}

export async function saveCredential(credential: CredentialRecord) {
  if (!useDynamo()) {
    await locked(async () => {
      const db = await readFileDb();
      db.credentials = db.credentials.filter((item) => item.id !== credential.id);
      db.credentials.push(credential);
      await writeFileDb(db);
    });
    return;
  }
  await doc().send(
    new PutCommand({
      TableName: process.env.GARAGE_TABLE,
      Item: { pk: "auth", sk: `cred#${credential.id}`, ...credential },
    }),
  );
}

export async function saveSession(session: SessionRecord) {
  if (!useDynamo()) {
    await locked(async () => {
      const db = await readFileDb();
      db.sessions = db.sessions.filter((item) => item.expiresAt > Date.now());
      db.sessions.push(session);
      await writeFileDb(db);
    });
    return;
  }
  await doc().send(
    new PutCommand({
      TableName: process.env.GARAGE_TABLE,
      Item: {
        pk: "auth",
        sk: `sess#${session.id}`,
        id: session.id,
        expiresAt: session.expiresAt,
      },
    }),
  );
}

export async function getSession(id: string) {
  if (!useDynamo()) {
    const db = await readFileDb();
    return db.sessions.find((item) => item.id === id && item.expiresAt > Date.now()) ?? null;
  }
  const result = await doc().send(
    new GetCommand({
      TableName: process.env.GARAGE_TABLE,
      Key: { pk: "auth", sk: `sess#${id}` },
    }),
  );
  if (!result.Item) return null;
  const session = { id: String(result.Item.id), expiresAt: Number(result.Item.expiresAt) };
  if (session.expiresAt <= Date.now()) return null;
  return session;
}

export async function deleteSession(id: string) {
  if (!useDynamo()) {
    await locked(async () => {
      const db = await readFileDb();
      db.sessions = db.sessions.filter((item) => item.id !== id);
      await writeFileDb(db);
    });
    return;
  }
  await doc().send(
    new DeleteCommand({
      TableName: process.env.GARAGE_TABLE,
      Key: { pk: "auth", sk: `sess#${id}` },
    }),
  );
}

export async function saveChallenge(challenge: ChallengeRecord) {
  if (!useDynamo()) {
    await locked(async () => {
      const db = await readFileDb();
      db.challenges = db.challenges.filter((item) => item.expiresAt > Date.now());
      db.challenges.push(challenge);
      await writeFileDb(db);
    });
    return;
  }
  await doc().send(
    new PutCommand({
      TableName: process.env.GARAGE_TABLE,
      Item: { pk: "auth", sk: `chal#${challenge.id}`, ...challenge },
    }),
  );
}

export async function takeChallenge(id: string) {
  if (!useDynamo()) {
    return locked(async () => {
      const db = await readFileDb();
      const found = db.challenges.find((item) => item.id === id && item.expiresAt > Date.now());
      db.challenges = db.challenges.filter((item) => item.id !== id);
      await writeFileDb(db);
      return found ?? null;
    });
  }
  const client = doc();
  const result = await client.send(
    new GetCommand({
      TableName: process.env.GARAGE_TABLE,
      Key: { pk: "auth", sk: `chal#${id}` },
    }),
  );
  await client.send(
    new DeleteCommand({
      TableName: process.env.GARAGE_TABLE,
      Key: { pk: "auth", sk: `chal#${id}` },
    }),
  );
  if (!result.Item || Number(result.Item.expiresAt) <= Date.now()) return null;
  return {
    id: String(result.Item.id),
    challenge: String(result.Item.challenge),
    expiresAt: Number(result.Item.expiresAt),
  };
}
