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
