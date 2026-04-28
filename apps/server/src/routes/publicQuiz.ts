import { Router } from 'express';
import { prisma } from 'database';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middlewares/errorHandler';
import crypto from 'crypto';

const router = Router();

/**
 * @openapi
 * /public-quiz:
 *   get:
 *     tags: [Public Quiz]
 *     summary: Get all available public quizzes
 *     description: Returns list of active public quizzes for users to try. No authentication required.
 *     responses:
 *       200:
 *         description: List of public quizzes
 */
router.get('/', async (req, res) => {
  try {
    const publicQuizzes = await prisma.publicQuiz.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        createdAt: true,
        _count: {
          select: {
            questions: true,
            attempts: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(publicQuizzes);
  } catch (error) {
    console.error('[PUBLIC_QUIZ] List error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /public-quiz/{quizId}:
 *   get:
 *     tags: [Public Quiz]
 *     summary: Get public quiz details with questions
 *     description: Returns quiz details and questions for starting a public quiz attempt.
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz details with questions
 *       404:
 *         description: Quiz not found or inactive
 */
router.get('/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;

    const quiz = await prisma.publicQuiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          select: {
            id: true,
            text: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            format: true
            // Note: We don't include correctOption or correctAnswer for security
          }
        }
      }
    });

    if (!quiz || !quiz.isActive) {
      return res.status(404).json({ message: 'Quiz not found or inactive' });
    }

    // Shuffle questions for fairness
    const shuffledQuestions = [...quiz.questions].sort(() => Math.random() - 0.5);

    // For MCQ questions, shuffle options
    const processedQuestions = shuffledQuestions.map(question => {
      if (question.format === 'MULTIPLE_CHOICE') {
        const options = [
          { key: 'A', text: question.optionA },
          { key: 'B', text: question.optionB },
          { key: 'C', text: question.optionC },
          { key: 'D', text: question.optionD }
        ].filter(opt => opt.text); // Remove empty options

        // Shuffle options
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [options[i], options[j]] = [options[j], options[i]];
        }

        // Remap keys
        const positionLabels = ['A', 'B', 'C', 'D'];
        const remappedOptions = options.map((opt, index) => ({
          originalKey: opt.key,
          key: positionLabels[index],
          text: opt.text
        }));

        return {
          ...question,
          randomizedOptions: remappedOptions,
          optionA: undefined,
          optionB: undefined,
          optionC: undefined,
          optionD: undefined
        };
      }

      return {
        ...question,
        randomizedOptions: []
      };
    });

    const responseQuiz = {
      ...quiz,
      questions: processedQuestions
    };

    res.json(responseQuiz);
  } catch (error) {
    console.error('[PUBLIC_QUIZ] Get details error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /public-quiz/start:
 *   post:
 *     tags: [Public Quiz]
 *     summary: Start a new public quiz attempt
 *     description: Creates a new session for attempting a public quiz.
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
 *               playerName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Quiz attempt started
 *       404:
 *         description: Quiz not found or inactive
 */
router.post('/start', [
  body('quizId').notEmpty().withMessage('Quiz ID is required'),
  body('playerName').optional().trim().isLength({ max: 100 }).withMessage('Player name must not exceed 100 characters')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { quizId, playerName } = req.body;

    const quiz = await prisma.publicQuiz.findUnique({
      where: { id: quizId as string }
    });

    if (!quiz || !quiz.isActive) {
      return res.status(404).json({ message: 'Quiz not found or inactive' });
    }

    // Generate unique session ID
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Create new attempt
    const attempt = await prisma.publicAttempt.create({
      data: {
        sessionId,
        playerName: playerName || 'Anonymous Player',
        publicQuizId: quizId,
        answers: {}
      }
    });

    res.status(201).json({
      sessionId: attempt.sessionId,
      playerName: attempt.playerName,
      startTime: attempt.startTime,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        category: quiz.category,
        description: quiz.description
      }
    });
  } catch (error) {
    console.error('[PUBLIC_QUIZ] Start attempt error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /public-quiz/submit:
 *   post:
 *     tags: [Public Quiz]
 *     summary: Submit public quiz attempt
 *     description: Submits answers and calculates score for a public quiz attempt.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, answers]
 *             properties:
 *               sessionId:
 *                 type: string
 *               answers:
 *                 type: object
 *                 description: Object mapping question IDs to selected answers
 *     responses:
 *       200:
 *         description: Quiz submitted successfully
 *       404:
 *         description: Session not found
 *       400:
 *         description: Quiz already submitted
 */
router.post('/submit', [
  body('sessionId').notEmpty().withMessage('Session ID is required'),
  body('answers').isObject().withMessage('Answers must be an object')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { sessionId, answers } = req.body;

    const attempt = await prisma.publicAttempt.findUnique({
      where: { sessionId },
      include: {
        publicQuiz: {
          include: { questions: true }
        }
      }
    });

    if (!attempt) {
      return res.status(404).json({ message: 'Session not found' });
    }

    if (attempt.endTime) {
      return res.status(400).json({ message: 'Quiz already submitted' });
    }

    const questions = attempt.publicQuiz.questions;
    let correctCount = 0;
    const questionResults = [];

    // Process each answer
    for (const question of questions) {
      const userAnswer = answers[question.id];
      let isCorrect = false;
      let correctAnswer = '';

      if (question.format === 'MULTIPLE_CHOICE') {
        correctAnswer = question.correctOption || '';
        isCorrect = userAnswer === correctAnswer;
      } else if (question.format === 'FILL_IN_THE_GAP') {
        correctAnswer = question.correctAnswer || '';
        // Case-insensitive comparison for fill-in-the-gap
        isCorrect = userAnswer && 
                    userAnswer.toString().toLowerCase().trim() === 
                    correctAnswer.toLowerCase().trim();
      }

      if (isCorrect) {
        correctCount++;
      }

      // Create question attempt record
      await prisma.publicQuestionAttempt.create({
        data: {
          publicAttemptId: attempt.id,
          publicQuestionId: question.id,
          selectedOption: question.format === 'MULTIPLE_CHOICE' ? userAnswer : null,
          textAnswer: question.format === 'FILL_IN_THE_GAP' ? userAnswer : null,
          isCorrect
        }
      });

      questionResults.push({
        questionId: question.id,
        questionText: question.text,
        userAnswer,
        correctAnswer,
        isCorrect
      });
    }

    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100 * 100) / 100 : 0;

    // Update attempt with results
    const updatedAttempt = await prisma.publicAttempt.update({
      where: { sessionId },
      data: {
        endTime: new Date(),
        score,
        answers
      }
    });

    // Calculate time taken
    const timeTaken = Math.round((new Date(updatedAttempt.endTime!).getTime() - new Date(updatedAttempt.startTime).getTime()) / 1000);

    res.json({
      sessionId: attempt.sessionId,
      playerName: attempt.playerName,
      score,
      totalQuestions: questions.length,
      correctCount,
      incorrectCount: questions.length - correctCount,
      timeTaken,
      startTime: attempt.startTime,
      endTime: updatedAttempt.endTime,
      questionResults,
      quiz: {
        id: attempt.publicQuiz.id,
        title: attempt.publicQuiz.title,
        category: attempt.publicQuiz.category
      }
    });
  } catch (error) {
    console.error('[PUBLIC_QUIZ] Submit error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /public-quiz/results/{sessionId}:
 *   get:
 *     tags: [Public Quiz]
 *     summary: Get public quiz results
 *     description: Returns detailed results for a completed public quiz attempt.
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz results
 *       404:
 *         description: Session not found or not completed
 */
router.get('/results/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const attempt = await prisma.publicAttempt.findUnique({
      where: { sessionId },
      include: {
        publicQuiz: {
          include: { questions: true }
        },
        questionAttempts: {
          include: {
            publicQuestion: true
          }
        }
      }
    });

    if (!attempt || !attempt.endTime) {
      return res.status(404).json({ message: 'Session not found or not completed' });
    }

    // Calculate time taken
    const timeTaken = Math.round((new Date(attempt.endTime).getTime() - new Date(attempt.startTime).getTime()) / 1000);

    const detailedResults = attempt.questionAttempts.map(qa => ({
      questionId: qa.publicQuestion.id,
      questionText: qa.publicQuestion.text,
      format: qa.publicQuestion.format,
      userAnswer: qa.selectedOption || qa.textAnswer,
      correctAnswer: qa.publicQuestion.correctOption || qa.publicQuestion.correctAnswer,
      isCorrect: qa.isCorrect
    }));

    res.json({
      sessionId: attempt.sessionId,
      playerName: attempt.playerName,
      score: attempt.score,
      totalQuestions: attempt.publicQuiz.questions.length,
      correctCount: detailedResults.filter(r => r.isCorrect).length,
      incorrectCount: detailedResults.filter(r => !r.isCorrect).length,
      timeTaken,
      startTime: attempt.startTime,
      endTime: attempt.endTime,
      quiz: {
        id: attempt.publicQuiz.id,
        title: attempt.publicQuiz.title,
        category: attempt.publicQuiz.category
      },
      questionResults: detailedResults
    });
  } catch (error) {
    console.error('[PUBLIC_QUIZ] Get results error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @openapi
 * /public-quiz/leaderboard/{quizId}:
 *   get:
 *     tags: [Public Quiz]
 *     summary: Get leaderboard for a public quiz
 *     description: Returns top scores for a specific public quiz.
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Leaderboard data
 *       404:
 *         description: Quiz not found
 */
router.get('/leaderboard/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    const quiz = await prisma.publicQuiz.findUnique({
      where: { id: quizId }
    });

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const leaderboard = await prisma.publicAttempt.findMany({
      where: {
        publicQuizId: quizId,
        endTime: { not: null }
      },
      select: {
        sessionId: true,
        playerName: true,
        score: true,
        startTime: true,
        endTime: true
      },
      orderBy: [
        { score: 'desc' },
        { endTime: 'asc' } // Earlier completion breaks ties
      ],
      take: limit
    });

    const leaderboardWithTime = leaderboard.map((entry, index) => ({
      rank: index + 1,
      sessionId: entry.sessionId,
      playerName: entry.playerName,
      score: entry.score,
      timeTaken: Math.round((new Date(entry.endTime!).getTime() - new Date(entry.startTime).getTime()) / 1000),
      completedAt: entry.endTime
    }));

    res.json({
      quizId: quiz.id,
      quizTitle: quiz.title,
      category: quiz.category,
      leaderboard: leaderboardWithTime
    });
  } catch (error) {
    console.error('[PUBLIC_QUIZ] Leaderboard error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
