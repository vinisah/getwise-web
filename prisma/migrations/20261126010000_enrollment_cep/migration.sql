-- Additive: existing records and permissions remain intact. No director is assigned.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isSchoolDirector" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pre_enrollments" ALTER COLUMN "courseId" DROP NOT NULL;
ALTER TABLE "pre_enrollments" ADD COLUMN IF NOT EXISTS "geographyRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pre_enrollments" ADD COLUMN IF NOT EXISTS "residence" JSONB;
CREATE TABLE IF NOT EXISTS "placement_requests" (
  "id" TEXT PRIMARY KEY,
  "applicationId" TEXT NOT NULL REFERENCES "pre_enrollments"("id") ON DELETE CASCADE,
  "applicationVersion" INTEGER NOT NULL,
  "binding" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "feedback" TEXT NOT NULL DEFAULT '',
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "placement_requests_applicationId_applicationVersion_key" ON "placement_requests"("applicationId", "applicationVersion");
CREATE INDEX IF NOT EXISTS "placement_requests_status_createdAt_idx" ON "placement_requests"("status", "createdAt");
ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "preEnrollmentId" TEXT REFERENCES "pre_enrollments"("id");
CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_preEnrollmentId_key" ON "enrollments"("preEnrollmentId");
