-- Comprehensive fix for AttendanceRecord table to match Prisma schema
-- The production database was created with incorrect NOT NULL constraints
DO $$
BEGIN
    -- Drop the unique constraint that prevents nullable userId
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'AttendanceRecord_userId_quizId_eventName_key'
    ) THEN
        ALTER TABLE "AttendanceRecord" DROP CONSTRAINT "AttendanceRecord_userId_quizId_eventName_key";
    END IF;

    -- Make userId nullable (was incorrectly set as NOT NULL in initial migration)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AttendanceRecord' 
        AND column_name = 'userId'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "AttendanceRecord" ALTER COLUMN "userId" DROP NOT NULL;
    END IF;

    -- Ensure quizId is nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AttendanceRecord' 
        AND column_name = 'quizId'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "AttendanceRecord" ALTER COLUMN "quizId" DROP NOT NULL;
    END IF;

    -- Ensure eventName is nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AttendanceRecord' 
        AND column_name = 'eventName'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "AttendanceRecord" ALTER COLUMN "eventName" DROP NOT NULL;
    END IF;

    -- Ensure candidateQRId is nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AttendanceRecord' 
        AND column_name = 'candidateQRId'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "AttendanceRecord" ALTER COLUMN "candidateQRId" DROP NOT NULL;
    END IF;

    -- Ensure attendeeId is nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AttendanceRecord' 
        AND column_name = 'attendeeId'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "AttendanceRecord" ALTER COLUMN "attendeeId" DROP NOT NULL;
    END IF;

    -- Ensure attendeeQRId is nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AttendanceRecord' 
        AND column_name = 'attendeeQRId'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "AttendanceRecord" ALTER COLUMN "attendeeQRId" DROP NOT NULL;
    END IF;
END $$;
