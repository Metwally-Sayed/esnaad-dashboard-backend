# Esnaad Dashboard Backend

A Node.js/Express backend application with PostgreSQL and Prisma ORM for the Esnaad Dashboard.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js v5.x
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Module System**: CommonJS

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Copy the example environment file and update with your credentials:

```bash
cp .env.example .env
```

Edit `.env` and update the following:
- `DATABASE_URL`: Your PostgreSQL connection string
- `PORT`: Server port (default: 3000)
- `JWT_SECRET`: Secret key for JWT tokens

### 3. Set Up PostgreSQL Database

Make sure PostgreSQL is running and create a database:

```bash
createdb esnaad_dashboard
```

Or using psql:
```sql
CREATE DATABASE esnaad_dashboard;
```

### 4. Run Prisma Migrations

Generate Prisma Client and create database tables:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 5. Start the Server

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

The server will start on `http://localhost:3000`

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start development server with nodemon
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## API Endpoints

### Health Check
- `GET /health` - Server and database health status

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Dashboards
- `GET /api/dashboards` - Get all dashboards
- `GET /api/dashboards/:id` - Get dashboard by ID
- `POST /api/dashboards` - Create new dashboard
- `PUT /api/dashboards/:id` - Update dashboard
- `DELETE /api/dashboards/:id` - Delete dashboard

### Analytics
- `GET /api/analytics` - Get analytics events
- `GET /api/analytics/summary` - Get analytics summary
- `POST /api/analytics` - Track new analytics event

## Project Structure

```
esnaad-dashboard-backend/
├── config/
│   └── database.js       # Prisma client configuration
├── middleware/
│   └── errorHandler.js   # Global error handling
├── routes/
│   ├── users.js          # User routes
│   ├── dashboards.js     # Dashboard routes
│   └── analytics.js      # Analytics routes
├── prisma/
│   └── schema.prisma     # Database schema
├── .env                  # Environment variables (not in git)
├── .env.example          # Example environment variables
├── .clauderc             # MCP server configuration
├── index.js              # Application entry point
└── package.json          # Dependencies and scripts
```

## Database Models

### User
- id, email, name, password, role, createdAt, updatedAt

### Dashboard
- id, title, description, userId, isPublic, createdAt, updatedAt

### Analytics
- id, event, data (JSON), timestamp

## MCP Server Configuration

This project includes Model Context Protocol (MCP) servers for enhanced development:

- **PostgreSQL MCP**: Direct database access and queries
- **Filesystem MCP**: File system operations

MCP configuration is in `.clauderc`

## Development with Prisma

### Prisma Studio
Open a visual database editor:
```bash
npm run prisma:studio
```

### Update Database Schema
1. Edit `prisma/schema.prisma`
2. Run migration:
```bash
npm run prisma:migrate
```

### Reset Database
```bash
npx prisma migrate reset
```

## Security Notes

- **Never commit `.env` file** - It contains sensitive credentials
- **Change JWT_SECRET** in production to a strong random value
- **Hash passwords** - The current implementation stores passwords in plain text (add bcrypt for production)
- **Enable authentication** - Add JWT middleware for protected routes
- **Validate inputs** - Add validation libraries like joi or express-validator

## Next Steps

- [ ] Add password hashing with bcrypt
- [ ] Implement JWT authentication
- [ ] Add input validation middleware
- [ ] Add rate limiting
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add tests (Jest/Mocha)
- [ ] Add logging (Winston/Morgan)
- [ ] Add CORS configuration
- [ ] Deploy to production

## License

ISC
