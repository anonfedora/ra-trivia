import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { sendQuizResultEmail } from '../services/email';

const router = Router();

// Start a quiz session
router.post('/start', authenticate, async (req: AuthRequest, res) => {
    try {
        const { quizId } = req.body;
        const userId = req.user!.userId;

        // Check if user already has an active session
        let session = await prisma.quizSession.findFirst({
            where: {
                userId,
                quizId,
                endTime: null
            }
        });

        if (!session) {
            session = await prisma.quizSession.create({
                data: {
                    userId,
                    quizId,
                    startTime: new Date(),
                    answers: {}
                }
            });
        }

        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: { questions: true }
        });

        res.status(201).json({ session, quiz });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update answer (Auto-save)
router.post('/update-answer', authenticate, async (req: AuthRequest, res) => {
    try {
        const { sessionId, questionId, selectedOption } = req.body;

        const session = await prisma.quizSession.findUnique({
            where: { id: sessionId }
        });

        if (!session || session.endTime) {
            return res.status(400).json({ message: 'Session not found or already ended' });
        }

        const currentAnswers = (session.answers as any) || {};
        currentAnswers[questionId] = selectedOption;

        const updatedSession = await prisma.quizSession.update({
            where: { id: sessionId },
            data: { answers: currentAnswers }
        });

        res.json(updatedSession);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Submit quiz
router.post('/submit', authenticate, async (req: AuthRequest, res) => {
    try {
        const { sessionId } = req.body;

        const session = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            include: { quiz: { include: { questions: true } }, user: true }
        });

        if (!session || session.endTime) {
            return res.status(400).json({ message: 'Session not found or already ended' });
        }

        const answers = (session.answers as any) || {};
        const questions = session.quiz.questions;
        let correctCount = 0;
        const answerDetails = questions.map((q: any) => {
            const selectedOption = answers[q.id];
            const isCorrect = selectedOption === q.correctOption;
            if (isCorrect) correctCount++;
            return {
                question: q.text,
                selectedOption: selectedOption || 'No answer',
                correctOption: q.correctOption,
                isCorrect
            };
        });

        const score = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

        const updatedSession = await prisma.quizSession.update({
            where: { id: sessionId },
            data: {
                endTime: new Date(),
                score
            },
            include: { user: true }
        });

        // Send email via Resend (don't await to avoid blocking the response)
        sendQuizResultEmail(
            updatedSession.user.email,
            updatedSession.user.name,
            score,
            answerDetails
        ).catch(err => console.error('Background email sending failed:', err));

        res.json(updatedSession);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get candidate's own sessions
router.get('/my-sessions', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const sessions = await prisma.quizSession.findMany({
            where: { userId },
            include: {
                quiz: {
                    select: { id: true, title: true, duration: true }
                }
            },
            orderBy: { startTime: 'desc' }
        });
        res.json(sessions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get specific session result (with per-question breakdown)
router.get('/session/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const userId = req.user!.userId;

        const session = await prisma.quizSession.findUnique({
            where: { id },
            include: {
                quiz: {
                    include: { questions: true }
                }
            }
        });

        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }

        // Only owner or admin can view
        if (session.userId !== userId && req.user!.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // Compute per-question breakdown from stored answers
        const answers = (session.answers as Record<string, string>) || {};
        const questions = session.quiz.questions;
        let correctCount = 0;

        const breakdown = questions.map((q: any) => {
            const selected = answers[q.id] ?? null;
            const isCorrect = selected === q.correctOption;
            if (isCorrect) correctCount++;
            return {
                questionId: q.id,
                text: q.text,
                options: [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean),
                selectedOption: selected,
                correctOption: q.correctOption,
                isCorrect
            };
        });

        res.json({
            ...session,
            breakdown,
            totalQuestions: questions.length,
            correctCount,
            incorrectCount: questions.length - correctCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
