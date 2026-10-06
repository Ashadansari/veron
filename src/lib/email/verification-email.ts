import "server-only";

import { z } from "zod";

type VerificationMessage = {
  to: string;
  name: string;
  url: string;
};

type TestMessage = VerificationMessage & { subject: string };

const testMessages: TestMessage[] = [];

function getProviderConfiguration(environment: Record<string, string | undefined> = process.env) {
  const endpoint = environment.EMAIL_PROVIDER_URL?.trim();
  const apiKey = environment.EMAIL_PROVIDER_API_KEY?.trim();
  const from = environment.EMAIL_FROM?.trim();
  if (!endpoint || !apiKey || !from) return null;

  let url: URL;
  try { url = new URL(endpoint); }
  catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || !z.email().safeParse(from).success) return null;
  return { endpoint: url.toString(), apiKey, from };
}

export function isVerificationEmailDeliveryConfigured(environment: Record<string, string | undefined> = process.env): boolean {
  if (environment.NODE_ENV === "test") return true;
  return getProviderConfiguration(environment) !== null;
}

export async function sendVerificationEmail(message: VerificationMessage): Promise<void> {
  const subject = "Verify your Naj Fancy Store email";
  if (process.env.NODE_ENV === "test") {
    testMessages.push({ ...message, subject });
    return;
  }

  const config = getProviderConfiguration();
  if (!config) throw new Error("EMAIL_DELIVERY_NOT_CONFIGURED");

  const text = `Hello ${message.name},\n\nVerify your email address by opening this link:\n${message.url}\n\nThis link expires in one hour. If you did not create this account, ignore this email.`;
  const html = `<p>Hello ${escapeHtml(message.name)},</p><p>Verify your email address:</p><p><a href="${escapeHtml(message.url)}">Verify email</a></p><p>This link expires in one hour. If you did not create this account, ignore this email.</p>`;
  try {
    const response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: message.to,
        subject,
        text,
        html,
      }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("EMAIL_DELIVERY_FAILED");
  } catch {
    // Never include provider responses, credentials, or the signed URL in errors.
    throw new Error("EMAIL_DELIVERY_FAILED");
  }
}

export function getTestVerificationEmails(email?: string): ReadonlyArray<TestMessage> {
  if (process.env.NODE_ENV !== "test") throw new Error("Test email sink is available only in NODE_ENV=test.");
  return testMessages.filter((message) => !email || message.to === email.toLowerCase());
}

export function clearTestVerificationEmails(): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Test email sink is available only in NODE_ENV=test.");
  testMessages.length = 0;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}
