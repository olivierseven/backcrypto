-- Check if BioSimulationState has duplicate userIds (would block db push when adding UNIQUE).
-- Run in Neon SQL Editor. Schema: backcrypto.

SELECT "userId", COUNT(*) AS cnt
FROM "backcrypto"."BioSimulationState"
GROUP BY "userId"
HAVING COUNT(*) > 1;

-- If this returns 0 rows, it's safe to run `npx prisma db push`.
-- If it returns rows, you have duplicates; resolve them before pushing.
