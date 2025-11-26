#!/bin/bash

# UnifyOS Production Setup Script
# This script automates the setup process for production deployment

set -e  # Exit on error

echo "🚀 UnifyOS Production Setup"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if .env file exists
if [ ! -f "apps/api/.env" ]; then
    print_warning ".env file not found. Creating from example..."
    cp apps/api/.env.example apps/api/.env
    print_error "Please fill in your .env file with actual values before continuing!"
    exit 1
fi

print_success ".env file found"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi
print_success "Node.js version check passed"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
echo "=============================="

cd apps/api
npm install
print_success "API dependencies installed"

cd ../frontend  
npm install
print_success "Frontend dependencies installed"

cd ../..

# Generate encryption key if not exists
if ! grep -q "ENCRYPTION_KEY=" apps/api/.env; then
    print_warning "Generating encryption key..."
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> apps/api/.env
    print_success "Encryption key generated and added to .env"
fi

# Generate NextAuth secret if not exists
if ! grep -q "NEXTAUTH_SECRET=" apps/api/.env; then
    print_warning "Generating NextAuth secret..."
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET" >> apps/api/.env
    print_success "NextAuth secret generated and added to .env"
fi

# Database setup
echo ""
echo "🗄️  Setting up database..."
echo "=============================="

cd apps/api

# Check if DATABASE_URL is set
if ! grep -q "DATABASE_URL=" .env || grep -q "DATABASE_URL=postgresql://user:password" .env; then
    print_error "DATABASE_URL not properly configured in .env"
    print_warning "Please set your DATABASE_URL before continuing"
    exit 1
fi

# Generate Prisma Client
print_warning "Generating Prisma Client..."
npx prisma generate
print_success "Prisma Client generated"

# Run migrations
print_warning "Running database migrations..."
if npx prisma migrate deploy; then
    print_success "Database migrations completed"
else
    print_error "Database migrations failed"
    print_warning "Try: npx prisma migrate dev --name init"
    exit 1
fi

cd ../..

# Create development user (optional)
echo ""
read -p "Create a development test user? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cd apps/api
    node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDevUser() {
  const user = await prisma.user.create({
    data: {
      id: 'dev-user',
      email: 'dev@unifyos.local',
      name: 'Development User',
      emailVerified: true,
      plan: 'PRO',
    },
  });
  console.log('✓ Dev user created:', user.email);
}

createDevUser().then(() => process.exit(0));
"
    cd ../..
    print_success "Development user created"
fi

# Build frontend
echo ""
echo "🏗️  Building frontend..."
echo "=============================="

cd apps/frontend
if npm run build; then
    print_success "Frontend build completed"
else
    print_error "Frontend build failed"
    exit 1
fi

cd ../..

# Final checks
echo ""
echo "🔍 Running final checks..."
echo "=============================="

# Check required environment variables
REQUIRED_VARS=("DATABASE_URL" "ENCRYPTION_KEY" "NEXTAUTH_URL" "NEXTAUTH_SECRET")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "$var=" apps/api/.env; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

print_success "All required environment variables present"

# Summary
echo ""
echo "🎉 Setup Complete!"
echo "=============================="
echo ""
echo "Next steps:"
echo "1. Configure Slack OAuth (see SLACK_OAUTH_SETUP.md)"
echo "2. Add Slack credentials to .env:"
echo "   - SLACK_CLIENT_ID"
echo "   - SLACK_CLIENT_SECRET"  
echo "   - SLACK_SIGNING_SECRET"
echo "3. Start development server:"
echo "   npm run dev"
echo "4. Deploy to production (see DEPLOYMENT_CHECKLIST.md)"
echo ""
echo "To start development:"
echo "  cd apps/frontend && npm run dev"
echo ""
print_success "UnifyOS is ready! 🚀"
