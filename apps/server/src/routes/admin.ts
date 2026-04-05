import { Router } from 'express';
import { prisma, UserType } from 'database';
import { authenticate, authorizeAdmin, AuthRequest } from '../middlewares/auth';
import * as xlsx from 'xlsx';
import { ReportGenerator } from '../services/reportGenerator';
import { emitNotification } from '../services/socketService';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import multer from 'multer';
import { sendBulkWelcomeEmail, generateOTP } from '../services/email';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

/**
 * @openapi
 * /admin/analytics:
 *   get:
 *     tags: [Admin Analytics]
 *     summary: Get analytics data for quizzes
 *     description: Returns performance metrics for all quizzes (Super Admin) or just created quizzes (Admin).
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of quiz metrics
 */
router.get('/analytics', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const userRole = req.user?.role;

        // For SUPER_ADMIN, get all quizzes. For regular ADMIN, get only their created quizzes
        const whereClause: any = userRole === 'SUPER_ADMIN' ? {} : {
            createdById: req.user?.userId
        };

        // Get all quizzes with performance metrics
        const quizzes = await prisma.quiz.findMany({
            where: whereClause,
            include: {
                _count: {
                    select: { questions: true }
                },
                sessions: {
                    where: { endTime: { not: null } },
                    select: {
                        score: true,
                        startTime: true,
                        endTime: true
                    }
                }
            }
        });

        const analytics = quizzes.map((quiz: any) => {
            const sessions = quiz.sessions || [];
            const completedSessions = sessions.filter((s: any) => s.endTime !== null);
            const totalAttempts = sessions.length;
            const completedScores = completedSessions.map((s: any) => s.score || 0);

            const averageScore = completedSessions.length > 0
                ? completedScores.reduce((sum: number, score: number) => sum + score, 0) / completedSessions.length
                : 0;

            const passCount = completedScores.filter((s: number) => s >= 50).length;
            const failCount = completedScores.length - passCount;
            const highestScore = completedScores.length > 0 ? Math.max(...completedScores) : 0;
            const lowestScore = completedScores.length > 0 ? Math.min(...completedScores) : 0;

            const completionRate = totalAttempts > 0 ? (completedSessions.length / totalAttempts) * 100 : 0;
            const averageTime = completedSessions.length > 0
                ? completedSessions.reduce((sum: number, s: any) => {
                    const duration = new Date(s.endTime!).getTime() - new Date(s.startTime).getTime();
                    return sum + duration;
                }, 0) / completedSessions.length / (1000 * 60) // Convert to minutes
                : 0;

            return {
                id: quiz.id,
                title: quiz.title,
                totalAttempts,
                passCount,
                failCount,
                highestScore: Math.round(highestScore * 100) / 100,
                lowestScore: Math.round(lowestScore * 100) / 100,
                averageScore: Math.round(averageScore * 100) / 100,
                completionRate: Math.round(completionRate * 100) / 100,
                averageTime: Math.round(averageTime * 100) / 100
            };
        });

        res.json(analytics);
    } catch (error) {
        console.error('Analytics fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch analytics' });
    }
});

/**
 * @openapi
 * /admin/global-stats:
 *   get:
 *     tags: [Admin Analytics]
 *     summary: Get platform-wide global statistics
 *     description: Aggregated counts and averages for quizzes, users, and sessions.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Global stats object
 */
router.get('/global-stats', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const [totalQuizzes, totalUsers, totalSessions] = await Promise.all([
            prisma.quiz.count(),
            prisma.user.count(),
            prisma.quizSession.count()
        ]);

        const completedSessions = await prisma.quizSession.count({
            where: { endTime: { not: null } }
        });

        const allScores = await prisma.quizSession.findMany({
            where: { score: { not: null } },
            select: { score: true }
        });

        const averageScore = allScores.length > 0
            ? allScores.reduce((sum, s) => sum + s.score!, 0) / allScores.length
            : 0;

        const globalStats = {
            totalQuizzes,
            totalCandidates: totalUsers,
            totalAttempts: totalSessions,
            averageScore: Math.round(averageScore * 100) / 100
        };

        res.json(globalStats);
    } catch (error) {
        console.error('Global stats fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch global statistics' });
    }
});

/**
 * @openapi
 * /admin/export/formatted-excel:
 *   get:
 *     tags: [Admin Export]
 *     summary: Export formatted Excel report
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *       - in: query
 *         name: quizId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Excel file buffer
 */
