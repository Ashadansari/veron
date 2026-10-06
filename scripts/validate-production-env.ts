import { config } from "dotenv";
import { assertProductionEnvironment } from "@/lib/production-env";

config({ path: ".env.local" });
config();

try {
  assertProductionEnvironment(process.env);
  console.log("Production environment configuration is valid (values are not displayed).");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Production environment configuration is invalid.");
  process.exitCode = 1;
}
