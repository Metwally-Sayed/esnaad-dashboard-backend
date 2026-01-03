import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function main() {
  console.log('🌱 Starting seed...');

  // Seed external clients (users allowed to register)
  const externalClients = [
    { email: 'admin@example.com', name: 'Admin User', company: 'Esnaad Management' },
    { email: 'owner1@example.com', name: 'John Owner', company: 'Property Investors' },
    { email: 'owner2@example.com', name: 'Jane Owner', company: 'Real Estate Co' },
  ];

  for (const client of externalClients) {
    await prisma.externalClient.upsert({
      where: { email: client.email },
      update: {},
      create: {
        email: client.email,
        name: client.name,
        company: client.company,
        verified: true,
      },
    });
  }

  console.log('✅ Seeded external clients');

  // Optionally create an admin user (already verified)
  const adminPassword = await bcrypt.hash('Admin123!', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Admin User',
      role: Role.ADMIN,
      emailVerified: true,
      isActive: true,
    },
  });

  console.log('✅ Seeded admin user');

  // Create owner users (already verified)
  const ownerPassword = await bcrypt.hash('Owner123!', 12);

  const owner1 = await prisma.user.upsert({
    where: { email: 'owner1@example.com' },
    update: {},
    create: {
      email: 'owner1@example.com',
      password: ownerPassword,
      name: 'John Owner',
      role: Role.OWNER,
      emailVerified: true,
      isActive: true,
    },
  });

  const owner2 = await prisma.user.upsert({
    where: { email: 'owner2@example.com' },
    update: {},
    create: {
      email: 'owner2@example.com',
      password: ownerPassword,
      name: 'Jane Owner',
      role: Role.OWNER,
      emailVerified: true,
      isActive: true,
    },
  });

  console.log('✅ Seeded owner users');

  // Seed projects
  const projects = [
    {
      name: 'Marina Tower',
      description: 'Luxury residential complex with stunning marina views',
      location: 'Dubai Marina, Dubai, UAE',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
      status: 'active',
      imageUrl: 'https://example.com/marina-tower.jpg',
    },
    {
      name: 'Downtown Plaza',
      description: 'Modern mixed-use development in the heart of downtown',
      location: 'Downtown Dubai, Dubai, UAE',
      startDate: new Date('2023-06-01'),
      endDate: new Date('2024-06-01'),
      status: 'completed',
      imageUrl: 'https://example.com/downtown-plaza.jpg',
    },
    {
      name: 'Green Valley Villas',
      description: 'Eco-friendly villa community with sustainable features',
      location: 'Al Barsha, Dubai, UAE',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2025-09-01'),
      status: 'active',
      imageUrl: 'https://example.com/green-valley.jpg',
    },
  ];

  // First, check if projects already exist
  const existingProjectsCount = await prisma.project.count();

  const createdProjects = [];
  if (existingProjectsCount === 0) {
    // Only create projects if none exist
    for (const project of projects) {
      const created = await prisma.project.create({
        data: project,
      });
      createdProjects.push(created);
    }
  } else {
    // If projects exist, fetch them for unit associations
    const allProjects = await prisma.project.findMany();
    createdProjects.push(...allProjects);
  }

  console.log('✅ Seeded projects');

  // Optionally seed some units with owner assignments and project associations
  const units = [
    {
      unitNumber: 'A-101',
      unitType: 'Apartment',
      buildingName: 'Tower A',
      address: '123 Main Street, Dubai, UAE',
      floor: 1,
      area: 120.5,
      bedrooms: 2,
      bathrooms: 2,
      description: 'Spacious 2-bedroom apartment with city view',
      amenities: 'Parking, Balcony, Gym Access',
      ownerId: owner1.id, // Assign to John Owner
      projectId: createdProjects.length > 0 ? createdProjects[0].id : undefined, // Marina Tower
    },
    {
      unitNumber: 'A-102',
      unitType: 'Apartment',
      buildingName: 'Tower A',
      address: '123 Main Street, Dubai, UAE',
      floor: 1,
      area: 95.0,
      bedrooms: 1,
      bathrooms: 1,
      description: 'Cozy 1-bedroom apartment',
      amenities: 'Parking, Pool Access',
      projectId: createdProjects.length > 0 ? createdProjects[0].id : undefined, // Marina Tower
    },
    {
      unitNumber: 'B-201',
      unitType: 'Villa',
      buildingName: 'Tower B',
      address: '456 Sheikh Zayed Road, Dubai, UAE',
      floor: 2,
      area: 150.0,
      bedrooms: 3,
      bathrooms: 2,
      description: 'Luxury 3-bedroom penthouse',
      amenities: 'Private Pool, Garden, Two Parking Spots',
      ownerId: owner2.id, // Assign to Jane Owner
      projectId: createdProjects.length > 2 ? createdProjects[2].id : createdProjects.length > 0 ? createdProjects[0].id : undefined, // Green Valley Villas or first project
    },
  ];

  for (const unit of units) {
    await prisma.unit.upsert({
      where: { unitNumber: unit.unitNumber },
      update: {},
      create: unit,
    });
  }

  console.log('✅ Seeded units');
  console.log('\n📝 Seeded users:');
  console.log('   Admin: admin@example.com / Admin123!');
  console.log('   Owner 1: owner1@example.com / Owner123! (owns unit A-101)');
  console.log('   Owner 2: owner2@example.com / Owner123! (owns unit B-201)');
  console.log('\n🚀 You can now:');
  console.log('   1. Start the server: npm run dev');
  console.log('   2. Login with any of the above credentials');
  console.log('\n🔍 View data: npm run prisma:studio\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
