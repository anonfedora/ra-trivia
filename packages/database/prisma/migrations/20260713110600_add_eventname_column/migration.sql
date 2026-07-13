-- Add eventName column to AttendanceRecord if it doesn't exist
DO $$
BEGIN
    -- Add eventName column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AttendanceRecord' 
        AND column_name = 'eventName'
    ) THEN
        ALTER TABLE "AttendanceRecord" ADD COLUMN "eventName" TEXT;
    END IF;
END $$;
