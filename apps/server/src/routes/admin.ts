import { Router } from 'express';
import { prisma, UserType } from 'database';
import { authenticate, authorizeAdmin, AuthRequest } from '../middlewares/auth';
import * as xlsx from 'xlsx';
import { ReportGenerator } from '../services/reportGenerator';
import { emitNotification } from '../services/socketService';

const router = Router();

// Admin: Get analytics data
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

// Admin: Get global statistics
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

// Admin: Export formatted exam report to Excel
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

// Admin: Export exam report to PDF
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

// Admin: Get all candidate results
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

export default router;


// Admin: Manually trigger email sending for pending results
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
        console.error('[ADMIN] Error triggering emails:', error);
        res.status(500).json({ message: 'Failed to trigger emails' });
    }
});

// Admin: Update manual status for a quiz session
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

// Admin: Manually release results for specific sessions
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

// Admin: Manually release all results for a specific quiz
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
