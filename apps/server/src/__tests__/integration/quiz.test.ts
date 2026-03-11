import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import quizRoutes from '../../routes/quiz';
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
app.use('/api/quiz', quizRoutes);

describe('Quiz API', () => {
  let authToken: string;
  let userId: string;
  let quizId: string;

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

    // Also clean up any test quizzes - delete questions first due to foreign key constraints
    await prisma.question.deleteMany({
      where: {
        quiz: {
          title: {
            contains: 'Test Quiz'
          }
        }
      }
    });

    await prisma.quiz.deleteMany({
      where: {
        title: {
          contains: 'Test Quiz'
        }
      }
    });

    // Create test user and get auth token
    const testUser = {
      name: 'Quiz Test User',
      email: `quiz-test-${Date.now()}@example.com`,
      password: 'TestP@ss123',
      church: 'Test Church',
      association: 'Test Association',
      userType: 'AMBASSADOR_RANK_EXAMS'
    };

    await request(app)
      .post('/api/auth/register')
      .send(testUser);

    const user = await prisma.user.findUnique({
      where: { email: testUser.email }
    });

    if (user?.emailOtpHash) {
      const verifyResponse = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: testUser.email,
          otp: '123456'
        });

      authToken = verifyResponse.body.token;
      userId = user.id;
    }

    // Create test quiz
    const quiz = await prisma.quiz.create({
      data: {
        title: 'Test Quiz',
        duration: 60,
        retakeLimit: 2,
        isActive: true,
        questions: {
          create: [
            {
              text: 'Test Question 1',
              optionA: 'Option A',
              optionB: 'Option B',
              optionC: 'Option C',
              optionD: 'Option D',
              correctOption: 'A',
              questionType: 'AMBASSADOR_RANK_EXAMS'
            },
            {
              text: 'Test Question 2',
              optionA: 'Option A',
              optionB: 'Option B',
              optionC: 'Option C',
              optionD: 'Option D',
              correctOption: 'B',
              questionType: 'AMBASSADOR_RANK_EXAMS'
            }
          ]
        }
      }
    });

    quizId = quiz.id;
  });

  describe('POST /api/quiz/start', () => {
    it('should start a quiz session successfully', async () => {
      const response = await request(app)
        .post('/api/quiz/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quizId })
        .expect(201);

      expect(response.body).toHaveProperty('session');
      expect(response.body).toHaveProperty('quiz');
      expect(response.body.session.userId).toBe(userId);
      expect(response.body.session.quizId).toBe(quizId);
      expect(response.body.quiz.questions).toHaveLength(2);
    });

    it('should return existing active session if one exists', async () => {
      // Start first session
      const firstResponse = await request(app)
        .post('/api/quiz/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quizId });

      const firstSessionId = firstResponse.body.session.id;

      // Try to start another session
      const secondResponse = await request(app)
        .post('/api/quiz/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quizId })
        .expect(201);

      expect(secondResponse.body.session.id).toBe(firstSessionId);
    });

    it('should reject quiz start without authentication', async () => {
      await request(app)
        .post('/api/quiz/start')
        .send({ quizId })
        .expect(401);
    });

    it('should reject quiz start for non-existent quiz', async () => {
      await request(app)
        .post('/api/quiz/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quizId: 'non-existent-id' })
        .expect(404);
    });
  });

  describe('POST /api/quiz/update-answer', () => {
    let sessionId: string;
    let questionId: string;

    beforeAll(async () => {
      // Start a quiz session
      const response = await request(app)
        .post('/api/quiz/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quizId });

      sessionId = response.body.session.id;
      questionId = response.body.quiz.questions[0].id;
    });

    it('should update answer successfully', async () => {
      const response = await request(app)
        .post('/api/quiz/update-answer')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          sessionId,
          questionId,
          selectedOption: 'A'
        })
        .expect(200);

      expect(response.body).toHaveProperty('answers');
      expect(response.body.answers[questionId]).toBe('A');
    });

    it('should reject answer update without authentication', async () => {
      await request(app)
        .post('/api/quiz/update-answer')
        .send({
          sessionId,
          questionId,
          selectedOption: 'A'
        })
        .expect(401);
    });
  });

  describe('POST /api/quiz/submit', () => {
    let sessionId: string;

    beforeAll(async () => {
      // Start a new quiz session for submission test
      const response = await request(app)
        .post('/api/quiz/start')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quizId });

      sessionId = response.body.session.id;

      // Answer all questions
      const questions = response.body.quiz.questions;
      for (const question of questions) {
        await request(app)
          .post('/api/quiz/update-answer')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            sessionId,
            questionId: question.id,
            selectedOption: question.correctOption
          });
      }
    });

    it('should submit quiz successfully', async () => {
      const response = await request(app)
        .post('/api/quiz/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sessionId })
        .expect(200);

      expect(response.body).toHaveProperty('endTime');
      expect(response.body).toHaveProperty('score');
      expect(response.body).toHaveProperty('resultReleasesAt');
      expect(response.body.score).toBeGreaterThan(0);
    });

    it('should reject submission of already submitted quiz', async () => {
      await request(app)
        .post('/api/quiz/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ sessionId })
        .expect(400);
    });

    it('should reject submission without authentication', async () => {
      await request(app)
        .post('/api/quiz/submit')
        .send({ sessionId })
        .expect(401);
    });
  });

  describe('GET /api/quiz/my-sessions', () => {
    it('should get user sessions successfully', async () => {
      const response = await request(app)
        .get('/api/quiz/my-sessions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('quiz');
      expect(response.body[0]).toHaveProperty('startTime');
    });

    it('should reject request without authentication', async () => {
      await request(app)
        .get('/api/quiz/my-sessions')
        .expect(401);
    });
  });

  afterAll(async () => {
    // Clean up test data - delete in correct order to avoid foreign key constraints
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

    // Delete questions first due to foreign key constraints
    await prisma.question.deleteMany({
      where: {
        quiz: {
          title: {
            contains: 'Test Quiz'
          }
        }
      }
    });

    await prisma.quiz.deleteMany({
      where: {
        title: {
          contains: 'Test Quiz'
        }
      }
    });
  });
});
