import "server-only";
import { getKhaltiPaymentProvider } from "@/lib/commerce/khalti-provider";

export type CreatePaymentRequest = {
  orderNumber: string;
  amountPaisa: bigint;
  currency: "NPR";
  returnUrl: string;
  websiteUrl: string;
};

export type ProviderPayment = {
  providerReference: string;
  redirectUrl: string;
};

export type ProviderVerification = {
  providerReference: string;
  transactionReference: string | null;
  amountPaisa: bigint;
  outcome: "PAID" | "PENDING" | "FAILED" | "UNKNOWN";
};

export interface PaymentProvider {
  readonly id: string;
  isConfigured(): boolean;
  createPayment(request: CreatePaymentRequest): Promise<ProviderPayment>;
  verifyPayment(providerReference: string): Promise<ProviderVerification>;
}

const providers = new Map<string, PaymentProvider>();

export function registerPaymentProvider(provider: PaymentProvider) {
  if (providers.has(provider.id)) {
    throw new Error("Payment provider " + provider.id + " is already registered.");
  }
  providers.set(provider.id, provider);
}

export function getPaymentProvider(providerId: string): PaymentProvider {
  const provider = providers.get(providerId) ?? (providerId === "khalti" ? getKhaltiPaymentProvider() : undefined);
  if (!provider) {
    throw new Error("Payment provider " + providerId + " is not configured.");
  }
  return provider;
}
