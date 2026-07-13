-- Add attendeeId and attendeeQRId columns to AttendanceRecord if they don't exist
DO $$
BEGIN
    -- Add attendeeId column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AttendanceRecord' 
        AND column_name = 'attendeeId'
    ) THEN
        ALTER TABLE "AttendanceRecord" ADD COLUMN "attendeeId" TEXT;
    END IF;

    -- Add attendeeQRId column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'AttendanceRecord' 
        AND column_name = 'attendeeQRId'
    ) THEN
        ALTER TABLE "AttendanceRecord" ADD COLUMN "attendeeQRId" TEXT;
    END IF;
END $$;

-- Create index on attendeeId if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'AttendanceRecord' 
        AND indexname = 'AttendanceRecord_attendeeId_idx'
    ) THEN
        CREATE INDEX "AttendanceRecord_attendeeId_idx" ON "AttendanceRecord"("attendeeId");
    END IF;
END $$;

-- Add foreign key for attendeeId if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'AttendanceRecord_attendeeId_fkey'
    ) THEN
        ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "Attendee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Add foreign key for attendeeQRId if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'AttendanceRecord_attendeeQRId_fkey'
    ) THEN
        ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_attendeeQRId_fkey" FOREIGN KEY ("attendeeQRId") REFERENCES "AttendeeIdentityQR"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
