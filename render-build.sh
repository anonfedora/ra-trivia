#!/bin/bash

# Install dependencies
pnpm install

# Generate Prisma client
cd packages/database && npx prisma generate && cd ../..

# Build the server
cd apps/server && pnpm run build

# Run database migrations (this creates tables if they don't exist)
pnpm run migrate

echo "Build completed successfully!"
