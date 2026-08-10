-- CreateTable
CREATE TABLE "public"."QuotaUsage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "usedRequests" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionCredit" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "remainingTokens" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RedeemCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "tokenAmount" INTEGER NOT NULL,
    "usedBySessionId" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "RedeemCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotaUsage_gameId_date_idx" ON "public"."QuotaUsage"("gameId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaUsage_sessionId_gameId_date_key" ON "public"."QuotaUsage"("sessionId", "gameId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCredit_sessionId_gameId_key" ON "public"."SessionCredit"("sessionId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "RedeemCode_code_key" ON "public"."RedeemCode"("code");

-- CreateIndex
CREATE INDEX "RedeemCode_gameId_idx" ON "public"."RedeemCode"("gameId");