router.get('/export/formatted-excel', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const userType = req.query.userType as UserType | undefined;
        const quizId = req.query.quizId as string | undefined;
        const createdById = req.user?.role === 'ADMIN' ? req.user.userId : undefined;

        const { buffer, filename } = await ReportGenerator.generateExcelReport(userType, quizId, createdById);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        console.error('Formatted Excel export error:', error);
        res.status(500).json({ message: 'Failed to generate formatted Excel report' });
    }
});

/**
 * @openapi
 * /admin/export/pdf:
 *   get:
 *     tags: [Admin Export]
 *     summary: Export PDF exam report
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userType
 *         schema:
 *           type: string
 *       - in: query
 *         name: quizId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF file buffer
 */
router.get('/export/pdf', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const userType = req.query.userType as UserType | undefined;
        const quizId = req.query.quizId as string | undefined;
        const createdById = req.user?.role === 'ADMIN' ? req.user.userId : undefined;

        const { buffer, filename } = await ReportGenerator.generatePDFReport(userType, quizId, createdById);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        console.error('PDF export error:', error);
        res.status(500).json({ message: 'Failed to generate PDF report' });
    }
});

// Admin: Export quiz report (specific quiz)
router.get('/export/:quizId', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const quizId = req.params.quizId as string;

        // Check if admin has permission to export this quiz
        if (req.user?.role === 'ADMIN') {
            const quiz = await prisma.quiz.findUnique({
                where: { id: quizId },
                select: { createdById: true }
            });
            
            if (!quiz || quiz.createdById !== req.user.userId) {
                return res.status(403).json({ message: 'You do not have permission to export this quiz' });
            }
        }

        const sessions = await prisma.quizSession.findMany({
            where: {
                quizId,
                endTime: { not: null }
            } as any,
            include: {
                user: {
                    select: { name: true, email: true, church: true }
                },
                quiz: {
                    select: { title: true }
                }
            },
            orderBy: { startTime: 'desc' }
        });

        const data = sessions.map((session: any) => ({
            Candidate: session.user.name,
            Email: session.user.email ?? 'N/A',
            Church: session.user.church ?? 'N/A',
            Exam: session.quiz.title,
            Score: session.score !== null ? `${session.score.toFixed(2)}%` : 'N/A',
            'Started At': new Date(session.startTime).toLocaleString(),
            'Completed At': session.endTime ? new Date(session.endTime).toLocaleString() : 'N/A'
        }));

        const worksheet = xlsx.utils.json_to_sheet(data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Results');

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Create filename with quiz title (replace spaces with underscores)
        const quizTitle = sessions.length > 0 ? sessions[0].quiz.title.replace(/\s+/g, '_').toLowerCase() : 'unknown_quiz';
        const filename = `${quizTitle}_quiz_report.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ message: 'Failed to export report' });
    }
});

/**
 * @openapi
 * /admin/results:
 *   get:
 *     tags: [Admin Results]
 *     summary: Get all candidate results (paginated)
 *     description: Search and filter through all exam sessions across the platform.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, completed, running]
 *     responses:
 *       200:
 *         description: Paginated results with summary data
 */
router.get('/results', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const pageSizeRaw = parseInt(String(req.query.pageSize ?? '25'), 10) || 25;
        const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const status = typeof req.query.status === 'string' ? req.query.status : 'all';

        // Clean up stale sessions before fetching results
        const staleSessionsThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago
        const staleSessions = await prisma.quizSession.findMany({
            where: {
                endTime: null,
                startTime: { lt: staleSessionsThreshold }
            },
            include: {
                quiz: { select: { duration: true } }
            }
        });

        // Mark stale sessions as completed with 0 score
        for (const session of staleSessions) {
            const sessionAge = Date.now() - new Date(session.startTime).getTime();
            const maxSessionTime = (session.quiz.duration + 60) * 60 * 1000; // duration + 1 hour buffer
            
            if (sessionAge > maxSessionTime) {
                console.log(`[ADMIN_RESULTS] Cleaning up stale session ${session.id} (age: ${Math.round(sessionAge / 60000)} minutes)`);
                await prisma.quizSession.update({
                    where: { id: session.id },
                    data: {
                        endTime: new Date(),
                        score: 0
                    }
                });
            }
        }

        const where: any = {};

        // Filter by quiz creator for regular admins
        if (req.user?.role === 'ADMIN') {
            where.quiz = {
                createdById: req.user.userId
            };
        }

        if (status === 'completed') {
            where.endTime = { not: null };
        } else if (status === 'running') {
            where.endTime = null;
        }

        if (q) {
            where.OR = [
                { user: { name: { contains: q, mode: 'insensitive' } } },
                { user: { email: { contains: q, mode: 'insensitive' } } },
                { quiz: { title: { contains: q, mode: 'insensitive' } } }
            ];
        }

        const [total, items] = await prisma.$transaction([
            prisma.quizSession.count({ where }),
            prisma.quizSession.findMany({
                where,
                include: {
                    user: {
                        select: { name: true, church: true, email: true }
                    },
                    quiz: {
                        select: { title: true }
                    }
                },
                orderBy: { startTime: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize
            })
        ]);

        let summary = null;
        if (q) {
            const summaryData = await prisma.quizSession.findMany({
                where: { ...where, endTime: { not: null } },
                select: { score: true }
            });

            if (summaryData.length > 0) {
                const scores = summaryData.map((s: { score: number | null }) => s.score || 0);
                const passCount = scores.filter((s: number) => s >= 50).length;
                const averageScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
                summary = {
                    totalCompleted: summaryData.length,
                    passCount,
                    failCount: summaryData.length - passCount,
                    averageScore: Math.round(averageScore * 100) / 100,
                    highestScore: Math.max(...scores),
                    lowestScore: Math.min(...scores)
                };
            }
        }

        res.json({ items, total, page, pageSize, summary });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Admin: Export results to Excel
router.get('/export/excel', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const where: any = { endTime: { not: null } }; // Only export completed sessions
        
        // Filter by quiz creator for regular admins
        if (req.user?.role === 'ADMIN') {
            where.quiz = {
                createdById: req.user.userId
            };
        }
        
        const results = await prisma.quizSession.findMany({
            where,
            include: {
                user: {
                    select: { name: true, email: true, church: true }
                },
                quiz: {
                    select: { title: true }
                }
            },
            orderBy: { startTime: 'desc' }
        });

        const data = results.map((r: any) => ({
            Candidate: r.user.name,
            Email: r.user.email ?? 'N/A',
            Church: r.user.church ?? 'N/A',
            Exam: r.quiz.title,
            Score: r.score !== null ? `${r.score.toFixed(2)}%` : 'N/A',
            'Started At': new Date(r.startTime).toLocaleString(),
            'Completed At': r.endTime ? new Date(r.endTime).toLocaleString() : 'N/A'
        }));

        const worksheet = xlsx.utils.json_to_sheet(data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Results');

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="all_exams_exam_results.xlsx"');
        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /admin/candidates:
 *   get:
 *     tags: [Admin Candidates]
 *     summary: List all candidates (Super Admin only)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of candidates
 *       403:
 *         description: Super admin access required
 */
router.get('/candidates', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'Forbidden: Super admin access required' });
    }

    try {
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const pageSizeRaw = parseInt(String(req.query.pageSize ?? '25'), 10) || 25;
        const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

        const where: any = { role: 'CANDIDATE' };

        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { church: { contains: q, mode: 'insensitive' } },
            ];
        }

        const [total, candidates] = await prisma.$transaction([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    church: true,
                    association: true,
                    userType: true,
                    createdAt: true,
                    _count: { select: { sessions: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);

        res.json({ items: candidates, total, page, pageSize });
    } catch (error) {
        console.error('Candidates fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch candidates' });
    }
});

// SUPER_ADMIN: full profile. ADMIN: only if candidate attempted one of their quizzes.
router.get('/candidates/:userId', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const userId = req.params.userId as string;
        const requestingRole = req.user?.role;
        const requestingAdminId = req.user?.userId;

        // For regular ADMIN, verify this candidate attempted at least one of their quizzes
        if (requestingRole === 'ADMIN') {
            const hasAccess = await prisma.quizSession.findFirst({
                where: {
                    userId,
                    quiz: { createdById: requestingAdminId },
                },
                select: { id: true },
            });
            if (!hasAccess) {
                return res.status(403).json({ message: 'Forbidden: This candidate has not attempted any of your exams' });
            }
        }

        const candidate = await prisma.user.findUnique({
            where: { id: userId, role: 'CANDIDATE' },
            select: {
                id: true,
                name: true,
                email: true,
                church: true,
                association: true,
                userType: true,
                emailVerified: true,
                createdAt: true,
                sessions: {
                    // ADMIN sees only sessions for their own quizzes; SUPER_ADMIN sees all
                    where: requestingRole === 'ADMIN'
                        ? { quiz: { createdById: requestingAdminId } }
                        : {},
                    orderBy: { startTime: 'desc' },
                    select: {
                        id: true,
                        startTime: true,
                        endTime: true,
                        score: true,
                        manualStatus: true,
                        resultReleasesAt: true,
                        quiz: { select: { id: true, title: true, duration: true } },
                    },
                },
            },
        });

        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        res.json(candidate);
    } catch (error) {
        console.error('Candidate detail fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch candidate' });
    }
});

/**
 * @openapi
 * /admin/my-exam-takers:
 *   get:
 *     tags: [Admin Candidates]
 *     summary: List candidates who attempted admin's quizzes
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of candidates
 */
router.get('/my-exam-takers', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden: Admin access only' });
    }

    try {
        const adminId = req.user.userId;
        const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const pageSizeRaw = parseInt(String(req.query.pageSize ?? '25'), 10) || 25;
        const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
        const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

        // Find distinct users who have sessions on this admin's quizzes
        const sessionWhere: any = {
            quiz: { createdById: adminId },
            user: { role: 'CANDIDATE' },
        };

        if (q) {
            sessionWhere.user.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { church: { contains: q, mode: 'insensitive' } },
            ];
        }

        // Get distinct userIds
        const distinctUsers = await prisma.quizSession.findMany({
            where: sessionWhere,
            select: { userId: true },
            distinct: ['userId'],
        });

        const userIds = distinctUsers.map((s: { userId: string }) => s.userId);
        const total = userIds.length;

        // Paginate
        const pagedIds = userIds.slice((page - 1) * pageSize, page * pageSize);

        const candidates = await prisma.user.findMany({
            where: { id: { in: pagedIds } },
            select: {
                id: true,
                name: true,
                email: true,
                church: true,
                association: true,
                userType: true,
                createdAt: true,
                sessions: {
                    where: { quiz: { createdById: adminId } },
                    select: { id: true },
                },
            },
            orderBy: { name: 'asc' },
        });

        // Map session count
        const items = candidates.map((c: any) => ({
            ...c,
            _count: { sessions: c.sessions.length },
            sessions: undefined,
        }));

        res.json({ items, total, page, pageSize });
    } catch (error) {
        console.error('My exam takers fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch exam takers' });
    }
});

export default router;


/**
 * @openapi
 * /admin/trigger-emails:
 *   post:
 *     tags: [Admin Results]
 *     summary: Manually trigger result emails
 *     description: Forces immediate delivery of pending result notification emails.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Email processing results
 */
router.post('/trigger-emails', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const now = new Date();
        
        // Find sessions that should have been sent but haven't
        const pendingSessions = await prisma.quizSession.findMany({
            where: {
                endTime: { not: null },
                resultReleasesAt: { 
                    not: null,
                    lte: now 
                },
                emailSent: false
            },
            include: {
                user: true,
                quiz: {
                    include: { questions: true }
                }
            }
        });

        if (pendingSessions.length === 0) {
            return res.json({ 
                message: 'No pending emails to send',
                processed: 0,
                failed: 0
            });
        }

        let processedCount = 0;
        let failedCount = 0;
        const results = [];

        for (const session of pendingSessions) {
            try {
                const answers = (session.answers as Record<string, string>) || {};
                const questions = session.quiz.questions;

                const remapRaw = (answers as any).__remap__;
                const remap: Record<string, string> = remapRaw ? JSON.parse(remapRaw) : {};

                let correctCount = 0;
                const answerDetails = questions.map((q: any) => {
                    const selectedOption = answers[q.id];
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

                const score = session.score || 0;

                // Import sendQuizResultEmail dynamically to avoid circular dependency
                const { sendQuizResultEmail } = await import('../services/email');
                const success = await sendQuizResultEmail(
                    session.user.email,
                    session.user.name,
                    score,
                    answerDetails
                );

                if (success) {
                    await prisma.quizSession.update({
                        where: { id: session.id },
                        data: { emailSent: true }
                    });
                    processedCount++;
                    results.push({
                        sessionId: session.id,
                        email: session.user.email,
                        status: 'success'
                    });
                } else {
                    failedCount++;
                    results.push({
                        sessionId: session.id,
                        email: session.user.email,
                        status: 'failed'
                    });
                }
            } catch (err) {
                failedCount++;
                results.push({
                    sessionId: session.id,
                    email: session.user.email,
                    status: 'error',
                    error: err instanceof Error ? err.message : 'Unknown error'
                });
            }
        }

        res.json({
            message: `Processed ${processedCount + failedCount} emails`,
            processed: processedCount,
            failed: failedCount,
            total: pendingSessions.length,
            results
        });
    } catch (error) {
        console.error('Trigger release error:', error);
        res.status(500).json({ message: 'Failed to manually trigger release' });
    }
});

/**
 * @openapi
 * /admin/bulk-candidates:
 *   post:
 *     tags: [Admin Bulk]
 *     summary: Bulk register candidates from Excel
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Bulk registration results
 */
router.post('/bulk-candidates', authenticate, authorizeAdmin, upload.single('file'), async (req: AuthRequest, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet) as any[];

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };

        for (const row of data) {
            try {
                const email = row['Email Address']?.toString().trim();
                const name = row['Full Name']?.toString().trim();
                const church = row['Church']?.toString().trim();
                const association = row['Association']?.toString().trim();
                const rawUserType = row['Examination Type']?.toString().trim();
                const password = row['Password']?.toString().trim();

                if (!email || !name || !password || !rawUserType) {
                    results.failed++;
                    results.errors.push(`Missing required fields for ${email || 'unknown user'}`);
                    continue;
                }

                // Map "Examination Type" to UserType enum
                let userType: UserType;
                const normalizedType = rawUserType.toUpperCase().replace(/\s+/g, '_');
                if (normalizedType.includes('AMBASSADOR')) {
                    userType = 'AMBASSADOR_RANK_EXAMS';
                } else if (normalizedType.includes('EXTRAORDINARY')) {
                    userType = 'EXTRAORDINARY_RANK_EXAMS';
                } else if (normalizedType.includes('PRE_PLENIPOTENTIARY') || normalizedType.includes('PRE-PLENIPOTENTIARY')) {
                    userType = 'PRE_PLENIPOTENTIARY_EXAMS';
                } else if (normalizedType.includes('PLENIPOTENTIARY')) {
                    userType = 'PLENIPOTENTIARY_RANK_EXAMS';
                } else {
                    results.failed++;
                    results.errors.push(`Invalid Examination Type: ${rawUserType} for ${email}`);
                    continue;
                }

                const existingUser = await prisma.user.findUnique({ where: { email } });
                if (existingUser) {
                    results.failed++;
                    results.errors.push(`User already exists: ${email}`);
                    continue;
                }

                const hashedPassword = await bcrypt.hash(password, 12);
                const otp = generateOTP();
                const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
                const otpExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours for bulk imports

                const user = await prisma.user.create({
                    data: {
                        email,
                        name,
                        password: hashedPassword,
                        church: church || null,
                        association: association || null,
                        role: 'CANDIDATE',
                        userType,
                        emailVerified: false,
                        emailOtpHash: otpHash,
                        emailOtpExpiresAt: otpExpiresAt
                    }
                });

                const protocol = (req.header('x-forwarded-proto') || req.protocol || 'http').toString();
                const host = (req.header('x-forwarded-host') || req.get('host') || 'localhost:4000').toString();
                const frontendUrl = WEB_URL || `${protocol}://${host.replace('4000', '3000')}`;
                const verifyUrl = `${frontendUrl}/verify-otp?email=${encodeURIComponent(email)}`;

                await sendBulkWelcomeEmail(
                    email,
                    name,
                    password,
                    church || 'N/A',
                    association || 'N/A',
                    userType,
                    verifyUrl,
                    otp
                );

                results.success++;
            } catch (err: any) {
                results.failed++;
                results.errors.push(`Error registering ${row['Email Address']}: ${err.message}`);
            }
        }

        res.json({
            message: `Bulk registration completed: ${results.success} succeeded, ${results.failed} failed.`,
            ...results
        });
    } catch (error) {
        console.error('Bulk registration error:', error);
        res.status(500).json({ message: 'Bulk registration failed' });
    }
});

