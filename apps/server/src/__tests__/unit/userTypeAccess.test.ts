import { describe, it, expect } from 'vitest';
import { filterQuestionsByUserType } from '../../middlewares/userTypeAccess';
import { UserType } from 'database';

describe('User Type Access Control', () => {
  const mockQuestions = [
    { id: '1', text: 'Q1', questionType: 'AMBASSADOR_RANK_EXAMS' as UserType, correctOption: 'A', optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1' },
    { id: '2', text: 'Q2', questionType: 'EXTRAORDINARY_RANK_EXAMS' as UserType, correctOption: 'B', optionA: 'A2', optionB: 'B2', optionC: 'C2', optionD: 'D2' },
    { id: '3', text: 'Q3', questionType: 'AMBASSADOR_RANK_EXAMS' as UserType, correctOption: 'C', optionA: 'A3', optionB: 'B3', optionC: 'C3', optionD: 'D3' },
    { id: '4', text: 'Q4', questionType: 'PRE_PLENIPOTENTIARY_RANK_EXAMS' as UserType, correctOption: 'D', optionA: 'A4', optionB: 'B4', optionC: 'C4', optionD: 'D4' },
    { id: '5', text: 'Q5', questionType: null, correctOption: 'A', optionA: 'A5', optionB: 'B5', optionC: 'C5', optionD: 'D5' }
  ];

  describe('filterQuestionsByUserType', () => {
    it('should filter questions for AMBASSADOR_RANK_EXAMS', () => {
      const filtered = filterQuestionsByUserType(mockQuestions, 'AMBASSADOR_RANK_EXAMS');
      expect(filtered).toHaveLength(3); // 2 ambassador + 1 null
      expect(filtered.map(q => q.id)).toEqual(['1', '3', '5']);
    });

    it('should filter questions for EXTRAORDINARY_RANK_EXAMS', () => {
      const filtered = filterQuestionsByUserType(mockQuestions, 'EXTRAORDINARY_RANK_EXAMS');
      expect(filtered).toHaveLength(2); // 1 extraordinary + 1 null
      expect(filtered.map(q => q.id)).toEqual(['2', '5']);
    });

    it('should filter questions for PRE_PLENIPOTENTIARY_RANK_EXAMS', () => {
      const filtered = filterQuestionsByUserType(mockQuestions, 'PRE_PLENIPOTENTIARY_RANK_EXAMS');
      expect(filtered).toHaveLength(2); // 1 pre-plenipotentiary + 1 null
      expect(filtered.map(q => q.id)).toEqual(['4', '5']);
    });

    it('should include questions with null questionType for all user types', () => {
      const ambassadorFiltered = filterQuestionsByUserType(mockQuestions, 'AMBASSADOR_RANK_EXAMS');
      const extraordinaryFiltered = filterQuestionsByUserType(mockQuestions, 'EXTRAORDINARY_RANK_EXAMS');
      
      expect(ambassadorFiltered.some(q => q.id === '5')).toBe(true);
      expect(extraordinaryFiltered.some(q => q.id === '5')).toBe(true);
    });

    it('should return empty array if no matching questions', () => {
      const questionsWithoutMatch = [
        { id: '1', text: 'Q1', questionType: 'EXTRAORDINARY_RANK_EXAMS' as UserType, correctOption: 'A', optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1' }
      ];
      const filtered = filterQuestionsByUserType(questionsWithoutMatch, 'AMBASSADOR_RANK_EXAMS');
      expect(filtered).toHaveLength(0);
    });

    it('should handle empty question array', () => {
      const filtered = filterQuestionsByUserType([], 'AMBASSADOR_RANK_EXAMS');
      expect(filtered).toHaveLength(0);
    });
  });
});
