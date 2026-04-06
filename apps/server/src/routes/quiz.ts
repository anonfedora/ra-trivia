import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, AuthRequest, authorizeAdmin } from '../middlewares/auth';
import { validateUserTypeAccess, filterQuestionsByUserType } from '../middlewares/userTypeAccess';
import { sendQuizResultEmail } from '../services/email';
import { emitNotification, emitToRoom } from '../services/socketService';

const router = Router();

let isMaintenanceMode = false;

/**
 * @openapi
 * /quiz/maintenance/status:
 *   get:
 *     tags: [Maintenance]
 *     summary: Get maintenance mode status
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current status
 */
router.get('/maintenance/status', authenticate, authorizeAdmin, (req, res) => {
    res.json({ isMaintenanceMode });
});

/**
 * @openapi
 * /quiz/maintenance/toggle:
 *   post:
 *     tags: [Maintenance]
 *     summary: Toggle maintenance mode
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Mode updated
 */
router.post('/maintenance/toggle', authenticate, authorizeAdmin, (req: AuthRequest, res) => {
    const { enabled } = req.body;
    isMaintenanceMode = !!enabled;
    
    // Notify all connected clients about maintenance mode change
    emitToRoom('all', 'maintenance_mode', { enabled: isMaintenanceMode });
    
    res.json({ 
        message: `Maintenance mode ${isMaintenanceMode ? 'enabled' : 'disabled'}`,
        isMaintenanceMode 
    });
});

/**
 * @openapi
 * /quiz/start:
 *   post:
 *     tags: [Quiz Session]
 *     summary: Start a new quiz session
 *     description: Initializes an exam session, applies retake limits, and returns a randomized set of questions filtered by the user's exam type.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quizId]
 *             properties:
 *               quizId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Session started
 *       400:
 *         description: Retake limit reached or quiz not active
 *       403:
 *         description: No questions matching user type
 *       503:
 *         description: Maintenance mode active
 */
router.post('/start', authenticate, validateUserTypeAccess, async (req: AuthRequest, res) => {
    try {
        const { quizId } = req.body;
        const userId = req.user!.userId;
        const userRole = req.user!.role;

        // Check maintenance mode
        if (isMaintenanceMode && userRole === 'CANDIDATE') {
            return res.status(503).json({
                message: 'System is currently under maintenance. New exams cannot be started at this time. Please try again later.'
            });
        }

        const userType = req.user!.userType;
        const userAgent = req.get('User-Agent') || 'Unknown';
        const referer = req.get('Referer') || 'Unknown';

        console.log(`[QUIZ_START] Session start request:`, {
            quizId,
            userId,
            userRole,
            userType,
            userAgent: userAgent.substring(0, 100),
            referer: referer.substring(0, 100),
            timestamp: new Date().toISOString()
        });

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

        // Check if user already has an active session (not completed)
        let session = await prisma.quizSession.findFirst({
            where: {
                userId,
                quizId,
                endTime: null // Only get truly active sessions
            }
        });

        // Clean up stale sessions (older than quiz duration + 1 hour buffer)
        if (session) {
            const sessionAge = Date.now() - new Date(session.startTime).getTime();
            const maxSessionTime = (quiz.duration + 60) * 60 * 1000; // duration in minutes + 1 hour buffer
            
            if (sessionAge > maxSessionTime) {
                console.log(`[QUIZ_START] Cleaning up stale session ${session.id} (age: ${Math.round(sessionAge / 60000)} minutes)`);
                
                // Mark stale session as completed with 0 score
                await prisma.quizSession.update({
                    where: { id: session.id },
                    data: {
                        endTime: new Date(),
                        score: 0
                    }
                });
                
                session = null; // Will create a new session below
            }
        }

        // CRITICAL: Check if user just completed this quiz (within last 5 minutes)
        // This prevents phantom sessions from being created immediately after submission
        if (!session) {
            const recentCompletion = await prisma.quizSession.findFirst({
                where: {
                    userId,
                    quizId,
                    endTime: { 
                        not: null,
                        gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
                    }
                },
                orderBy: { endTime: 'desc' }
            });

            if (recentCompletion) {
                console.log(`[QUIZ_START] User ${userId} just completed quiz ${quizId} at ${recentCompletion.endTime}. Blocking new session to prevent phantom.`);
                return res.status(400).json({
                    message: 'You just completed this quiz. Please wait a few minutes before retaking it.',
                    recentCompletion: true
                });
            }
        }

        // If there's an active session, return it
        if (session) {
            console.log(`[QUIZ_START] Found existing active session ${session.id} for user ${userId}, quiz ${quizId}`);
        } else {
            // Create new session only if user hasn't exceeded retake limit
            console.log(`[QUIZ_START] Creating new session for user ${userId}, quiz ${quizId}. Completed attempts: ${completedSessions}/${retakeLimit}`);
            
            session = await prisma.quizSession.create({
                data: {
                    userId,
                    quizId,
                    startTime: new Date(),
                    answers: {}
                }
            });
        }

        // Get quiz with questions and filter by user type for candidates
        const quizWithQuestions = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: { questions: true }
        });

        if (!quizWithQuestions) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Filter questions by user type for candidates
        let questions = [...quizWithQuestions.questions];
        if (userRole === 'CANDIDATE' && userType) {
            questions = filterQuestionsByUserType(questions, userType);
            
            if (questions.length === 0) {
                return res.status(403).json({
                    message: 'No questions available for your examination type in this quiz.',
                    userType
                });
            }

            console.log(`[QUIZ_START_FILTER] Quiz ${quizId}: Total questions: ${quizWithQuestions.questions.length}, Filtered for ${userType}: ${questions.length}`);
        }

        // Randomize question order and shuffle answers
        // Fisher-Yates shuffle for questions
        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }

        console.log('[QUIZ_RANDOMIZATION] Shuffled questions:', questions.map(q => ({ id: q.id, questionType: q.questionType, originalOrder: quizWithQuestions.questions.findIndex(orig => orig.id === q.id) })));

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

