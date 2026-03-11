import { body, ValidationChain } from 'express-validator';

// Simple validation functions for testing
export const validateEmail = (email: string): boolean => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
};

export const validatePassword = (password: string): boolean => {
    if (!password || typeof password !== 'string') return false;
    if (password.length < 8) return false;
    
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&]/.test(password);
    
    return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
};

export const validateName = (name: string): boolean => {
    if (!name || typeof name !== 'string') return false;
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) return false;
    
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    return nameRegex.test(trimmedName);
};

// Password validation rules
export const passwordValidation = (): ValidationChain => {
    return body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)');
};

// Email validation
export const emailValidation = (): ValidationChain => {
    return body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .trim(); // Only trim whitespace, don't normalize
};

// Name validation
export const nameValidation = (): ValidationChain => {
    return body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/)
        .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes');
};

// Quiz title validation
export const quizTitleValidation = (): ValidationChain => {
    return body('title')
        .trim()
        .isLength({ min: 3, max: 200 })
        .withMessage('Quiz title must be between 3 and 200 characters')
        .escape();
};

// Quiz duration validation
export const quizDurationValidation = (): ValidationChain => {
    return body('duration')
        .isInt({ min: 1, max: 300 })
        .withMessage('Duration must be between 1 and 300 minutes');
};

