# Quick Start Guide

Get your Units Management Dashboard backend running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or Neon.tech)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Update `.env` file with your database URL:

```env
DATABASE_URL="postgresql://user:password@host:5432/database"
JWT_SECRET="generate-a-random-32-char-secret-key-here-abc123xyz"
JWT_REFRESH_SECRET="generate-another-random-32-char-secret-key-def456uvw"
```

Generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations (creates all tables)
npm run prisma:migrate

# When prompted for migration name, enter: init
```

### 4. Seed External Clients (Required for Registration)

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create external clients (allowed to register)
  await prisma.externalClient.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      company: 'Esnaad',
      verified: true,
    },
  });

  await prisma.externalClient.create({
    data: {
      email: 'owner@example.com',
      name: 'Owner User',
      company: 'Property Co',
      verified: true,
    },
  });

  console.log('✅ Seeded external clients');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Run seed:
```bash
npm run prisma:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Server runs at `http://localhost:3000`

## Test the API

### 1. Check Health

```bash
curl http://localhost:3000/health
```

### 2. Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123",
    "name": "Admin User"
  }'
```

**Note**: Check server logs for the OTP (development mode only)

### 3. Verify OTP

```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "otp": "123456"
  }'
```

Save the `accessToken` from the response.

### 4. Create Admin User

To make the user an admin, update directly in database:

```bash
# Open Prisma Studio
npm run prisma:studio

# Navigate to User table
# Find your user and change role to "ADMIN"
```

### 5. Login as Admin

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePass123"
  }'
```

### 6. Create a Unit (Admin Only)

```bash
curl -X POST http://localhost:3000/api/units \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "unitNumber": "A-101",
    "buildingName": "Tower A",
    "floor": 1,
    "area": 120.5,
    "bedrooms": 2,
    "bathrooms": 2,
    "description": "Spacious 2BR apartment",
    "status": "available"
  }'
```

### 7. List Units (Paginated)

```bash
curl -X GET "http://localhost:3000/api/units?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Common Operations

### View Database

```bash
npm run prisma:studio
```

Opens a web interface at `http://localhost:5555`

### Check Logs

Development mode shows detailed logs with Pino Pretty formatting.

### Reset Database

```bash
npx prisma migrate reset
```

**Warning**: Deletes all data!

## Next Steps

1. Read `README_PRODUCTION.md` for full API documentation
2. Check `STRUCTURE.md` for architecture details
3. Review `prisma/schema.prisma` for data models
4. Explore `src/modules/` for business logic

## Troubleshooting

### "Email not found in authorized clients"

Add the email to `external_clients` table via Prisma Studio or seed file.

### JWT Token Expired

Login again to get a new token.

### Port 3000 Already in Use

Change `PORT` in `.env` file.

### Database Connection Error

Check `DATABASE_URL` is correct and PostgreSQL is running.

## Development Tools

```bash
# Auto-reload on file changes
npm run dev

# Build TypeScript
npm run build

# Run built version
npm start

# Database GUI
npm run prisma:studio

# Generate Prisma Client (after schema changes)
npm run prisma:generate

# Create migration (after schema changes)
npm run prisma:migrate
```

Happy coding! 🚀
