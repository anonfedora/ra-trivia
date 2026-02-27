import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, AuthRequest, authorize } from '../middlewares/auth';

const router = Router();

// Get all quizzes
// Admin gets all, Candidates get only active ones
router.get('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const userRole = req.user?.role;
        const activeOnly = req.query.activeOnly === 'true';

        // If not admin OR if activeOnly is explicitly requested
        const where = (userRole !== 'ADMIN' || activeOnly) ? { isActive: true } : {};

        console.log(`[QUIZ_GET] User: ${req.user?.userId}, Role: ${userRole}, activeOnly: ${activeOnly}, Filter: ${JSON.stringify(where)}`);

        const quizzes = await prisma.quiz.findMany({
            where,
            include: {
                _count: {
                    select: { questions: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(quizzes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get quiz details (for instructions)
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const quiz = await prisma.quiz.findUnique({
            where: { id },
            include: {
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
                        optionD: true
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
                isActive: false
            }
        });
        res.status(201).json(quiz);
    } catch (error) {
        console.error('Quiz creation error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
});

// Admin: Update quiz metadata
router.patch('/:id', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { title, duration, startDate, endDate, retakeLimit } = req.body;

        const quiz = await prisma.quiz.findUnique({ where: { id } });
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

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
router.patch('/:id/toggle', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const quiz = await prisma.quiz.findUnique({
            where: { id }
        });

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        console.log(`[QUIZ_TOGGLE] QuizID: ${id}, NewState: ${!quiz.isActive}`);
        const updatedQuiz = await prisma.quiz.update({
            where: { id },
            data: { isActive: !quiz.isActive }
        });

        res.json(updatedQuiz);
    } catch (error) {
        console.error('[QUIZ_TOGGLE_ERROR]', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Delete quiz (Admin only)
router.delete('/:id', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;

        console.log(`[QUIZ_DELETE] QuizID: ${id}`);
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