/**
 * @openapi
 * /quiz/update-answer:
 *   post:
 *     tags: [Quiz Session]
 *     summary: Auto-save candidate answer
 *     description: Persists a selected option for a specific question during an active session.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, questionId, selectedOption]
 *             properties:
 *               sessionId:
 *                 type: string
 *               questionId:
 *                 type: string
 *               selectedOption:
 *                 type: string
 *                 enum: [A, B, C, D]
 *     responses:
 *       200:
 *         description: Answer saved
 */
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

/**
 * @openapi
 * /quiz/submit:
 *   post:
 *     tags: [Quiz Session]
 *     summary: Submit completed quiz
 *     description: Ends the session, calculates the score, and schedules the result release time.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId]
 *             properties:
 *               sessionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Quiz submitted successfully
 */
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

        // Calculate Results Release Time (8 PM Daily)
        const now = new Date();
        const minReleaseTime = new Date(now.getTime() + 90 * 60 * 1000); // Now + 90 minutes

        let releaseDate = new Date(now);
        releaseDate.setHours(20, 0, 0, 0); // 8 PM today

        // If 8 PM today is earlier than minReleaseTime, move to 8 PM tomorrow
        if (releaseDate < minReleaseTime) {
            releaseDate.setDate(releaseDate.getDate() + 1);
            releaseDate.setHours(20, 0, 0, 0);
        }

        console.log(`[QUIZ SUBMIT] Release date calculated: ${releaseDate.toISOString()} (Local: ${releaseDate.toLocaleString()})`);

        const updatedSession = await prisma.quizSession.update({
            where: { id: sessionId },
            data: {
                endTime: new Date(),
                score,
                resultReleasesAt: releaseDate,
                emailSent: false
            },
            include: { 
                user: true,
                quiz: {
                    select: {
                        title: true,
                        createdById: true
                    }
                }
            }
        });

        // Create notification for the quiz creator
        if (updatedSession.quiz.createdById) {
            try {
                const notif = await prisma.notification.create({
                    data: {
                        type: 'EXAM_SUBMITTED',
                        title: 'New Exam Submission',
                        message: `${updatedSession.user.name} completed "${updatedSession.quiz.title}" with a score of ${score}%`,
                        quizId: updatedSession.quizId,
                        sessionId: updatedSession.id,
                        candidateName: updatedSession.user.name,
                        candidateEmail: updatedSession.user.email,
                        createdById: updatedSession.quiz.createdById,
                        isRead: false
                    }
                });
                emitNotification(updatedSession.quiz.createdById, notif);
                console.log(`[NOTIFICATION] Created notification for quiz creator ${updatedSession.quiz.createdById}`);
            } catch (notifError) {
                console.error('[NOTIFICATION] Failed to create notification:', notifError);
                // Don't fail the submission if notification creation fails
            }
        }

        res.json(updatedSession);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /quiz/my-sessions:
 *   get:
 *     tags: [Results]
 *     summary: List candidate's exam history
 *     description: Returns past exam sessions. Scores are masked until the scheduled release time.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of sessions
 */
