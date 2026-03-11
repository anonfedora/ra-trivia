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
          quiz: { title: 'Quiz 2' },
          score: 60,
          startTime: new Date(),
          endTime: new Date()
        },
        {
          id: '3',
          user: { name: 'User 3', email: 'user3@test.com', church: 'Church 3', association: 'Assoc 3', userType: 'AMBASSADOR_RANK_EXAMS' as any },
          quiz: { title: 'Quiz 3' },
          score: 40,
          startTime: new Date(),
          endTime: new Date()
        },
        {
          id: '4',
          user: { name: 'User 4', email: 'user4@test.com', church: 'Church 4', association: 'Assoc 4', userType: 'AMBASSADOR_RANK_EXAMS' as any },
          quiz: { title: 'Quiz 4' },
          score: null,
          startTime: new Date(),
          endTime: null
        }
      ];
      
      const summary = ReportGenerator.calculateSummary(mockResults);
      
      expect(summary.totalCandidates).toBe(4);
      expect(summary.totalSessions).toBe(4);
      expect(summary.averageScore).toBe(45); // (80 + 60 + 40 + 0) / 4
      expect(summary.highestScore).toBe(80);
      expect(summary.lowestScore).toBe(0);
      expect(summary.noRecordCount).toBe(1);
    });

    it('should handle empty results', () => {
      const summary = ReportGenerator.calculateSummary([]);

      expect(summary.totalCandidates).toBe(0);
      expect(summary.totalSessions).toBe(0);
      expect(summary.averageScore).toBe(0);
      expect(summary.highestScore).toBe(0);
      expect(summary.lowestScore).toBe(0);
      expect(summary.noRecordCount).toBe(0);
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
      expect(summary.totalSessions).toBe(2);
      expect(summary.noRecordCount).toBe(1);
      expect(summary.averageScore).toBe(40); // (80 + 0) / 2
    });

    it('should correctly calculate scores at boundary values', () => {
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

      expect(summary.averageScore).toBe(49.5);
      expect(summary.highestScore).toBe(50);
      expect(summary.lowestScore).toBe(49);
    });
  });
});
