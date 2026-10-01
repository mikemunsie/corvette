import { handle } from "hono/aws-lambda";
import { app } from "./app.ts";
import { setApiEnabled } from "./store.ts";

const honoHandler = handle(app);

export async function handler(event: unknown, context: unknown) {
  if (isSnsDisable(event)) {
    await setApiEnabled(false);
    return { ok: true, apiEnabled: false };
  }
  return honoHandler(event as never, context as never);
}

function isSnsDisable(event: unknown) {
  if (!event || typeof event !== "object") return false;
  const record = event as { Records?: Array<{ EventSource?: string }> };
  return record.Records?.[0]?.EventSource === "aws:sns";
}
