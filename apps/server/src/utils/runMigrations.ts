import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

const prisma = new PrismaClient();

export async function runMigrations() {
  try {
    console.log('Checking for pending migrations...');
    
    // Get the root directory (go up from apps/server to root)
    const rootDir = path.resolve(process.cwd(), '../..');
    const schemaPath = process.env.PRISMA_SCHEMA_PATH || 
      path.resolve(rootDir, 'packages/database/prisma/schema.prisma');
    
    // Verify schema file exists
    const fs = await import('fs');
    if (!fs.existsSync(schemaPath)) {
      console.error('Schema file not found at:', schemaPath);
      return;
    }
    
    console.log('Running migrations with schema:', schemaPath);
    console.log('Working directory:', rootDir);
    
    // Run prisma migrate deploy from root directory
    execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
      stdio: 'inherit',
      cwd: rootDir
    });
    
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Failed to run migrations:', error);
    // Don't throw error - allow server to start even if migrations fail
    // This prevents the server from crashing if migrations are already applied
  }
}

export async function ensureDatabaseSchema() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connection established');
    
    // Run migrations
    await runMigrations();
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Database schema check failed:', error);
    await prisma.$disconnect();
    // Don't throw - allow server to start
  }
}
