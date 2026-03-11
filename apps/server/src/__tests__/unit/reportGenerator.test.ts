import { describe, it, expect, vi } from 'vitest';
import { ReportGenerator } from '../../services/reportGenerator';

// Mock prisma
vi.mock('database', () => ({
  prisma: {
    quizSession: {
      findMany: vi.fn()
    }
  },
  UserType: {
    AMBASSADOR_RANK_EXAMS: 'AMBASSADOR_RANK_EXAMS',
    EXTRAORDINARY_RANK_EXAMS: 'EXTRAORDINARY_RANK_EXAMS',
    PRE_PLENIPOTENTIARY_EXAMS: 'PRE_PLENIPOTENTIARY_EXAMS',
    PLENIPOTENTIARY_RANK_EXAMS: 'PLENIPOTENTIARY_RANK_EXAMS'
  }
}));

describe('ReportGenerator', () => {
  describe('calculateSummary', () => {
    it('should calculate summary correctly for completed results', () => {
      const mockResults = [
        {
          id: '1',
          user: { name: 'User 1', email: 'user1@test.com', church: 'Church 1', association: 'Assoc 1', userType: 'AMBASSADOR_RANK_EXAMS' as any },
          quiz: { title: 'Quiz 1' },
          score: 80,
          startTime: new Date(),
          endTime: new Date()
        },
        {
          id: '2',
          user: { name: 'User 2', email: 'user2@test.com', church: 'Church 2', association: 'Assoc 2', userType: 'AMBASSADOR_RANK_EXAMS' as any },
          quiz: { title: 'Quiz 1' },
          score: 60,
          startTime: new Date(),
          endTime: new Date()
        },
        {
          id: '3',
          user: { name: 'User 3', email: 'user3@test.com', church: 'Church 3', association: 'Assoc 3', userType: 'AMBASSADOR_RANK_EXAMS' as any },
          quiz: { title: 'Quiz 1' },
          score: 40,
          startTime: new Date(),
          endTime: new Date()
        }
      ];

      const summary = ReportGenerator.calculateSummary(mockResults);

      expect(summary.totalCandidates).toBe(3);
      expect(summary.passCount).toBe(2); // 80% and 60% pass (>= 50%)
      expect(summary.failCount).toBe(1); // 40% fails
      expect(summary.averageScore).toBe(60); // (80 + 60 + 40) / 3
      expect(summary.highestScore).toBe(80);
      expect(summary.lowestScore).toBe(40);
    });

    it('should handle empty results', () => {
      const summary = ReportGenerator.calculateSummary([]);

      expect(summary.totalCandidates).toBe(0);
      expect(summary.passCount).toBe(0);
      expect(summary.failCount).toBe(0);
      expect(summary.averageScore).toBe(0);
      expect(summary.highestScore).toBe(0);
      expect(summary.lowestScore).toBe(0);
    });

    it('should handle results with null scores', () => {
      const mockResults = [
        {
          id: '1',
          user: { name: 'User 1', email: 'user1@test.com', church: 'Church 1', association: 'Assoc 1', userType: 'AMBASSADOR_RANK_EXAMS' as any },
          quiz: { title: 'Quiz 1' },
          score: 80,
          startTime: new Date(),
          endTime: new Date()
        },
        {
          id: '2',
          user: { name: 'User 2', email: 'user2@test.com', church: 'Church 2', association: 'Assoc 2', userType: 'AMBASSADOR_RANK_EXAMS' as any },
          quiz: { title: 'Quiz 1' },
          score: null,
          startTime: new Date(),
          endTime: null
        }
      ];

      const summary = ReportGenerator.calculateSummary(mockResults);

      expect(summary.totalCandidates).toBe(2);
      expect(summary.passCount).toBe(1);
      expect(summary.noRecordCount).toBe(1);
      expect(summary.averageScore).toBe(80); // Only counts completed
    });

    it('should correctly identify pass/fail threshold at 50%', () => {
      const mockResults = [
        {
          id: '1',
          user: { name: 'User 1', email: 'user1@test.com', church: 'Church 1', association: 'Assoc 1', userType: 'AMBASSADOR_RANK_EXAMS' as any },
          quiz: { title: 'Quiz 1' },
          score: 50,
          startTime: new Date(),
          endTime: new Date()
        },
        {
          id: '2',
          user: { name: 'User 2', email: 'user2@test.com', church: 'Church 2', association: 'Assoc 2', userType: 'AMBASSADOR_RANK_EXAMS' as any },
          quiz: { title: 'Quiz 1' },
          score: 49,
          startTime: new Date(),
          endTime: new Date()
        }
      ];

      const summary = ReportGenerator.calculateSummary(mockResults);

      expect(summary.passCount).toBe(1); // 50% passes
      expect(summary.failCount).toBe(1); // 49% fails
    });
  });
});
