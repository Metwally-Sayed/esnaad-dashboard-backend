import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // First, find the Al Noor Towers project
  const project = await prisma.project.findFirst({
    where: {
      name: 'Al Noor Towers'
    }
  });

  if (!project) {
    console.log('Al Noor Towers project not found');
    return;
  }

  console.log('Found project:', project.name, project.id);

  // Check if units already exist for this project
  const existingUnits = await prisma.unit.findMany({
    where: {
      projectId: project.id
    }
  });

  console.log('Existing units:', existingUnits.length);

  if (existingUnits.length === 0) {
    // Create sample units for the project with unique unit numbers
    const projectPrefix = 'ANT'; // Al Noor Towers prefix
    const units = [
      { unitNumber: `${projectPrefix}-A-101`, buildingName: 'Tower A', floor: 1, area: 120, bedrooms: 2, bathrooms: 2, status: 'available' },
      { unitNumber: `${projectPrefix}-A-102`, buildingName: 'Tower A', floor: 1, area: 150, bedrooms: 3, bathrooms: 2, status: 'occupied' },
      { unitNumber: `${projectPrefix}-A-201`, buildingName: 'Tower A', floor: 2, area: 120, bedrooms: 2, bathrooms: 2, status: 'available' },
      { unitNumber: `${projectPrefix}-A-202`, buildingName: 'Tower A', floor: 2, area: 180, bedrooms: 3, bathrooms: 3, status: 'occupied' },
      { unitNumber: `${projectPrefix}-B-101`, buildingName: 'Tower B', floor: 1, area: 100, bedrooms: 1, bathrooms: 1, status: 'available' },
      { unitNumber: `${projectPrefix}-B-102`, buildingName: 'Tower B', floor: 1, area: 130, bedrooms: 2, bathrooms: 2, status: 'maintenance' },
      { unitNumber: `${projectPrefix}-B-201`, buildingName: 'Tower B', floor: 2, area: 100, bedrooms: 1, bathrooms: 1, status: 'available' },
      { unitNumber: `${projectPrefix}-B-202`, buildingName: 'Tower B', floor: 2, area: 160, bedrooms: 3, bathrooms: 2, status: 'reserved' },
    ];

    console.log('Creating units for project...');

    for (const unit of units) {
      await prisma.unit.create({
        data: {
          ...unit,
          projectId: project.id
        }
      });
      console.log(`Created unit: ${unit.unitNumber}`);
    }

    console.log('Units created successfully!');
  }

  // Now fetch and display all units for this project
  const allUnits = await prisma.unit.findMany({
    where: {
      projectId: project.id
    },
    include: {
      project: {
        select: {
          name: true
        }
      }
    }
  });

  console.log('\nAll units for Al Noor Towers:');
  allUnits.forEach(unit => {
    console.log(`- ${unit.unitNumber}: ${unit.status} (${unit.bedrooms}BR, ${unit.area}m²)`);
  });

  // Update project to include unit count
  const projectWithCount = await prisma.project.findUnique({
    where: { id: project.id },
    include: {
      _count: {
        select: { units: true }
      }
    }
  });

  console.log('\nProject unit count:', projectWithCount?._count.units);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });