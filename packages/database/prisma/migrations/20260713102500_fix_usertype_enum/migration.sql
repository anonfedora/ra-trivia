-- Add missing PRE_PLENIPOTENTIARY_EXAMS value to UserType enum
-- This value exists in production database but was removed in a previous migration
DO $$
BEGIN
    -- Check if the value exists in the enum
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'PRE_PLENIPOTENTIARY_EXAMS' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'UserType')
    ) THEN
        -- Add the missing value to the enum
        ALTER TYPE "UserType" ADD VALUE 'PRE_PLENIPOTENTIARY_EXAMS';
    END IF;
END $$;
