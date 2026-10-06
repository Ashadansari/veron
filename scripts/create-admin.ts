import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { config } from "dotenv";
import { createFirstAdmin, inspectAdminEmail, recoverCustomerAsFirstAdmin } from "./first-admin-service";

config({ path: ".env.local" });
config({ path: ".env" });

async function ask(label: string) {
  const terminal = createInterface({ input: stdin, output: stdout });
  try { return (await terminal.question(label)).trim(); }
  finally { terminal.close(); }
}

async function askHidden(label: string) {
  if (!stdin.isTTY || !stdin.setRawMode) throw new Error("Run npm run create-admin from an interactive terminal so the password can be entered without echo.");
  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  let value = "";
  let onData: ((chunk: Buffer) => void) | undefined;
  try {
    return await new Promise<string>((resolve, reject) => {
      const handler = (chunk: Buffer) => {
        for (const character of chunk.toString("utf8")) {
          if (character === "\u0003" || character === "\u0004") { stdout.write("\n"); reject(new Error("Setup cancelled.")); return; }
          if (character === "\r" || character === "\n") { stdout.write("\n"); stdin.off("data", handler); resolve(value); return; }
          if (character === "\u007f" || character === "\b") { value = value.slice(0, -1); continue; }
          if (character >= " ") value += character;
        }
      };
      onData = handler;
      stdin.on("data", handler);
    });
  } finally {
    if (onData) stdin.off("data", onData);
    stdin.setRawMode(false);
    stdin.pause();
  }
}

async function main() {
  try {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Configure .env.local before running setup.");
    if (!stdin.isTTY || !stdin.setRawMode) throw new Error("Run npm run create-admin from an interactive terminal so the password can be entered without echo.");
    const email = await ask("Administrator email: ");
    const existing = await inspectAdminEmail(email);
    if (existing.exists && existing.deleted) {
      throw new Error("The matching account is deactivated. No changes were made.");
    }
    if (existing.exists && existing.role === "ADMIN") {
      throw new Error("This email already belongs to an administrator. Its password and account were not changed.");
    }

    if (existing.exists && existing.role === "CUSTOMER") {
      console.log("An existing CUSTOMER account was found for this email.");
      console.log("Recovery will promote that same account, set a new Better Auth password, and revoke its current sessions.");
      console.log("No second identity will be created.");
      const confirmationWord = await ask('Type PROMOTE to confirm this controlled recovery: ');
      if (confirmationWord !== "PROMOTE") throw new Error("Recovery was not confirmed. No changes were made.");
      const password = await askHidden("New administrator password (hidden): ");
      const confirmation = await askHidden("Confirm password (hidden): ");
      if (password !== confirmation) throw new Error("Passwords do not match.");
      const recovered = await recoverCustomerAsFirstAdmin({ email, password });
      console.log(`Existing account promoted to ADMIN for ${recovered.email}. Log in through /login, then visit /admin.`);
      return;
    }

    const name = await ask("Administrator name: ");
    const password = await askHidden("Password (hidden): ");
    const confirmation = await askHidden("Confirm password (hidden): ");
    if (password !== confirmation) throw new Error("Passwords do not match.");
    const created = await createFirstAdmin({ name, email, password });
    console.log(`First administrator created for ${created.email}. Log in through /login, then visit /admin.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "First-admin setup failed.");
    process.exitCode = 1;
  }
}

void main();
