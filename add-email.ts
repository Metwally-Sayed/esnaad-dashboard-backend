import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addEmail() {
  try {
    const client = await prisma.externalClient.create({
      data: {
        email: 'metwallysayed1999@gmail.com',
        name: 'Metwally Sayed',
        verified: true,
        company: 'Test Company'
      }
    });
    console.log('✅ Successfully added to authorized emails:', client.email);
    console.log('You can now register with this email!');
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log('ℹ️ Email metwallysayed1999@gmail.com is already in the authorized list');
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

addEmail();