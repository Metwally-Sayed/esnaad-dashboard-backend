-- Check units in the database with their prices and projects
SELECT 
  u.id,
  u."unitNumber",
  u."buildingName",
  u.price,
  u."projectId",
  p.name as project_name
FROM units u
LEFT JOIN projects p ON u."projectId" = p.id
ORDER BY u."updatedAt" DESC
LIMIT 10;
