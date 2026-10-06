import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });
if (!process.env.TEST_DATABASE_URL) {
  console.error("TEST_DATABASE_URL must point to an isolated PostgreSQL database with the project migrations applied.");
  process.exit(1);
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const markerPath = resolve("node_modules/server-only");
const compiledMarkerPath = resolve("node_modules/next/dist/compiled/server-only");
let createdMarker = false;

if (!existsSync(markerPath)) {
  symlinkSync(compiledMarkerPath, markerPath, "junction");
  createdMarker = true;
}

try {
  const testFiles = readdirSync("tests").filter((file) => file.endsWith(".test.ts")).sort().map((file) => `tests/${file}`);
  const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", "--test-concurrency=1", ...testFiles], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "test" },
  });
  process.exitCode = result.status ?? 1;
} finally {
  if (createdMarker) rmSync(markerPath, { recursive: true, force: true });
}
