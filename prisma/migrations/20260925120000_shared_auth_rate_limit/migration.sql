-- Better Auth shared rate-limit storage. Database operations use conditional
-- atomic updates, so counters are shared across application instances.
CREATE TABLE "rate_limit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "last_request" BIGINT NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rate_limit_key_unique" ON "rate_limit"("key");
CREATE INDEX "rate_limit_last_request_idx" ON "rate_limit"("last_request");
