-- Make userId column nullable in AttendanceRecord to match Prisma schema
DO $$
BEGIN
    -- Check if userId column is NOT NULL and make it nullable
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AttendanceRecord' 
        AND column_name = 'userId'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "AttendanceRecord" ALTER COLUMN "userId" DROP NOT NULL;
    END IF;
END $$;
