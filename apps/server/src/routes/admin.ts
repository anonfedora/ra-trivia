import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, authorizeAdmin, AuthRequest } from '../middlewares/auth';
import * as xlsx from 'xlsx';

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
            const averageScore = completedSessions.length > 0 
                ? completedSessions.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / completedSessions.length 
                : 0;
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

// Admin: Export quiz report
router.get('/export/:quizId', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const { quizId } = req.params;
        
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

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="quiz-report-${quizId}.xlsx"`);
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

        const where: any = {};

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

        res.json({ items, total, page, pageSize });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Admin: Export results to Excel
router.get('/export/excel', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const results = await prisma.quizSession.findMany({
            where: { endTime: { not: null } }, // Only export completed sessions
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
        res.setHeader('Content-Disposition', 'attachment; filename="exam_results.xlsx"');
        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
