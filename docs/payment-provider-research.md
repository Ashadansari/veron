# Nepal payment provider research — 24 September 2026

This is an integration-planning note, not a claim that NajFancyStore has a merchant account or production credentials.

| Provider | Documented web checkout flow | Server verification | Practical notes |
| --- | --- | --- | --- |
| Khalti ePayment | Merchant server sends an authenticated JSON `POST` to `/api/v2/epayment/initiate/`; the response includes a `pidx` and `payment_url` for redirect. The docs publish separate sandbox and production base URLs. | After the customer returns, the merchant sends the `pidx` to `/api/v2/epayment/lookup/` with the merchant API key. The lookup returns status, total amount, and transaction ID. Only a verified `Completed` result with the expected amount should settle the order. | Uses a server-held `Key …` API key. The official docs provide a sandbox and test accounts; a live key requires Khalti merchant onboarding. This is a clear, documented redirect and lookup flow suitable for a first provider adapter. |
| eSewa ePay v2 | Merchant posts a signed form to the documented UAT or production form URL. Its HMAC-SHA256 signature covers the ordered `total_amount`, `transaction_uuid`, and `product_code` fields. | The browser return contains a Base64-encoded response with a signature that must be validated. The docs also provide a transaction-status endpoint; the merchant should verify status, transaction UUID, product code, and amount server-side. | Requires a merchant product code and secret key. It is a workable Nepal checkout option, but its form fields and signed callback differ from Khalti’s redirect plus lookup flow. |
| Fonepay Checkout / QR | Public Fonepay business pages describe merchant onboarding and Checkout/QR availability, but do not publish the transaction API contract, callback/signature rules, or verification endpoints needed for a safe code integration. | Not enough public technical detail to implement verification safely. Fonepay directs merchants to their bank or Fonepay team for integration. | Requires merchant/bank onboarding and provider-specific integration material before implementation. |

## Sources

- [Khalti ePayment documentation](https://docs.khalti.com/khalti-epayment/)
- [eSewa ePay v2 documentation](https://developer.esewa.com.np/pages/Epay-V2)
- [Fonepay Checkout FAQ](https://fonepay.com/public/customers/checkout-by-fonepay)
- [Fonepay merchant enrollment](https://fonepay.com/business/merchant-enrollment)

## Current project fit

The project already has a server-only `PaymentProvider` abstraction, order payment records, and integer-paisa order totals. Khalti was selected for the initial adapter based on its published server initiation and lookup workflow. No credentials should be pasted into chat; Khalti's secret is configured as a server-only environment variable, and production checkout remains unavailable until merchant credentials and end-to-end verification are configured.
