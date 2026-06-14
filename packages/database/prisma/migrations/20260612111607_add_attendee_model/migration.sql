/*
  Warnings:

  - The values [PRE_PLENIPOTENTIARY_EXAMS] on the enum `UserType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserType_new" AS ENUM ('AMBASSADOR_RANK_EXAMS', 'EXTRAORDINARY_RANK_EXAMS', 'PRE_PLENIPOTENTIARY_RANK_EXAMS', 'PLENIPOTENTIARY_RANK_EXAMS');
ALTER TABLE "public"."Question" ALTER COLUMN "questionType" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "userType" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "userType" TYPE "UserType_new" USING ("userType"::text::"UserType_new");
ALTER TABLE "Question" ALTER COLUMN "questionType" TYPE "UserType_new" USING ("questionType"::text::"UserType_new");
ALTER TABLE "UserTypeAuditLog" ALTER COLUMN "previousType" TYPE "UserType_new" USING ("previousType"::text::"UserType_new");
ALTER TABLE "UserTypeAuditLog" ALTER COLUMN "newType" TYPE "UserType_new" USING ("newType"::text::"UserType_new");
ALTER TYPE "UserType" RENAME TO "UserType_old";
ALTER TYPE "UserType_new" RENAME TO "UserType";
DROP TYPE "public"."UserType_old";
ALTER TABLE "Question" ALTER COLUMN "questionType" SET DEFAULT 'AMBASSADOR_RANK_EXAMS';
ALTER TABLE "User" ALTER COLUMN "userType" SET DEFAULT 'AMBASSADOR_RANK_EXAMS';
COMMIT;

-- DropForeignKey
ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_userId_fkey";

-- DropIndex
DROP INDEX "AttendanceRecord_userId_quizId_eventName_key";

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "attendeeId" TEXT,
ADD COLUMN     "attendeeQRId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Attendee" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "church" TEXT,
    "email" TEXT,
    "phoneNumber" TEXT,
    "identityCode" TEXT NOT NULL,
    "registeredById" TEXT NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendeeIdentityQR" (
    "id" TEXT NOT NULL,
    "attendeeId" TEXT NOT NULL,
    "identityCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendeeIdentityQR_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attendee_identityCode_key" ON "Attendee"("identityCode");

-- CreateIndex
CREATE INDEX "Attendee_registeredById_idx" ON "Attendee"("registeredById");

-- CreateIndex
CREATE INDEX "Attendee_church_idx" ON "Attendee"("church");

-- CreateIndex
CREATE UNIQUE INDEX "AttendeeIdentityQR_attendeeId_key" ON "AttendeeIdentityQR"("attendeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendeeIdentityQR_identityCode_key" ON "AttendeeIdentityQR"("identityCode");

-- CreateIndex
CREATE INDEX "AttendeeIdentityQR_attendeeId_idx" ON "AttendeeIdentityQR"("attendeeId");

-- CreateIndex
CREATE INDEX "AttendeeIdentityQR_identityCode_idx" ON "AttendeeIdentityQR"("identityCode");

-- CreateIndex
CREATE INDEX "AttendeeIdentityQR_expiresAt_idx" ON "AttendeeIdentityQR"("expiresAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_attendeeId_idx" ON "AttendanceRecord"("attendeeId");

-- AddForeignKey
ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendeeIdentityQR" ADD CONSTRAINT "AttendeeIdentityQR_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_attendeeQRId_fkey" FOREIGN KEY ("attendeeQRId") REFERENCES "AttendeeIdentityQR"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
