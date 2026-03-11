import { Response, NextFunction } from 'express';
import { prisma } from 'database';
import { AuthRequest } from './auth';

/**
 * Middleware to validate user type access to quizzes
 * Ensures candidates can only access quizzes with questions matching their user type
 */
export const validateUserTypeAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { quizId } = req.params.id ? { quizId: req.params.id } : req.body;
        const userId = req.user?.userId;
        const userRole = req.user?.role;
        const userType = req.user?.userType;

        // Skip validation for admins - they can access all quizzes
        if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
            return next();
        }

        // Ensure we have required data
        if (!quizId || !userId || !userType) {
            return res.status(400).json({ 
                message: 'Missing required information for access validation' 
            });
        }

        // Get quiz with its questions to check question types
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                questions: {
                    select: { questionType: true }
                }
            }
        });

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Check if quiz has any questions
        if (quiz.questions.length === 0) {
            return res.status(400).json({ 
                message: 'This quiz has no questions available' 
            });
        }

        // Get unique question types in this quiz
        const quizQuestionTypes = [...new Set(quiz.questions.map(q => q.questionType))];

        // Check if user's type matches any question type in the quiz
        const hasMatchingQuestions = quizQuestionTypes.includes(userType as any);

        if (!hasMatchingQuestions) {
            return res.status(403).json({
                message: 'Access denied: This quiz contains questions that do not match your examination type. Please contact an administrator if you believe this is an error.',
                userType,
                availableQuestionTypes: quizQuestionTypes
            });
        }

        // Store quiz info for potential use in the route handler
        req.quizAccess = {
            quiz,
            userType,
            quizQuestionTypes,
            hasAccess: true
        };

        next();
    } catch (error) {
        console.error('[USER_TYPE_ACCESS_ERROR]', error);
        res.status(500).json({ message: 'Internal server error during access validation' });
    }
};

/**
 * Filter questions based on user type matching
 * Returns only questions that match the user's type
 */
export const filterQuestionsByUserType = (questions: any[], userType: string) => {
    return questions.filter(question => question.questionType === userType || question.questionType === null);
};

/**
 * Validate quiz access for listing - filters quizzes to only show those with matching question types
 */
export const validateQuizListAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userRole = req.user?.role;
        const userType = req.user?.userType;

        // Skip filtering for admins - they can see all quizzes
        if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
            return next();
        }

        // Store user type for filtering in the route handler
        req.userTypeFilter = userType;
        next();
    } catch (error) {
        console.error('[QUIZ_LIST_ACCESS_ERROR]', error);
        res.status(500).json({ message: 'Internal server error during quiz list validation' });
    }
};

// Extend AuthRequest interface to include quiz access info
declare module './auth' {
    interface AuthRequest {
        quizAccess?: {
            quiz: any;
            userType: string;
            quizQuestionTypes: string[];
            hasAccess: boolean;
        };
        userTypeFilter?: string;
    }
}