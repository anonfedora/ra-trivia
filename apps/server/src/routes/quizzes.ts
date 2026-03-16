import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, AuthRequest, authorize } from '../middlewares/auth';
import { validateQuizListAccess, validateUserTypeAccess } from '../middlewares/userTypeAccess';

const router = Router();

// Get all quizzes
// Super Admin gets all, Admin gets only their created quizzes, Candidates get only active ones with matching question types
router.get('/', authenticate, validateQuizListAccess, async (req: AuthRequest, res) => {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.userId;
        const userType = req.userTypeFilter;
        const activeOnly = req.query.activeOnly === 'true';

        let where: any = {};

        // Role-based filtering
        if (userRole === 'SUPER_ADMIN') {
            // Super admins see all quizzes (unless activeOnly is explicitly requested)
            if (activeOnly) {
                where.isActive = true;
            }
        } else if (userRole === 'ADMIN') {
            // Regular admins see only their created quizzes
            where.createdById = userId;
            if (activeOnly) {
                where.isActive = true;
            }
        } else {
            // Candidates see only active quizzes
            where.isActive = true;
        }

        console.log(`[QUIZ_GET] User: ${userId}, Role: ${userRole}, UserType: ${userType}, activeOnly: ${activeOnly}, Filter: ${JSON.stringify(where)}`);

        const quizzes = await prisma.quiz.findMany({
            where,
            include: {
                _count: {
                    select: { questions: true }
                },
                createdBy: true,
                // Include questions for user type filtering (candidates only)
                questions: userRole === 'CANDIDATE' ? {
                    select: { questionType: true }
                } : false
            },
            orderBy: { createdAt: 'desc' }
        });

        // Filter quizzes for candidates based on user type matching
        let filteredQuizzes = quizzes;
        if (userRole === 'CANDIDATE' && userType) {
            filteredQuizzes = quizzes.filter(quiz => {
                // Only show quizzes that have at least one question matching the user's type
                const hasMatchingQuestions = quiz.questions?.some(q => q.questionType === userType);
                return hasMatchingQuestions;
            });

            console.log(`[QUIZ_FILTER] Original count: ${quizzes.length}, Filtered count: ${filteredQuizzes.length}, UserType: ${userType}`);
        }

        // Remove questions from response (they were only needed for filtering)
        const responseQuizzes = filteredQuizzes.map(quiz => {
            const { questions, ...quizWithoutQuestions } = quiz;
            return quizWithoutQuestions;
        });

        res.json(responseQuizzes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get quiz details (for instructions) - with user type access control
router.get('/:id', authenticate, validateUserTypeAccess, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const userRole = req.user?.role;
        const userType = req.user?.userType;

        const quiz = await prisma.quiz.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { questions: true }
                },
                // Include questions for candidates to show filtered count
                questions: userRole === 'CANDIDATE' ? {
                    select: { questionType: true }
                } : false
            }
        });

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // For candidates, show count of questions matching their type
        if (userRole === 'CANDIDATE' && userType && quiz.questions) {
            const matchingQuestionsCount = quiz.questions.filter(q => q.questionType === userType).length;
            
            console.log(`[QUIZ_DETAILS] Quiz ${id}: Total questions: ${quiz.questions.length}, Matching user type ${userType}: ${matchingQuestionsCount}`);

            // Return quiz without questions but with updated count
            const { questions, ...quizWithoutQuestions } = quiz;
            res.json({
                ...quizWithoutQuestions,
                _count: {
                    questions: matchingQuestionsCount
                }
            });
        } else {
            // For admins, return quiz without questions
            const { questions, ...quizWithoutQuestions } = quiz;
            res.json(quizWithoutQuestions);
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Admin: Preview quiz with questions (read-only)
router.get('/:id/preview', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const quiz = await prisma.quiz.findUnique({
            where: { id },
            include: {
                questions: {
                    select: {
                        id: true,
                        text: true,
                        optionA: true,
                        optionB: true,
                        optionC: true,
                        optionD: true,
                        questionType: true // Include questionType in preview
                    },
                    orderBy: { createdAt: 'asc' }
                },
                _count: {
                    select: { questions: true }
                }
            }
        });

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        res.json(quiz);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Create quiz (Admin only)
router.post('/', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    try {
        const { title, duration } = req.body;

        if (!title || !duration) {
            return res.status(400).json({ message: 'Title and duration are required' });
        }

        const quiz = await prisma.quiz.create({
            data: {
                title,
                duration: Number(duration),
                isActive: false,
                createdById: req.user?.userId // Associate quiz with creator
            }
        });
        res.status(201).json(quiz);
    } catch (error) {
        console.error('Quiz creation error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
});

// Admin: Update quiz metadata
router.patch('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { title, duration, startDate, endDate, retakeLimit } = req.body;
        const userRole = req.user?.role;
        const userId = req.user?.userId;

        // Check if quiz exists and user has permission
        const existingQuiz = await prisma.quiz.findUnique({
            where: { id }
        });

        if (!existingQuiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Role-based access control
        if (userRole === 'ADMIN' && existingQuiz.createdById !== userId) {
            return res.status(403).json({ message: 'You can only edit quizzes you created' });
        }
        // Super admins can edit any quiz, including those with null createdById

        // Super admins can edit any quiz, regular admins only their own

        const parsedDuration = duration !== undefined ? Number(duration) : undefined;
        if (parsedDuration !== undefined && (!Number.isFinite(parsedDuration) || parsedDuration <= 0)) {
            return res.status(400).json({ message: 'Duration must be a positive number' });
        }

        const parsedRetakeLimit = retakeLimit !== undefined ? Number(retakeLimit) : undefined;
        if (parsedRetakeLimit !== undefined && (!Number.isFinite(parsedRetakeLimit) || parsedRetakeLimit < 1 || parsedRetakeLimit > 10)) {
            return res.status(400).json({ message: 'Retake limit must be between 1 and 10' });
        }

        const parsedStartDate = startDate === '' || startDate === null || startDate === undefined ? undefined : new Date(startDate);
        const parsedEndDate = endDate === '' || endDate === null || endDate === undefined ? undefined : new Date(endDate);
        if (parsedStartDate && Number.isNaN(parsedStartDate.getTime())) {
            return res.status(400).json({ message: 'Invalid startDate' });
        }
        if (parsedEndDate && Number.isNaN(parsedEndDate.getTime())) {
            return res.status(400).json({ message: 'Invalid endDate' });
        }
        if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
            return res.status(400).json({ message: 'endDate must be after startDate' });
        }

        const updatedQuiz = await prisma.quiz.update({
            where: { id },
            data: {
                ...(title !== undefined ? { title } : {}),
                ...(parsedDuration !== undefined ? { duration: parsedDuration } : {}),
                ...(retakeLimit !== undefined ? { retakeLimit: parsedRetakeLimit } : {}),
                ...(startDate !== undefined ? { startDate: parsedStartDate ?? null } : {}),
                ...(endDate !== undefined ? { endDate: parsedEndDate ?? null } : {})
            }
        });

        res.json(updatedQuiz);
    } catch (error) {
        console.error('[QUIZ_UPDATE_ERROR]', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Toggle quiz activity (Admin only)
router.patch('/:id/toggle', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const userRole = req.user?.role;
        const userId = req.user?.userId;

        const quiz = await prisma.quiz.findUnique({
            where: { id }
        });

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Role-based access control
        if (userRole === 'ADMIN' && quiz.createdById !== userId) {
            return res.status(403).json({ message: 'You can only toggle quizzes you created' });
        }
        // Super admins can toggle any quiz, including those with null createdById

        const newIsActive = !quiz.isActive;
        console.log(`[QUIZ_TOGGLE] QuizID: ${id}, NewState: ${newIsActive}`);
        const updatedQuiz = await prisma.quiz.update({
            where: { id },
            data: { isActive: newIsActive }
        });

        // When a quiz is activated, notify matching candidates
        if (newIsActive) {
            // Find distinct question types in this quiz
            const questionTypes = await prisma.question.findMany({
                where: { quizId: id },
                select: { questionType: true },
                distinct: ['questionType']
            });
            const types = questionTypes.map(q => q.questionType);

            if (types.length > 0) {
                // Find all verified candidates whose userType matches
                const candidates = await prisma.user.findMany({
                    where: {
                        role: 'CANDIDATE',
                        emailVerified: true,
                        userType: { in: types }
                    },
                    select: { id: true, userType: true }
                });

                if (candidates.length > 0) {
                    await prisma.notification.createMany({
                        data: candidates.map(c => ({
                            type: 'NEW_EXAM_AVAILABLE',
                            title: 'New Exam Available',
                            message: `A new exam "${quiz.title}" is now available for you to take.`,
                            quizId: id,
                            isRead: false,
                            createdById: c.id, // candidate's own ID for filtering
                        }))
                    });
                    console.log(`[QUIZ_TOGGLE] Notified ${candidates.length} candidates about quiz "${quiz.title}"`);
                }
            }
        }

        res.json(updatedQuiz);
    } catch (error) {
        console.error('[QUIZ_TOGGLE_ERROR]', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Delete quiz (Admin only)
router.delete('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const userRole = req.user?.role;
        const userId = req.user?.userId;

        // Check if quiz exists and user has permission
        const quiz = await prisma.quiz.findUnique({
            where: { id }
        });

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Role-based access control
        if (userRole === 'ADMIN' && quiz.createdById !== userId) {
            return res.status(403).json({ message: 'You can only delete quizzes you created' });
        }
        // Super admins can delete any quiz, including those with null createdById

        console.log(`[QUIZ_DELETE] QuizID: ${id}, User: ${userId}, Role: ${userRole}`);
        // Cascade delete: sessions -> questions -> quiz
        await prisma.$transaction([
            prisma.quizSession.deleteMany({ where: { quizId: id } }),
            prisma.question.deleteMany({ where: { quizId: id } }),
            prisma.quiz.delete({ where: { id } })
        ]);

        res.json({ message: 'Quiz deleted successfully' });
    } catch (error) {
        console.error('[QUIZ_DELETE_ERROR]', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
