"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [inferAdditionalFields({
    user: {
      phone: { type: "string" },
      role: { type: "string", input: false },
      deletedAt: { type: "date", input: false },
    },
  })],
});
