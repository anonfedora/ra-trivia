import { beforeAll, afterAll, afterEach } from 'vitest';
import { prisma } from 'database';

// Setup test environment
beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
  console.log('✅ Test database connected');
});

// Cleanup after each test
afterEach(async () => {
  // Clean up test data if needed
  // Be careful not to delete production data!
  if (process.env.NODE_ENV !== 'test') {
    console.warn('⚠️  Warning: Not running in test environment!');
  }
});

// Cleanup after all tests
afterAll(async () => {
  await prisma.$disconnect();
  console.log('✅ Test database disconnected');
});
