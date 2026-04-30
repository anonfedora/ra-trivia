-- Add enableCandidateQR field to Quiz table
ALTER TABLE "Quiz" ADD COLUMN "enableCandidateQR" BOOLEAN NOT NULL DEFAULT false;

-- Add index for better performance
CREATE INDEX "Quiz_enableCandidateQR_idx" ON "Quiz"("enableCandidateQR");
