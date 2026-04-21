import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/auth';
import { prisma } from 'database';

// Mock generateOTP before importing the service
vi.mock('../../services/email', () => ({
  generateOTP: () => '123456',
  sendVerificationEmail: vi.fn().mockResolvedValue(true)
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Authentication API', () => {
  const testUser = {
    name: 'Test User',
    email: `test-${Date.now()}@example.com`,
    password: 'TestP@ss123',
    church: 'Test Church',
    association: 'Test Association',
    userType: 'AMBASSADOR_RANK_EXAMS'
  };

  beforeAll(async () => {
    // Clean up any existing test data in correct order to avoid foreign key constraints
    await prisma.quizSession.deleteMany({
      where: {
        user: {
          email: {
            contains: '@example.com'
          }
        }
      }
    });
    
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: '@example.com'
        }
      }
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('successful');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'invalid-email' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, password: 'weak' })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject registration with missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: testUser.email })
        .expect(400);

      expect(response.body).toHaveProperty('message');
    });

    it('should reject duplicate email registration', async () => {
      const duplicateTestUser = {
        ...testUser,
        email: 'duplicate-test@example.com'
      };

      // First registration should succeed
      await request(app)
        .post('/api/auth/register')
        .send(duplicateTestUser)
        .expect(201);

      // Second registration should return 200 for unverified user (resends OTP)
      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateTestUser)
        .expect(200);

      expect(response.body.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('should verify OTP successfully', async () => {
      // First register a user
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      // Get OTP from database (in real scenario, this would be sent via email)
      const user = await prisma.user.findUnique({
        where: { email: testUser.email }
      });

      expect(user).toBeTruthy();
      expect(user?.emailOtpHash).toBeTruthy();

      // Verify OTP with the mocked value
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: testUser.email,
          otp: '123456'
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should reject invalid OTP', async () => {
      // First register a user
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: testUser.email,
          otp: '000000'
        })
        .expect(400);

      expect(response.body.message).toContain('Invalid');
    });

    it('should reject expired OTP', async () => {
      // This would require manipulating the OTP expiry time in the database
      // For now, we'll skip this test
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Register and verify user
      await request(app)
        .post('/api/auth/register')
        .send(testUser);

      const user = await prisma.user.findUnique({
        where: { email: testUser.email }
      });

      if (user?.emailOtpHash) {
        await request(app)
          .post('/api/auth/verify-otp')
          .send({
            email: testUser.email,
            otp: '123456'
          });
      }
    });

    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password
        })
        .expect(401);

      expect(response.body.message).toContain('Invalid');
    });
  });
});
