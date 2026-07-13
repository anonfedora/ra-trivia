import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

const prisma = new PrismaClient();

export async function runMigrations() {
  try {
    console.log('Checking for pending migrations...');
    
    // Run prisma migrate deploy
    const schemaPath = path.join(__dirname, '../../../packages/database/prisma/schema.prisma');
    execSync(`npx prisma migrate deploy --schema=${schemaPath}`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../../..')
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
