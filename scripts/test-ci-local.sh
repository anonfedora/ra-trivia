#!/bin/bash

# Local CI Test Script
# This script simulates the CI pipeline locally

set -e  # Exit on error

echo "🚀 Starting Local CI Pipeline Test"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILED_JOBS=()

# Function to run a job and track results
run_job() {
    local job_name=$1
    local command=$2
    
    echo -e "${YELLOW}▶ Running: $job_name${NC}"
    if eval "$command"; then
        echo -e "${GREEN}✅ $job_name: PASSED${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}❌ $job_name: FAILED${NC}"
        echo ""
        FAILED_JOBS+=("$job_name")
        return 1
    fi
}

# Job 1: Setup & Install Dependencies
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Job 1: Setup & Cache Dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_job "Install Dependencies" "pnpm install --frozen-lockfile" || true

# Job 2: Lint
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Job 2: Lint & Format Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if pnpm --filter web lint 2>&1 | grep -q "Error:"; then
    echo -e "${RED}❌ Lint Web App: FAILED (has errors)${NC}"
    FAILED_JOBS+=("Lint Web App")
elif pnpm --filter web lint 2>&1 | grep -q "Warning:"; then
    echo -e "${YELLOW}⚠️  Lint Web App: PASSED (with warnings)${NC}"
else
    echo -e "${GREEN}✅ Lint Web App: PASSED${NC}"
fi
echo ""

# Job 3: Type Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Job 3: TypeScript Type Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_job "Generate Prisma Client" "pnpm --filter database exec prisma generate" || true
run_job "Type Check Server" "pnpm --filter server exec tsc --noEmit" || true
run_job "Type Check Web" "pnpm --filter web exec tsc --noEmit" || true

# Job 4: Build Server (CI version - no database push)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Job 4: Build Server (CI Mode)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
export DATABASE_URL="postgresql://test:test@localhost:5432/test"
export JWT_SECRET="test_secret_key_for_ci_build_only_minimum_32_chars"
export RESEND_API_KEY="test_key"
run_job "Build Server (CI)" "pnpm --filter server build:ci" || true

# Job 5: Build Web App
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Job 5: Build Web App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
export NEXT_PUBLIC_API_URL="http://localhost:4000/api"
run_job "Build Web App" "pnpm --filter web build" || true

# Job 6: Security Audit
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Job 6: Security Audit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}ℹ️  Running security audit (informational only)${NC}"
if pnpm audit --audit-level high > /dev/null 2>&1; then
    echo -e "${GREEN}✅ No high/critical vulnerabilities found${NC}"
else
    echo -e "${YELLOW}⚠️  Security vulnerabilities found - review recommended${NC}"
    echo "   Run 'pnpm audit' for details"
fi
echo ""

# Job 7: Database Validation (requires PostgreSQL)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Job 7: Database Schema Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}⚠️  Skipping database validation (requires PostgreSQL)${NC}"
echo "To test database validation, ensure PostgreSQL is running and run:"
echo "  DATABASE_URL=postgresql://test:test@localhost:5432/test pnpm --filter database exec prisma migrate deploy"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "CI Pipeline Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#FAILED_JOBS[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All CI checks passed successfully!${NC}"
    echo ""
    echo "Your code is ready to be pushed to GitHub!"
    exit 0
else
    echo -e "${RED}❌ Some CI checks failed:${NC}"
    for job in "${FAILED_JOBS[@]}"; do
        echo -e "${RED}  - $job${NC}"
    done
    echo ""
    echo "Please fix the issues before pushing to GitHub."
    exit 1
fi
