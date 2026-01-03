# Quick Setup Guide

Follow these steps to get your Esnaad Dashboard Backend up and running:

## Step 1: Install PostgreSQL

### macOS
```bash
brew install postgresql@14
brew services start postgresql@14
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Windows
Download and install from: https://www.postgresql.org/download/windows/

## Step 2: Create Database

```bash
# Access PostgreSQL
psql postgres

# Create database
CREATE DATABASE esnaad_dashboard;

# Create user (optional)
CREATE USER esnaad_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE esnaad_dashboard TO esnaad_user;

# Exit psql
\q
```

## Step 3: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your database credentials
# Update DATABASE_URL with your actual credentials
```

## Step 4: Install Dependencies

```bash
npm install
```

## Step 5: Run Database Migrations

```bash
# Generate Prisma Client
npm run prisma:generate

# Create database tables
npm run prisma:migrate

# When prompted, enter migration name: "init"
```

## Step 6: Start Development Server

```bash
npm run dev
```

The server should now be running at `http://localhost:3000`

## Step 7: Test the API

Open your browser or use curl:

```bash
# Health check
curl http://localhost:3000/health

# Create a test user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","password":"password123"}'

# Get all users
curl http://localhost:3000/api/users
```

## Troubleshooting

### Database Connection Error
- Check if PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in `.env` is correct
- Ensure database exists: `psql -l`

### Port Already in Use
- Change PORT in `.env` to a different value (e.g., 3001)

### Prisma Client Not Generated
```bash
npm run prisma:generate
```

### Migration Failed
```bash
# Reset database and migrations
npx prisma migrate reset

# Run migrations again
npm run prisma:migrate
```

## Using Prisma Studio

View and edit your database in a web interface:

```bash
npm run prisma:studio
```

Opens at `http://localhost:5555`

## MCP Servers (For Claude Code)

To enable MCP servers for enhanced development with Claude Code:

1. Make sure `.clauderc` exists in project root
2. Update the PostgreSQL connection string in `.clauderc` if needed
3. Restart Claude Code

The MCP servers will provide:
- Direct database queries and operations
- File system operations
- Enhanced code assistance

## Next Steps

- Review the README.md for full documentation
- Check the API endpoints
- Add authentication (JWT)
- Implement business logic
- Add tests

Happy coding! 🚀
