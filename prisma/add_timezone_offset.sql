-- Add timezoneOffset to User (UTC offset in hours, -12 to +12).
-- Run this once on your DB if you prefer not to use `prisma db push`.
-- Schema: backcrypto (adjust if your schema name is different).

ALTER TABLE "backcrypto"."User"
ADD COLUMN IF NOT EXISTS "timezoneOffset" INTEGER NOT NULL DEFAULT 0;

-- Optional: add a check constraint to enforce -12..12
-- ALTER TABLE "backcrypto"."User" ADD CONSTRAINT "User_timezoneOffset_range" CHECK ("timezoneOffset" >= -12 AND "timezoneOffset" <= 12);
