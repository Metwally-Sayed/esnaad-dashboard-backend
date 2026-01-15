-- Check for duplicate unitIds first
SELECT "unitId", COUNT(*) as count
FROM "handovers"
GROUP BY "unitId"
HAVING COUNT(*) > 1;