/**
 * @openapi
 * /admin/sessions/{sessionId}/status:
 *   patch:
 *     tags: [Admin Results]
 *     summary: Update manual session status
 *     parameters:
 *       - in: path
 *         name: sessionId
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
 *               manualStatus:
 *                 type: string
 *                 nullable: true
 *                 enum: [Cleared, Not Cleared - No Certificates]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/sessions/:sessionId/status', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const sessionId = req.params.sessionId as string;
        const { manualStatus } = req.body;

        // Validate manualStatus
        if (manualStatus !== null && manualStatus !== 'Cleared' && manualStatus !== 'Not Cleared - No Certificates') {
            return res.status(400).json({ message: 'Invalid status. Must be "Cleared", "Not Cleared - No Certificates", or null' });
        }

        const updatedSession = await prisma.quizSession.update({
            where: { id: sessionId },
            data: { manualStatus } as any // Type assertion until schema is pushed
        });

        res.json({ message: 'Status updated successfully', session: updatedSession });
    } catch (error) {
        console.error('Status update error:', error);
        res.status(500).json({ message: 'Failed to update status' });
    }
});

/**
 * @openapi
 * /admin/sessions/release:
 *   post:
 *     tags: [Admin Results]
 *     summary: Bulk release results
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionIds]
 *             properties:
 *               sessionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Results released
 */
