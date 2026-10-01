import { existsSync, readFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { app } from "./app.ts";

process.env.LOCALHOST_OPEN = "1";
loadEnv(".env.local");

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 3001 }, () => {
  console.log("API on http://127.0.0.1:3001");
});

function loadEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    if (!process.env[key]) process.env[key] = trimmed.slice(index + 1);
  }
}
