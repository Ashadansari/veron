import "server-only";

import { z } from "zod";
import type { CreatePaymentRequest, PaymentProvider, ProviderPayment, ProviderVerification } from "@/lib/commerce/payment-provider";

const initiationResponseSchema = z.object({
  pidx: z.string().min(1).max(180),
  payment_url: z.string().url(),
});

const lookupResponseSchema = z.object({
  pidx: z.string().min(1).max(180),
  total_amount: z.number().int().nonnegative(),
  status: z.string().min(1),
  transaction_id: z.string().min(1).nullable().optional(),
});

export class KhaltiConfigurationError extends Error {
  constructor() { super("Khalti payments are not configured."); this.name = "KhaltiConfigurationError"; }
}

export class KhaltiRequestError extends Error {
  constructor(readonly status: number) { super("Khalti could not process the payment request."); this.name = "KhaltiRequestError"; }
}

export class KhaltiResponseError extends Error {
  constructor() { super("Khalti returned an invalid payment response."); this.name = "KhaltiResponseError"; }
}

type Fetcher = typeof fetch;

export class KhaltiPaymentProvider implements PaymentProvider {
  readonly id = "khalti";

  constructor(private readonly fetcher: Fetcher = fetch) {}

  isConfigured() {
    const key = process.env.KHALTI_SECRET_KEY?.trim();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    return Boolean(key && appUrl && this.baseUrl() && validAppUrl(appUrl));
  }

  async createPayment(request: CreatePaymentRequest): Promise<ProviderPayment> {
    const { baseUrl, secretKey } = this.configuration();
    if (request.currency !== "NPR" || request.amountPaisa < 1001n || request.amountPaisa > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("Khalti checkout requires a safe whole-paisa amount greater than NPR 10.");
    }

    const response = await this.fetcher(`${baseUrl}/epayment/initiate/`, {
      method: "POST",
      headers: { Authorization: `Key ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        return_url: request.returnUrl,
        website_url: request.websiteUrl,
        amount: Number(request.amountPaisa),
        purchase_order_id: request.orderNumber,
        purchase_order_name: `VÉRON ${request.orderNumber}`,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new KhaltiRequestError(response.status);
    const result = initiationResponseSchema.safeParse(await response.json());
    if (!result.success || !isKhaltiPaymentUrl(result.data.payment_url)) throw new KhaltiResponseError();
    return { providerReference: result.data.pidx, redirectUrl: result.data.payment_url };
  }

  async verifyPayment(providerReference: string): Promise<ProviderVerification> {
    const { baseUrl, secretKey } = this.configuration();
    const response = await this.fetcher(`${baseUrl}/epayment/lookup/`, {
      method: "POST",
      headers: { Authorization: `Key ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ pidx: providerReference }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new KhaltiRequestError(response.status);
    const result = lookupResponseSchema.safeParse(await response.json());
    if (!result.success || result.data.pidx !== providerReference || !Number.isSafeInteger(result.data.total_amount)) throw new KhaltiResponseError();
    return {
      providerReference: result.data.pidx,
      transactionReference: result.data.transaction_id ?? null,
      amountPaisa: BigInt(result.data.total_amount),
      outcome: mapKhaltiOutcome(result.data.status),
    };
  }

  private configuration() {
    const secretKey = process.env.KHALTI_SECRET_KEY?.trim();
    const baseUrl = this.baseUrl();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!secretKey || !baseUrl || !appUrl || !validAppUrl(appUrl)) throw new KhaltiConfigurationError();
    return { secretKey, baseUrl };
  }

  private baseUrl() {
    const environment = process.env.KHALTI_ENVIRONMENT ?? "sandbox";
    if (environment === "sandbox") return "https://dev.khalti.com/api/v2";
    if (environment === "production") return "https://khalti.com/api/v2";
    return null;
  }
}

export function createKhaltiProvider(fetcher?: Fetcher) {
  return new KhaltiPaymentProvider(fetcher);
}

export function isKhaltiPaymentConfigured() {
  return new KhaltiPaymentProvider().isConfigured();
}

export function getKhaltiPaymentProvider() {
  return new KhaltiPaymentProvider();
}

export function getKhaltiReturnUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl || !validAppUrl(appUrl)) throw new KhaltiConfigurationError();
  return new URL("/api/payments/khalti/return", appUrl).toString();
}

function validAppUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:");
  } catch { return false; }
}

function isKhaltiPaymentUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "pay.khalti.com" || url.hostname === "test-pay.khalti.com");
  } catch { return false; }
}

function mapKhaltiOutcome(status: string): ProviderVerification["outcome"] {
  if (status === "Completed") return "PAID";
  if (status === "Pending" || status === "Initiated") return "PENDING";
  if (status === "Expired" || status === "User canceled" || status === "Canceled" || status === "Failed") return "FAILED";
  return "UNKNOWN";
}
