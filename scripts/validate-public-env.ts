import { config } from "dotenv";
import { assertSafePublicEnvironment } from "@/lib/public-env";

config({ path: ".env.local" });
config();

try {
  assertSafePublicEnvironment(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Public environment configuration is invalid.");
  process.exitCode = 1;
}
