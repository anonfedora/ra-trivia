import { Router } from 'express';
import { prisma } from 'database';
import { authenticate, authorizeAdmin, AuthRequest } from '../middlewares/auth';
import * as xlsx from 'xlsx';

const router = Router();

// Admin: Get all candidate results
router.get('/results', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
    try {
        const results = await prisma.quizSession.findMany({
            include: {
                user: {
                    select: { name: true, church: true, email: true }
                },
                quiz: {
                    select: { title: true }
                }
            },
            orderBy: { startTime: 'desc' }
        });
        res.json(results);
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
            Score: r.score !== null ? `${r.score.toFixed(1)}%` : 'N/A',
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
