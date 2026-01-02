#!/bin/bash

# =====================================================
# Bron Vault - Docker Start Script with Summary
# =====================================================
# Wrapper script for docker-compose up with summary
# =====================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check for docker-compose or docker compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    echo -e "${RED}❌ [ERROR] docker-compose not found!${NC}"
    echo ""
    echo "Make sure Docker is installed and running."
    echo ""
    echo "For Docker Desktop:"
    echo "  Download from: https://www.docker.com/products/docker-desktop"
    echo ""
    echo "For Linux (standalone):"
    echo "  Install docker-compose or docker-compose-plugin."
    echo ""
    exit 1
fi

echo -e "${CYAN}🚀 Starting Bron Vault Services...${NC}"
echo -e "${BLUE}ℹ️  Using: ${DOCKER_COMPOSE_CMD}${NC}"
echo ""

# Check if containers already exist
if $DOCKER_COMPOSE_CMD ps -q | grep -q .; then
    # Containers exist, just start them (no build needed)
    echo -e "${BLUE}ℹ️  Containers already exist, starting without rebuild...${NC}"
    $DOCKER_COMPOSE_CMD up -d
else
    # First time setup, need to build
    echo -e "${BLUE}ℹ️  First time setup, building images...${NC}"
    $DOCKER_COMPOSE_CMD up -d --build
fi

echo ""
echo -e "${GREEN}✅ All services started!${NC}"
echo ""

# Wait a bit to ensure all services are ready
sleep 3

# Display status and URLs
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 Bron Vault Service Status${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
$DOCKER_COMPOSE_CMD ps
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📍 Access URLs:${NC}"
echo ""
echo -e "  🌐 ${YELLOW}Bron Vault App:${NC}      http://localhost:3000"
echo -e "  🗄️  ${YELLOW}SingleStore Studio:${NC}  http://localhost:8080"
echo -e "  🗄️  ${YELLOW}SingleStore (SQL):${NC}   localhost:3306"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🔐 Default Login Credentials:${NC}"
echo ""
echo -e "  ${YELLOW}Email:${NC}    admin@bronvault.local"
echo -e "  ${YELLOW}Password:${NC} admin"
echo ""
echo -e "  ${BLUE}ℹ️  Please change the password after first login for security.${NC}"
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