router.get('/my-sessions', authenticate, async (req: AuthRequest, res) => {
    try {
        const userId = req.user!.userId;
        const userRole = req.user!.role;
        const userType = req.user!.userType;

        const sessions = await prisma.quizSession.findMany({
            where: { userId },
            include: {
                quiz: {
                    select: { 
                        id: true, 
                        title: true, 
                        duration: true,
                        // Include questions for filtering (candidates only)
                        questions: userRole === 'CANDIDATE' ? {
                            select: { questionType: true }
                        } : false
                    }
                }
            },
            orderBy: { startTime: 'desc' }
        });

        // Filter sessions for candidates based on user type matching
        let filteredSessions = sessions;
        if (userRole === 'CANDIDATE' && userType) {
            filteredSessions = sessions.filter(session => {
                // Only show sessions for quizzes that have questions matching the user's type
                const hasMatchingQuestions = session.quiz.questions?.some(q => q.questionType === userType);
                return hasMatchingQuestions;
            });

            console.log(`[MY_SESSIONS_FILTER] User ${userId}, UserType: ${userType}, Original count: ${sessions.length}, Filtered count: ${filteredSessions.length}`);
        }

        // Mask scores if results are not yet released and remove questions from response
        const now = new Date();
        const processedSessions = filteredSessions.map(session => {
            const isReleased = !session.resultReleasesAt || now >= session.resultReleasesAt;
            const { questions, ...quizWithoutQuestions } = session.quiz;
            return {
                ...session,
                score: isReleased ? session.score : null,
                quiz: quizWithoutQuestions
            };
        });

        res.json(processedSessions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /quiz/session/{id}:
 *   get:
 *     tags: [Results]
 *     summary: Get detailed session results
 *     description: Returns a per-question breakdown of the exam. Locked until the release time for candidates.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Result breakdown
 *       423:
 *         description: Results not yet released
 */
router.get('/session/:id', authenticate, async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const userId = req.user!.userId;

        const session = await prisma.quizSession.findUnique({
            where: { id },
            include: {
                quiz: {
                    select: {
                        id: true,
                        title: true,
                        passMark: true,
                        questions: true
                    }
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

        // Check for results release delay
        if (req.user!.role !== 'ADMIN' && session.resultReleasesAt && new Date() < session.resultReleasesAt) {
            return res.status(423).json({
                message: 'Results are not yet available. They will be released soon.',
                releaseAt: session.resultReleasesAt
            });
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

/**
 * @openapi
 * /quiz/verify/{sessionId}:
 *   get:
 *     tags: [Quiz Session]
 *     summary: Verify an exam result publicly
 *     description: Returns public details of a completed exam session for verification purposes. No authentication required.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Result details
 *       404:
 *         description: Result not found
 */
router.get('/verify/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await prisma.quizSession.findUnique({
            where: { id: sessionId },
            include: {
                user: { select: { name: true, church: true, association: true, userType: true } },
                quiz: { select: { title: true, passMark: true } }
            }
        });

        if (!session || !session.endTime) {
            return res.status(404).json({ message: 'Result not found or exam not completed' });
        }

        const score = session.score ?? 0;
        const passMark = session.quiz.passMark ?? 50;
        const status = session.manualStatus || (score >= passMark ? 'Cleared' : 'Not Cleared');

        res.json({
            id: session.id,
            candidateName: session.user.name,
            church: session.user.church,
            association: session.user.association,
            userType: session.user.userType,
            examTitle: session.quiz.title,
            score: session.score,
            completedAt: session.endTime,
            status
        });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
