-- CreateTable
CREATE TABLE "public"."LoginChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "magicTokenHash" TEXT,
    "codeHash" TEXT,
    "codeAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginChallenge_email_idx" ON "public"."LoginChallenge"("email");

-- CreateIndex
CREATE INDEX "LoginChallenge_magicTokenHash_idx" ON "public"."LoginChallenge"("magicTokenHash");

-- AddForeignKey
ALTER TABLE "public"."LoginChallenge" ADD CONSTRAINT "LoginChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
