# Email verification (deferred)

Email verification is **not enabled** in the current registration or login flow. Public email/password registration validates and normalizes the address, rejects duplicate identities, and asks Better Auth to create a `CUSTOMER`. A server-side Better Auth database hook forces the new account to `CUSTOMER`; the browser cannot choose that role. No verification state is required for login or server-authorized customer access. Better Auth creates the normal HttpOnly session during signup; the registration endpoint forwards that cookie but never returns the session token in JSON.

No verification message is sent during registration. `EMAIL_PROVIDER_URL`, `EMAIL_PROVIDER_API_KEY`, and `EMAIL_FROM` are not required for local, staging, or production registration. The email transport and verification UI components remain as deferred groundwork only; they are not wired to Better Auth signup or customer session authorization. Re-enable verification only in a later, separately tested phase with a deliberate registration and session policy.

The existing Better Auth `verification` table remains part of the shared authentication schema for future Better Auth features. No schema or migration change was needed to disable registration verification.
