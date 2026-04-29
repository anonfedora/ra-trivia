-- Create CandidateQR table
CREATE TABLE IF NOT EXISTS "CandidateQR" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateQR_pkey" PRIMARY KEY ("id")
);

-- Create unique index on attendanceCode
CREATE UNIQUE INDEX IF NOT EXISTS "CandidateQR_attendanceCode_key" ON "CandidateQR"("attendanceCode");

-- Create indexes for CandidateQR
CREATE INDEX IF NOT EXISTS "CandidateQR_userId_idx" ON "CandidateQR"("userId");
CREATE INDEX IF NOT EXISTS "CandidateQR_expiresAt_idx" ON "CandidateQR"("expiresAt");

-- Create AttendanceRecord table
CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInBy" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'QR_SCAN',
    "candidateQRId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on userId and quizId
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_userId_quizId_key" ON "AttendanceRecord"("userId", "quizId");

-- Create indexes for AttendanceRecord
CREATE INDEX IF NOT EXISTS "AttendanceRecord_userId_idx" ON "AttendanceRecord"("userId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_quizId_idx" ON "AttendanceRecord"("quizId");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_checkedInBy_idx" ON "AttendanceRecord"("checkedInBy");
CREATE INDEX IF NOT EXISTS "AttendanceRecord_checkedInAt_idx" ON "AttendanceRecord"("checkedInAt");

-- Add foreign key constraints
ALTER TABLE "CandidateQR" ADD CONSTRAINT "CandidateQR_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_checkedInBy_fkey" FOREIGN KEY ("checkedInBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_candidateQRId_fkey" FOREIGN KEY ("candidateQRId") REFERENCES "CandidateQR"("id") ON DELETE SET NULL ON UPDATE CASCADE;
