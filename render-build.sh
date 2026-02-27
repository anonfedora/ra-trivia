#!/bin/bash

# Install dependencies
pnpm install

# Build server (includes Prisma generation and migration)
cd apps/server && pnpm run build

echo "Build completed successfully!"
