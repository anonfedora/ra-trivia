-- CreateEnum
CREATE TYPE "ResultsDisplayMode" AS ENUM ('DETAILED', 'STUDY', 'SCORE_ONLY');

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "enableCandidateQR" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enableQRAttendance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qrAttendanceCode" TEXT,
ADD COLUMN     "qrCode" TEXT,
ADD COLUMN     "qrCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN     "resultsDisplayMode" "ResultsDisplayMode" NOT NULL DEFAULT 'DETAILED';

-- AlterTable
ALTER TABLE "QuizSession" ADD COLUMN     "attendanceMethod" TEXT,
ADD COLUMN     "attendanceVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "ipAddress" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "uploadedById" TEXT;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicQuiz" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicQuestion" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "optionA" TEXT,
    "optionB" TEXT,
    "optionC" TEXT,
    "optionD" TEXT,
    "correctOption" TEXT,
    "correctAnswer" TEXT,
    "format" "QuestionFormat" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "publicQuizId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "playerName" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "answers" JSONB,
    "publicQuizId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicQuestionAttempt" (
    "id" TEXT NOT NULL,
    "publicAttemptId" TEXT NOT NULL,
    "publicQuestionId" TEXT NOT NULL,
    "selectedOption" TEXT,
    "textAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicQuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateQR" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attendanceCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateQR_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quizId" TEXT,
    "eventName" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedInBy" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'QR_SCAN',
    "candidateQRId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualAttendance" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "church" TEXT,
    "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'MANUAL_ENTRY',
    "checkedInBy" TEXT,
    "eventName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "PublicQuiz_category_idx" ON "PublicQuiz"("category");

-- CreateIndex
CREATE INDEX "PublicQuiz_isActive_idx" ON "PublicQuiz"("isActive");

-- CreateIndex
CREATE INDEX "PublicQuestion_publicQuizId_idx" ON "PublicQuestion"("publicQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicAttempt_sessionId_key" ON "PublicAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "PublicAttempt_publicQuizId_idx" ON "PublicAttempt"("publicQuizId");

-- CreateIndex
CREATE INDEX "PublicAttempt_sessionId_idx" ON "PublicAttempt"("sessionId");

-- CreateIndex
CREATE INDEX "PublicQuestionAttempt_publicAttemptId_idx" ON "PublicQuestionAttempt"("publicAttemptId");

-- CreateIndex
CREATE INDEX "PublicQuestionAttempt_publicQuestionId_idx" ON "PublicQuestionAttempt"("publicQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateQR_attendanceCode_key" ON "CandidateQR"("attendanceCode");

-- CreateIndex
CREATE INDEX "CandidateQR_userId_idx" ON "CandidateQR"("userId");

-- CreateIndex
CREATE INDEX "CandidateQR_attendanceCode_idx" ON "CandidateQR"("attendanceCode");

-- CreateIndex
CREATE INDEX "CandidateQR_expiresAt_idx" ON "CandidateQR"("expiresAt");

-- CreateIndex
CREATE INDEX "AttendanceRecord_userId_idx" ON "AttendanceRecord"("userId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_quizId_idx" ON "AttendanceRecord"("quizId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_checkedInBy_idx" ON "AttendanceRecord"("checkedInBy");

-- CreateIndex
CREATE INDEX "AttendanceRecord_checkedInAt_idx" ON "AttendanceRecord"("checkedInAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_userId_quizId_eventName_key" ON "AttendanceRecord"("userId", "quizId", "eventName");

-- CreateIndex
CREATE INDEX "ManualAttendance_checkInTime_idx" ON "ManualAttendance"("checkInTime");

-- CreateIndex
CREATE INDEX "ManualAttendance_church_idx" ON "ManualAttendance"("church");

-- CreateIndex
CREATE INDEX "Quiz_createdById_idx" ON "Quiz"("createdById");

-- CreateIndex
CREATE INDEX "Quiz_isActive_idx" ON "Quiz"("isActive");

-- CreateIndex
CREATE INDEX "QuizSession_quizId_idx" ON "QuizSession"("quizId");

-- CreateIndex
CREATE INDEX "QuizSession_userId_idx" ON "QuizSession"("userId");

-- CreateIndex
CREATE INDEX "QuizSession_endTime_idx" ON "QuizSession"("endTime");

-- CreateIndex
CREATE INDEX "QuizSession_score_idx" ON "QuizSession"("score");

-- CreateIndex
CREATE INDEX "QuizSession_startTime_idx" ON "QuizSession"("startTime");

-- CreateIndex
CREATE INDEX "QuizSession_userId_quizId_idx" ON "QuizSession"("userId", "quizId");

-- CreateIndex
CREATE INDEX "User_uploadedById_idx" ON "User"("uploadedById");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicQuestion" ADD CONSTRAINT "PublicQuestion_publicQuizId_fkey" FOREIGN KEY ("publicQuizId") REFERENCES "PublicQuiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicAttempt" ADD CONSTRAINT "PublicAttempt_publicQuizId_fkey" FOREIGN KEY ("publicQuizId") REFERENCES "PublicQuiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicQuestionAttempt" ADD CONSTRAINT "PublicQuestionAttempt_publicAttemptId_fkey" FOREIGN KEY ("publicAttemptId") REFERENCES "PublicAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicQuestionAttempt" ADD CONSTRAINT "PublicQuestionAttempt_publicQuestionId_fkey" FOREIGN KEY ("publicQuestionId") REFERENCES "PublicQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateQR" ADD CONSTRAINT "CandidateQR_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_checkedInBy_fkey" FOREIGN KEY ("checkedInBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_candidateQRId_fkey" FOREIGN KEY ("candidateQRId") REFERENCES "CandidateQR"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;
