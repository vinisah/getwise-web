ALTER TYPE "CEFRLevel" ADD VALUE IF NOT EXISTS 'A3';
CREATE TABLE IF NOT EXISTS "Cohort" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "level" "CEFRLevel" NOT NULL,
  "capacity" INTEGER NOT NULL CHECK ("capacity" > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "cohortId" TEXT REFERENCES "Cohort"("id");
ALTER TABLE "lessons" ADD COLUMN IF NOT EXISTS "cohortId" TEXT REFERENCES "Cohort"("id");
ALTER TABLE "lesson_bookings" ADD COLUMN IF NOT EXISTS "confirmation" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "lesson_bookings" ADD COLUMN IF NOT EXISTS "absenceReason" TEXT;
ALTER TABLE "lesson_bookings" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "lesson_bookings" ADD COLUMN IF NOT EXISTS "responseToken" TEXT;
UPDATE "lesson_bookings" SET "responseToken" = gen_random_uuid()::text WHERE "responseToken" IS NULL;
ALTER TABLE "lesson_bookings" ALTER COLUMN "responseToken" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_bookings_responseToken_key" ON "lesson_bookings"("responseToken");
CREATE INDEX IF NOT EXISTS "student_profiles_cohortId_idx" ON "student_profiles"("cohortId");
CREATE INDEX IF NOT EXISTS "lessons_cohortId_scheduledAt_idx" ON "lessons"("cohortId", "scheduledAt");
CREATE TABLE IF NOT EXISTS "WhatsAppEvent" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "student_profiles" ADD COLUMN IF NOT EXISTS "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;
