# Khalti ePayment configuration

The adapter follows Khalti's official Web Checkout flow: server-side `POST /api/v2/epayment/initiate/`, redirect to the returned `payment_url`, then server-side `POST /api/v2/epayment/lookup/` using the returned `pidx`. The browser return query is untrusted; only a lookup result with status `Completed`, matching `pidx`, transaction reference, order association, and exact paisa amount can mark the order paid.

Set these environment values in the server runtime:

- `KHALTI_SECRET_KEY`: the merchant `live_secret_key` obtained from Khalti's sandbox or production merchant console. Never prefix this variable with `NEXT_PUBLIC_`.
- `KHALTI_ENVIRONMENT`: `sandbox` for `https://dev.khalti.com/api/v2`, or `production` for `https://khalti.com/api/v2`. Defaults to `sandbox` when omitted.
- `NEXT_PUBLIC_APP_URL`: the store's canonical origin, used for the documented `website_url` and the GET return URL. It must be an absolute HTTP(S) URL (HTTP only outside production).

Khalti's API does not return a currency field in its lookup response. The app binds the payment to the NPR order, sends amount in paisa, and verifies the exact `total_amount` returned by Khalti.

No real Khalti credentials are included in the repository. Without the secret key, the adapter reports itself unavailable and COD remains usable.

An explicit non-success HTTP response during initiation is recorded as failed and releases the unpaid order's stock. A timeout or network error is ambiguous, so the payment remains pending and is never treated as paid; an admin should verify/cancel that order before the stock is considered available again.
