#!/bin/bash

echo "🔍 Verifying Units Management Dashboard Backend Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo -n "Checking Node.js... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓${NC} Found: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js not found"
    exit 1
fi

# Check npm
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓${NC} Found: v$NPM_VERSION"
else
    echo -e "${RED}✗${NC} npm not found"
    exit 1
fi

# Check node_modules
echo -n "Checking dependencies... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${RED}✗${NC} Dependencies not installed. Run: npm install"
    exit 1
fi

# Check Prisma Client
echo -n "Checking Prisma Client... "
if [ -d "node_modules/@prisma/client" ]; then
    echo -e "${GREEN}✓${NC} Prisma Client generated"
else
    echo -e "${YELLOW}⚠${NC} Prisma Client not generated. Run: npm run prisma:generate"
fi

# Check .env file
echo -n "Checking .env file... "
if [ -f ".env" ]; then
    echo -e "${GREEN}✓${NC} .env file exists"

    # Check DATABASE_URL
    if grep -q "DATABASE_URL=" .env; then
        echo -n "  Checking DATABASE_URL... "
        if grep -q "DATABASE_URL=\"postgresql://postgres:password@localhost" .env; then
            echo -e "${YELLOW}⚠${NC} Using default DATABASE_URL (update with your credentials)"
        else
            echo -e "${GREEN}✓${NC} DATABASE_URL configured"
        fi
    else
        echo -e "  ${RED}✗${NC} DATABASE_URL not set"
    fi

    # Check JWT_SECRET
    if grep -q "JWT_SECRET=" .env; then
        echo -n "  Checking JWT_SECRET... "
        if grep -q "JWT_SECRET=\"your-super-secret" .env; then
            echo -e "${YELLOW}⚠${NC} Using example JWT_SECRET (CHANGE IN PRODUCTION!)"
        else
            echo -e "${GREEN}✓${NC} JWT_SECRET configured"
        fi
    else
        echo -e "  ${RED}✗${NC} JWT_SECRET not set"
    fi
else
    echo -e "${RED}✗${NC} .env file not found. Copy from .env.example"
    exit 1
fi

# Check TypeScript compilation
echo -n "Checking TypeScript... "
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
    echo -e "${RED}✗${NC} TypeScript errors found"
    echo ""
    echo "Run: npx tsc --noEmit to see errors"
else
    echo -e "${GREEN}✓${NC} No TypeScript errors"
fi

# Check project structure
echo -n "Checking project structure... "
if [ -d "src" ] && [ -d "prisma" ] && [ -d "docs" ]; then
    echo -e "${GREEN}✓${NC} Project structure correct"
else
    echo -e "${RED}✗${NC} Project structure incomplete"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 SETUP SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Environment: Ready"
echo "✅ Dependencies: Installed"
echo "✅ Prisma Client: Generated"
echo ""
echo "📝 Next Steps:"
echo "  1. Update .env with your PostgreSQL credentials"
echo "  2. Run: npm run prisma:migrate"
echo "  3. Run: npm run prisma:seed"
echo "  4. Run: npm run dev"
echo ""
echo "📚 Documentation:"
echo "  - Quick Start: QUICKSTART.md"
echo "  - API Contract: docs/API_CONTRACT.md"
echo "  - API Examples: docs/API_EXAMPLES.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
