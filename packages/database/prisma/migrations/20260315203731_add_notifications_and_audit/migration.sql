-- Add association column to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "association" TEXT;

-- Add manualStatus column to QuizSession
ALTER TABLE "QuizSession" ADD COLUMN IF NOT EXISTS "manualStatus" TEXT;

-- CreateTable UserTypeAuditLog
CREATE TABLE IF NOT EXISTS "UserTypeAuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousType" "UserType",
    "newType" "UserType" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "UserTypeAuditLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey for UserTypeAuditLog
ALTER TABLE "UserTypeAuditLog" ADD CONSTRAINT "UserTypeAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "quizId" TEXT,
    "sessionId" TEXT,
    "candidateName" TEXT,
    "candidateEmail" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for Notification
CREATE INDEX IF NOT EXISTS "Notification_createdById_isRead_idx" ON "Notification"("createdById", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