router.post('/sessions/release', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const { sessionIds } = req.body;

        if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
            return res.status(400).json({ message: 'sessionIds must be a non-empty array' });
        }

        // Fetch sessions with user + quiz info before updating
        const sessions = await prisma.quizSession.findMany({
            where: { id: { in: sessionIds } },
            include: { user: true, quiz: { select: { title: true } } }
        });

        // Set resultReleasesAt to now for all specified sessions
        const updated = await prisma.quizSession.updateMany({
            where: { id: { in: sessionIds } },
            data: { resultReleasesAt: new Date() }
        });

        // Notify each candidate their result is ready
        if (sessions.length > 0) {
            const notifData = sessions.map(s => ({
                type: 'RESULT_RELEASED',
                title: 'Your Result is Ready',
                message: `Your result for "${s.quiz.title}" has been released. Check your results now.`,
                quizId: s.quizId,
                sessionId: s.id,
                isRead: false,
                createdById: s.userId,
            }));
            await prisma.notification.createMany({ data: notifData });
            for (const notif of notifData) {
                emitNotification(notif.createdById, { ...notif, createdAt: new Date().toISOString() });
            }
        }

        res.json({ message: `Released ${updated.count} result(s) successfully`, count: updated.count });
    } catch (error) {
        console.error('Result release error:', error);
        res.status(500).json({ message: 'Failed to release results' });
    }
});

