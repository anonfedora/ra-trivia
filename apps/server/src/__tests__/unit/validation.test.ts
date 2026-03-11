import { describe, it, expect } from 'vitest';
import { 
  validateEmail, 
  validatePassword, 
  validateName 
} from '../../utils/validation';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user @example.com')).toBe(false);
    });

    it('should reject empty or null emails', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null as any)).toBe(false);
      expect(validateEmail(undefined as any)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      expect(validatePassword('StrongP@ss123')).toBe(true);
      expect(validatePassword('MyP@ssw0rd!')).toBe(true);
      expect(validatePassword('C0mpl3x!Pass')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(validatePassword('short')).toBe(false);
      expect(validatePassword('nouppercaseornumbers')).toBe(false);
      expect(validatePassword('NOLOWERCASE123')).toBe(false);
      expect(validatePassword('NoNumbers!')).toBe(false);
    });

    it('should enforce minimum length', () => {
      expect(validatePassword('Sh0rt!')).toBe(false);
      expect(validatePassword('LongEnough123!')).toBe(true);
    });
  });

  describe('validateName', () => {
    it('should accept valid names', () => {
      expect(validateName('John Doe')).toBe(true);
      expect(validateName('Mary-Jane Smith')).toBe(true);
      expect(validateName("O'Brien")).toBe(true);
    });

    it('should reject invalid names', () => {
      expect(validateName('123')).toBe(false);
      expect(validateName('User@123')).toBe(false);
      expect(validateName('')).toBe(false);
    });

    it('should reject names that are too short or too long', () => {
      expect(validateName('A')).toBe(false);
      expect(validateName('A'.repeat(101))).toBe(false);
      expect(validateName('John Smith')).toBe(true);
    });
  });
});
