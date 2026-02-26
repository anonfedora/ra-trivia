import { body, ValidationChain } from 'express-validator';

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
        .normalizeEmail();
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