/**
 * @openapi
 * /admin/quizzes/{quizId}/release-all:
 *   post:
 *     tags: [Admin Results]
 *     summary: Release all results for a quiz
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: All results released
 */
router.post('/quizzes/:quizId/release-all', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const quizId = req.params.quizId as string;

        // Fetch sessions before updating so we have user info
        const sessions = await prisma.quizSession.findMany({
            where: { quizId, endTime: { not: null } },
            include: { user: true, quiz: { select: { title: true } } }
        });

        // Set resultReleasesAt to now for all sessions of this quiz
        const updated = await prisma.quizSession.updateMany({
            where: { quizId, endTime: { not: null } },
            data: { resultReleasesAt: new Date() }
        });

        // Notify each candidate
        if (sessions.length > 0) {
            const notifData = sessions.map(s => ({
                type: 'RESULT_RELEASED',
                title: 'Your Result is Ready',
                message: `Your result for "${s.quiz.title}" has been released. Check your results now.`,
                quizId: s.quizId,
                sessionId: s.id,
                isRead: false,
                createdById: s.userId,
            }));
            await prisma.notification.createMany({ data: notifData });
            for (const notif of notifData) {
                emitNotification(notif.createdById, { ...notif, createdAt: new Date().toISOString() });
            }
        }

        res.json({ message: `Released ${updated.count} result(s) for this quiz`, count: updated.count });
    } catch (error) {
        console.error('Quiz result release error:', error);
        res.status(500).json({ message: 'Failed to release quiz results' });
    }
});
