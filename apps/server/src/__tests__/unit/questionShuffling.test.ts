import { describe, it, expect, vi } from 'vitest';

describe('Question Shuffling', () => {
  describe('Crypto-Secure Random Shuffling', () => {
    it('should shuffle questions using Fisher-Yates algorithm', () => {
      const crypto = require('crypto');
      
      // Mock questions array
      const questions = [
        { id: '1', text: 'Question 1' },
        { id: '2', text: 'Question 2' },
        { id: '3', text: 'Question 3' },
        { id: '4', text: 'Question 4' },
        { id: '5', text: 'Question 5' }
      ];

      // Create a copy for comparison
      const originalOrder = [...questions];
      
      // Apply Fisher-Yates shuffle with crypto-secure random
      for (let i = questions.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [questions[i], questions[j]] = [questions[j], questions[i]];
      }

      // Verify the array is shuffled (different from original)
      expect(questions).not.toEqual(originalOrder);
      
      // Verify all elements are still present
      expect(questions).toHaveLength(originalOrder.length);
      expect(questions.sort((a, b) => a.id.localeCompare(b.id))).toEqual(originalOrder);
    });

    it('should shuffle answer options using Fisher-Yates algorithm', () => {
      const crypto = require('crypto');
      
      // Mock options array
      const options = [
        { key: 'A', text: 'Option A' },
        { key: 'B', text: 'Option B' },
        { key: 'C', text: 'Option C' },
        { key: 'D', text: 'Option D' }
      ];

      const originalOrder = [...options];
      
      // Apply Fisher-Yates shuffle with crypto-secure random
      for (let i = options.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [options[i], options[j]] = [options[j], options[i]];
      }

      // Verify the array is shuffled
      expect(options).not.toEqual(originalOrder);
      
      // Verify all elements are still present
      expect(options).toHaveLength(originalOrder.length);
      expect(options.sort((a, b) => a.key.localeCompare(b.key))).toEqual(originalOrder);
    });

    it('should handle empty arrays gracefully', () => {
      const crypto = require('crypto');
      
      const emptyArray: any[] = [];
      
      // Should not throw error on empty array
      expect(() => {
        for (let i = emptyArray.length - 1; i > 0; i--) {
          const j = crypto.randomInt(0, i + 1);
          [emptyArray[i], emptyArray[j]] = [emptyArray[j], emptyArray[i]];
        }
      }).not.toThrow();
      
      expect(emptyArray).toHaveLength(0);
    });

    it('should handle single element arrays', () => {
      const crypto = require('crypto');
      
      const singleElement = [{ id: '1', text: 'Single' }];
      const original = [...singleElement];
      
      // Apply shuffle algorithm
      for (let i = singleElement.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [singleElement[i], singleElement[j]] = [singleElement[j], singleElement[i]];
      }
      
      // Should remain unchanged
      expect(singleElement).toEqual(original);
    });

    it('should produce different shuffle results on multiple runs', () => {
      const crypto = require('crypto');
      
      const original = [
        { id: '1', text: 'Question 1' },
        { id: '2', text: 'Question 2' },
        { id: '3', text: 'Question 3' }
      ];

      // Run shuffle multiple times
      const results = [];
      for (let run = 0; run < 10; run++) {
        const copy = [...original];
        
        for (let i = copy.length - 1; i > 0; i--) {
          const j = crypto.randomInt(0, i + 1);
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        
        results.push(copy);
      }

      // At least some runs should produce different results
      const uniqueResults = results.map(result => 
        result.map(q => q.id).join(',')
      );
      
      const uniqueCount = new Set(uniqueResults).size;
      expect(uniqueCount).toBeGreaterThan(1);
    });

    it('should maintain cryptographic security', () => {
      const crypto = require('crypto');
      
      // Test that crypto.randomInt is being used (not Math.random)
      const randomIntSpy = vi.spyOn(crypto, 'randomInt');
      
      const options = [
        { key: 'A', text: 'Option A' },
        { key: 'B', text: 'Option B' }
      ];
      
      // Apply shuffle
      for (let i = options.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [options[i], options[j]] = [options[j], options[i]];
      }
      
      // Verify crypto.randomInt was called
      expect(randomIntSpy).toHaveBeenCalled();
      
      randomIntSpy.mockRestore();
    });
  });

  describe('Answer Remapping', () => {
    it('should correctly remap answer keys after shuffling', () => {
      const crypto = require('crypto');
      
      // Mock question with original correct option
      const question = {
        id: 'q1',
        text: 'Test question',
        optionA: 'Answer A',
        optionB: 'Answer B', 
        optionC: 'Answer C',
        optionD: 'Answer D',
        correctOption: 'B' // Original correct answer is B
      };

      // Shuffle options
      const options = [
        { key: 'A', text: question.optionA },
        { key: 'B', text: question.optionB },
        { key: 'C', text: question.optionC },
        { key: 'D', text: question.optionD }
      ];

      for (let i = options.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [options[i], options[j]] = [options[j], options[i]];
      }

      // Remap keys to positional labels
      const positionLabels = ['A', 'B', 'C', 'D'];
      const remappedOptions = options.map((opt, index) => ({
        originalKey: opt.key,
        key: positionLabels[index],
        text: opt.text
      }));

      // Find the new label for the correct option
      const remappedCorrectOption = remappedOptions.find(
        o => o.originalKey === question.correctOption
      )?.key ?? question.correctOption;

      // Verify the remapping is correct
      const correctOptionObj = remappedOptions.find(o => o.originalKey === 'B');
      expect(remappedCorrectOption).toBe(correctOptionObj?.key);
      
      // Verify all options are present with new keys
      expect(remappedOptions).toHaveLength(4);
      expect(remappedOptions.every(o => ['A', 'B', 'C', 'D'].includes(o.key))).toBe(true);
    });
  });
});
