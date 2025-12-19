#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Broń Vault - Setup & Initialization${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Check for required tools
echo -e "\n${YELLOW}🔍 Checking environment...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed.${NC}"
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed. Installing...${NC}"
    npm install -g pnpm
fi

# Install dependencies
echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
pnpm install

echo -e "\n${YELLOW}📦 Installing scanner dependencies...${NC}"
cd scanner && pnpm install && cd ..

# Setup .env
echo -e "\n${YELLOW}⚙️  Configuring environment variables...${NC}"
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env from .env.example${NC}"
        echo -e "${YELLOW}⚠️  Please update .env with your actual configuration!${NC}"
    else
        echo -e "${RED}❌ .env.example not found!${NC}"
    fi
else
    echo -e "${GREEN}✅ .env already exists${NC}"
fi

# Database Initialization
echo -e "\n${YELLOW}🗄️  Initializing database...${NC}"

# Check if we should run DB setup
read -p "Do you want to initialize/reset the database schema? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Create a temporary script to run the SQL
    echo -e "${BLUE}running database initialization...${NC}"

    # Run the schema initialization using the centralized DB logic
    npx tsx scripts/init-db.ts
else
    echo -e "${BLUE}Skipping database initialization.${NC}"
fi

# Data Migration (Dates)
echo -e "\n${YELLOW}📅 Checking for data migrations...${NC}"
read -p "Do you want to run data normalization (date fixes)? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx tsx scripts/migrate-fix-and-normalize-dates.ts
else
    echo -e "${BLUE}Skipping data normalization.${NC}"
fi

echo -e "\n${GREEN}✅ Setup complete!${NC}"
echo -e "${BLUE}To start the development server: ${YELLOW}pnpm dev${NC}"
echo -e "${BLUE}To start the scanner: ${YELLOW}cd scanner && pnpm start${NC}"
