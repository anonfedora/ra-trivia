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

        // Check retake limit
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId }
        });

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        const completedSessions = await prisma.quizSession.count({
            where: {
                userId,
                quizId,
                endTime: { not: null }
            }
        });

        const retakeLimit = quiz.retakeLimit || 2; // Default to 2 if not set
        if (completedSessions >= retakeLimit) {
            return res.status(400).json({
                message: `You have reached the maximum number of attempts (${retakeLimit}) for this quiz.`
            });
        }

        // Check quiz scheduling
        const now = new Date();
        if (quiz.startDate && now < quiz.startDate) {
            return res.status(400).json({
                message: 'This quiz has not started yet.'
            });
        }

        if (quiz.endDate && now > quiz.endDate) {
            return res.status(400).json({
                message: 'This quiz has ended.'
            });
        }

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
                    // __remap__ will be added after randomizing questions (see below)
                    answers: {}
                }
            });
        }

        // Get quiz with questions and randomize them
        const quizWithQuestions = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: { questions: true }
        });

        if (!quizWithQuestions) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Randomize question order and shuffle answers
        const questions = [...quizWithQuestions.questions];

        // Fisher-Yates shuffle for questions
        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }

        console.log('[QUIZ_RANDOMIZATION] Shuffled questions:', questions.map(q => ({ id: q.id, originalOrder: quizWithQuestions.questions.findIndex(orig => orig.id === q.id) })));

        const randomizedQuestions = questions.map(question => {
            // Create array of options and shuffle them using Fisher-Yates
            const options = [
                { key: 'A', text: question.optionA },
                { key: 'B', text: question.optionB },
                { key: 'C', text: question.optionC },
                { key: 'D', text: question.optionD }
            ].filter(opt => opt.text); // Remove empty options

            // Fisher-Yates shuffle for truly random ordering
            for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
            }

            // Remap keys to positional labels (A=index 0, B=index 1, etc.)
            // This ensures that the correct answer key is distributed uniformly
            // rather than always matching the original DB key (e.g. always 'B' or 'C').
            const positionLabels = ['A', 'B', 'C', 'D'];
            const remappedOptions = options.map((opt, index) => ({
                originalKey: opt.key,       // keep originalKey for debugging
                key: positionLabels[index], // new label based on position
                text: opt.text
            }));

            // Find the new label for the correct option
            const correctOriginalKey = question.correctOption;
            const remappedCorrectOption = remappedOptions.find(
                o => o.originalKey === correctOriginalKey
            )?.key ?? correctOriginalKey;

            console.log(`[QUIZ_RANDOMIZATION] Question ${question.id}: DB correctOption=${correctOriginalKey} -> remapped correctOption=${remappedCorrectOption}`);

            return {
                ...question,
                correctOption: remappedCorrectOption, // used for scoring
                randomizedOptions: remappedOptions
            };
        });

        // Build remap: questionId -> { correctOption, options (in shuffled order) }
        // Store this in the session so submit/results can use remapped keys correctly
        const remap: Record<string, string> = {};
        const optmap: Record<string, Array<{ key: string; text: string }>> = {};
        randomizedQuestions.forEach(q => {
            remap[q.id] = q.correctOption;
            optmap[q.id] = q.randomizedOptions.map(o => ({ key: o.key, text: o.text }));
        });

        // Persist the remap and optmap into the session's answers JSON under reserved keys
        const currentAnswers = (session.answers as Record<string, string>) || {};
        await prisma.quizSession.update({
            where: { id: session.id },
            data: {
                answers: {
                    ...currentAnswers,
                    __remap__: JSON.stringify(remap),
                    __optmap__: JSON.stringify(optmap)
                }
            }
        });

        const randomizedQuiz = {
            ...quizWithQuestions,
            questions: randomizedQuestions
        };

        res.status(201).json({ session, quiz: randomizedQuiz });
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

        // Retrieve the remap stored during quiz start (questionId -> remapped correct key)
        // If not found, fall back to original DB correctOption
        const remapRaw = answers.__remap__;
        const remap: Record<string, string> = remapRaw ? JSON.parse(remapRaw) : {};

        let correctCount = 0;
        const answerDetails = questions.map((q: any) => {
            const selectedOption = answers[q.id];
            // Use remapped correct option if available, else fall back to DB key
            const correctOption = remap[q.id] ?? q.correctOption;
            const isCorrect = selectedOption === correctOption;
            if (isCorrect) correctCount++;
            return {
                question: q.text,
                selectedOption: selectedOption || 'No answer',
                correctOption,
                isCorrect
            };
        });

        const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100 * 100) / 100 : 0;

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

        // Retrieve remap (questionId -> remapped correct key) and optmap (questionId -> shuffled options)
        const remapRaw = (answers as any).__remap__;
        const optmapRaw = (answers as any).__optmap__;
        const remap: Record<string, string> = remapRaw ? JSON.parse(remapRaw) : {};
        const optmap: Record<string, Array<{ key: string; text: string }>> = optmapRaw ? JSON.parse(optmapRaw) : {};

        const breakdown = questions.map((q: any) => {
            const selected = answers[q.id] ?? null;
            // Use remapped correct option if available, else fall back to DB key
            const correctOption = remap[q.id] ?? q.correctOption;
            const isCorrect = selected === correctOption;
            if (isCorrect) correctCount++;

            // Use the shuffled option order from optmap if available (so results match what was shown during quiz)
            // Fall back to original DB order if no optmap entry
            const options = optmap[q.id] ?? [
                { key: 'A', text: q.optionA },
                { key: 'B', text: q.optionB },
                { key: 'C', text: q.optionC },
                { key: 'D', text: q.optionD }
            ].filter((opt: any) => Boolean(opt.text));

            return {
                questionId: q.id,
                text: q.text,
                options,
                selectedOption: selected,
                correctOption,
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
