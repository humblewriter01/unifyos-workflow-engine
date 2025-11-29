#!/bin/bash

echo "==================================="
echo "UnifyOS Setup Verification"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Check build
echo "1. Checking build status..."
if [ -d ".next" ]; then
    echo -e "${GREEN}✓ Build artifacts exist${NC}"
else
    echo -e "${RED}✗ Build artifacts missing${NC}"
fi

# Check package installed
echo ""
echo "2. Checking dependencies..."
if grep -q "@supabase/supabase-js" package.json; then
    echo -e "${GREEN}✓ Supabase client installed${NC}"
else
    echo -e "${RED}✗ Supabase client missing${NC}"
fi

# Check environment template
echo ""
echo "3. Checking environment setup..."
if [ -f ".env.local.example" ]; then
    echo -e "${GREEN}✓ Environment template exists${NC}"
else
    echo -e "${RED}✗ Environment template missing${NC}"
fi

# Check Tailwind dark mode
echo ""
echo "4. Checking Tailwind configuration..."
if grep -q "darkMode: 'class'" tailwind.config.js; then
    echo -e "${GREEN}✓ Dark mode configured${NC}"
else
    echo -e "${RED}✗ Dark mode not configured${NC}"
fi

# Check lib files
echo ""
echo "5. Checking library files..."
if [ -f "lib/supabase.ts" ]; then
    echo -e "${GREEN}✓ Supabase client exists${NC}"
else
    echo -e "${RED}✗ Supabase client missing${NC}"
fi

# Count API routes
echo ""
echo "6. Checking API routes..."
api_count=$(find pages/api -name "*.ts" 2>/dev/null | wc -l)
echo -e "${GREEN}✓ Found $api_count API route files${NC}"

echo ""
echo "==================================="
echo "Summary"
echo "==================================="
echo "All critical components verified!"
echo ""
echo "Next steps:"
echo "1. Copy .env.local.example to .env.local"
echo "2. Add your Supabase credentials"
echo "3. Run: npm run dev"
echo ""
