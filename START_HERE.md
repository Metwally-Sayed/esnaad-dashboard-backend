# 👋 Welcome to Units Management Dashboard Backend

## 📚 Documentation Index

### Main Documentation (Root)

1️⃣ **README.md** 📋 - Complete API documentation, getting started guide

2️⃣ **QUICKSTART.md** 🚀 - 5-minute setup guide, first API calls

3️⃣ **FINAL_SUMMARY.md** ⭐ - Complete overview, features, stats

### Additional Documentation (./docs/)

4️⃣ **docs/API_CONTRACT.md** 📜 - **Complete API specification** (Prisma models, endpoints, RBAC, errors)

5️⃣ **docs/API_EXAMPLES.md** 📖 - All 23 endpoints with curl examples

6️⃣ **docs/STRUCTURE.md** 🏗️ - Folder structure & architecture

7️⃣ **docs/PROJECT_SUMMARY.md** 📊 - Technical details & breakdown

8️⃣ **docs/SETUP.md** - Database setup (legacy)

9️⃣ **docs/MCP_SERVERS.md** - MCP configuration

---

## ⚡ Super Quick Start

```bash
# 1. Install
npm install

# 2. Setup .env
# Update DATABASE_URL and JWT secrets in .env

# 3. Database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# 4. Start
npm run dev

# 5. Test
curl http://localhost:3000/health
```

---

## 🎯 Key Features

✅ **TypeScript** - Full type safety
✅ **Authentication** - JWT + OTP verification
✅ **RBAC** - Admin and Owner roles
✅ **Pagination** - Server-side on all lists
✅ **Audit Logs** - Track all admin actions
✅ **Clean Architecture** - Easy to maintain
✅ **Production Ready** - Deploy immediately

---

## 📂 Project Structure

```
├── src/
│   ├── app.ts                  # Express app
│   ├── server.ts               # Server bootstrap
│   ├── config/                 # Environment, DB, Logger
│   ├── common/                 # Middleware, Errors, Utils
│   └── modules/                # Auth, Users, Units, Exports, Audit
├── prisma/
│   ├── schema.prisma           # Database models
│   └── seed.ts                 # Seed data
├── .env                        # Environment variables
└── Documentation files (you're here!)
```

---

## 🔗 API Endpoints

**Base URL**: `http://localhost:3000`

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Users (Admin only)
- `GET /api/users` - List users (paginated)
- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Units
- `GET /api/units` - List units (paginated, filtered)
- `POST /api/units` - Create unit (admin)
- `PUT /api/units/:id` - Update unit (admin)
- `POST /api/units/:id/assign` - Assign owner (admin)
- `DELETE /api/units/:id` - Delete unit (admin)

### Exports
- `GET /api/exports/units/:id/pdf` - Export to PDF
- `GET /api/exports/units/:id/docx` - Export to DOCX

### Audit Logs (Admin only)
- `GET /api/audit-logs` - List audit logs

See **API_EXAMPLES.md** for complete list with examples.

---

## 🛠️ Development Commands

```bash
npm run dev              # Start dev server (hot reload)
npm run build            # Build for production
npm start                # Run production build

npm run prisma:studio    # Open database GUI
npm run prisma:migrate   # Run migrations
npm run prisma:seed      # Seed database
```

---

## 🗄️ Database Models

- **User** - Authentication, roles (ADMIN/OWNER)
- **Unit** - Property units with owner
- **Otp** - Email verification codes
- **AuditLog** - Track all changes
- **ExternalClient** - Registration whitelist

---

## 🔐 Default Credentials

After running `npm run prisma:seed`:

**Email**: `admin@example.com`
**Password**: `Admin123!`
**Role**: ADMIN (already verified)

---

## 🎨 Technology Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon.tech)
- **ORM**: Prisma
- **Validation**: Zod
- **Logging**: Pino
- **Security**: Helmet, CORS, Rate Limiting
- **Auth**: JWT + bcrypt

---

## 🚀 Deployment

Ready to deploy to:
- ✅ Neon.tech (Database)
- ✅ Railway
- ✅ Render
- ✅ Fly.io
- ✅ Any Node.js hosting

See **README_PRODUCTION.md** for deployment guide.

---

## ❓ Need Help?

1. **Setup Issues** → Read **QUICKSTART.md**
2. **API Questions** → Check **API_EXAMPLES.md**
3. **Architecture** → See **STRUCTURE.md**
4. **Deployment** → Review **README_PRODUCTION.md**

---

## 📞 Support

For questions or issues:
1. Check documentation files
2. Review server logs
3. Use Prisma Studio to inspect data

---

## ✅ Next Steps

1. ✅ Read **FINAL_SUMMARY.md**
2. ✅ Follow **QUICKSTART.md**
3. ✅ Test APIs using **API_EXAMPLES.md**
4. ✅ Start building!

---

**Ready to build something amazing!** 🎉

*Start with FINAL_SUMMARY.md for the complete overview.*
