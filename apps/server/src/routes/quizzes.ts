import { Router } from 'express';
import { prisma, UserType } from 'database';
import { authenticate, AuthRequest, authorize } from '../middlewares/auth';
import { validateQuizListAccess, validateUserTypeAccess } from '../middlewares/userTypeAccess';
import { emitNotification } from '../services/socketService';
import { sendExamNotificationEmail } from '../services/email';
import { auditService } from '../services/auditService';

const router = Router();

// Get all quizzes
// Super Admin gets all, Admin gets only their created quizzes, Candidates get only active ones with matching question types
/**
 * @openapi
 * /quizzes:
 *   get:
 *     tags: [Admin Quizzes]
 *     summary: List all available quizzes
 *     description: Returns quizzes filtered by role and exam type. Candidates only see active exams matching their type.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: activeOnly
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of quizzes
 */
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
/**
 * @openapi
 * /quizzes/{id}:
 *   get:
 *     tags: [Quiz Details]
 *     summary: Get quiz instructions and metadata
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
 *         description: Quiz details
 */
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
/**
 * @openapi
 * /quizzes/{id}/preview:
 *   get:
 *     tags: [Admin Quizzes]
 *     summary: Preview quiz with questions (Admins only)
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
 *         description: Quiz with question list
 */
router.get('/:id/preview', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req: AuthRequest, res) => {
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
                        correctOption: true, // Include correct option for admin preview
                        format: true, // Include format to distinguish MCQ/FITG
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
/**
 * @openapi
 * /quizzes:
 *   post:
 *     tags: [Admin Quizzes]
 *     summary: Create a new quiz
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, duration]
 *             properties:
 *               title:
 *                 type: string
 *               duration:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Quiz created
 */
router.post('/', authenticate, authorize(['ADMIN']), async (req: AuthRequest, res) => {
    try {
        const { title, duration, passMark, examCode, resultsDisplayMode } = req.body;

        if (!title || !duration) {
            return res.status(400).json({ message: 'Title and duration are required' });
        }

        const quiz = await prisma.quiz.create({
            data: {
                title,
                duration: Number(duration),
                passMark: passMark !== undefined ? Number(passMark) : 50,
                examCode: examCode || null,
                resultsDisplayMode: resultsDisplayMode || 'DETAILED',
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
/**
 * @openapi
 * /quizzes/{id}:
 *   patch:
 *     tags: [Admin Quizzes]
 *     summary: Update quiz metadata
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               duration:
 *                 type: integer
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               retakeLimit:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Quiz updated
 */
router.patch('/:id', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req: AuthRequest, res) => {
    try {
        const id = req.params.id as string;
        const { title, duration, startDate, endDate, retakeLimit, passMark, examCode, resultsDisplayMode } = req.body;
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

        const parsedPassMark = passMark !== undefined ? Number(passMark) : undefined;
        if (parsedPassMark !== undefined && (!Number.isFinite(parsedPassMark) || parsedPassMark < 1 || parsedPassMark > 100)) {
            return res.status(400).json({ message: 'Pass mark must be between 1 and 100' });
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
                ...(passMark !== undefined ? { passMark: parsedPassMark } : {}),
                ...(startDate !== undefined ? { startDate: parsedStartDate ?? null } : {}),
                ...(endDate !== undefined ? { endDate: parsedEndDate ?? null } : {}),
                ...(examCode !== undefined ? { examCode: examCode || null } : {}),
                ...(resultsDisplayMode !== undefined ? { resultsDisplayMode } : {})
            }
        });

        // Audit quiz update
        await auditService.logFromRequest(req, 'QUIZ_UPDATED', undefined, { 
            quizId: id, 
            title: updatedQuiz.title 
        });

        res.json(updatedQuiz);
    } catch (error) {
        console.error('[QUIZ_UPDATE_ERROR]', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Toggle quiz activity (Admin only)
/**
 * @openapi
 * /quizzes/{id}/toggle:
 *   patch:
 *     tags: [Admin Quizzes]
 *     summary: Toggle quiz activity status
 *     description: Activates or deactivates an exam. Activation triggers notifications to eligible candidates.
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
 *         description: Status updated
 */
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

        // Audit quiz toggle
        await auditService.logFromRequest(req, 'QUIZ_TOGGLED', undefined, { 
            quizId: id, 
            title: updatedQuiz.title,
            isActive: newIsActive
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
                    const notifData = candidates.map(c => ({
                        type: 'NEW_EXAM_AVAILABLE',
                        title: 'New Exam Available',
                        message: `A new exam "${quiz.title}" is now available for you to take.`,
                        quizId: id,
                        isRead: false,
                        createdById: c.id,
                    }));
                    await prisma.notification.createMany({ data: notifData });

                    // Emit real-time notification to each candidate
                    for (const notif of notifData) {
                        emitNotification(notif.createdById, { ...notif, createdAt: new Date().toISOString() });
                    }
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
/**
 * @openapi
 * /quizzes/{id}:
 *   delete:
 *     tags: [Admin Quizzes]
 *     summary: Delete a quiz and its data
 *     description: PERMANENTLY removes the quiz, all its questions, and all attempt history. Cascade delete enabled.
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
 *         description: Quiz deleted
 */
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

        // Audit quiz deletion
        await auditService.logFromRequest(req, 'QUIZ_DELETED', undefined, { 
            quizId: id, 
            title: quiz.title 
        });

        res.json({ message: 'Quiz deleted successfully' });
    } catch (error) {
        console.error('[QUIZ_DELETE_ERROR]', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /quizzes/{id}/notify:
 *   post:
 *     tags: [Quizzes]
 *     summary: Send exam notifications to relevant candidates
 *     security:
 *       - BearerAuth: []
 */
router.post('/:id/notify', authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), async (req: AuthRequest, res) => {
    try {
        const quizId = req.params.id as string;
        const userRole = req.user?.role;
        const adminId = req.user?.userId;

        // 1. Fetch quiz details
        const quiz = await prisma.quiz.findUnique({
            where: { id: quizId },
            include: {
                questions: {
                    select: { questionType: true },
                    take: 1
                }
            }
        });

        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        if (userRole === 'ADMIN' && quiz.createdById !== adminId) {
            return res.status(403).json({ message: 'You can only send notifications for quizzes you created' });
        }

        if (!quiz.startDate) {
            return res.status(400).json({ message: 'Quiz must have a start date to send notifications' });
        }

        // 2. Identify target user types based on questions in the quiz
        const questionTypes = await prisma.question.findMany({
            where: { quizId },
            select: { questionType: true },
            distinct: ['questionType']
        });

        if (questionTypes.length === 0) {
            return res.status(400).json({ message: 'Cannot send notifications for an empty quiz' });
        }

        const targetUserTypes = questionTypes.map(q => q.questionType) as UserType[];

        // 3. Find candidates matching those user types
        const candidates = await prisma.user.findMany({
            where: {
                role: 'CANDIDATE',
                userType: { in: targetUserTypes }
            },
            select: { id: true, email: true, name: true }
        });

        if (candidates.length === 0) {
            return res.json({ message: 'No candidates found for this exam category', sentCount: 0 });
        }

        // 4. Send Notifications (In-app and Email)
        let successCount = 0;
        const notificationPromises = candidates.map(async (candidate) => {
            try {
                // A. Create In-App Notification
                const notification = await prisma.notification.create({
                    data: {
                        userId: candidate.id,
                        quizId: quizId,
                        type: 'NEW_EXAM_AVAILABLE',
                        title: `Upcoming Exam: ${quiz.title}`,
                        message: `An exam is scheduled for ${new Date(quiz.startDate!).toLocaleString()}. ${quiz.examCode ? `Access Code: ${quiz.examCode}` : ''}`,
                        isRead: false,
                        createdById: adminId // Store who sent it
                    }
                });

                // B. Emit real-time socket notification
                emitNotification(candidate.id, notification);

                // C. Send Email
                const emailSuccess = await sendExamNotificationEmail(
                    candidate.email,
                    candidate.name,
                    quiz.title,
                    quiz.startDate!.toISOString(),
                    quiz.examCode
                );

                if (emailSuccess) successCount++;
            } catch (err) {
                console.error(`[NOTIFY] Failed to notify user ${candidate.email}:`, err);
            }
        });

        await Promise.all(notificationPromises);

        res.json({ 
            message: `Notifications sent successfully to ${candidates.length} candidates.`,
            sentCount: candidates.length,
            emailSuccessCount: successCount
        });

    } catch (error) {
        console.error('Notify candidates error:', error);
        res.status(500).json({ message: 'Failed to send notifications' });
    }
});

export default router;
