import { Router } from 'express';
import { prisma, UserType } from 'database';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { authenticate, authorizeAdmin } from '../middlewares/auth';
import { auditService } from '../services/auditService';

// Define locally to avoid linter errors while types catch up
type QuestionFormat = 'MULTIPLE_CHOICE' | 'FILL_IN_THE_GAP';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow Excel files
        const allowedMimes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'));
        }
    }
});

/**
 * @openapi
 * /questions/templates/{format}:
 *   get:
 *     tags: [Admin Questions]
 *     summary: Download Excel template for questions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [MULTIPLE_CHOICE, FILL_IN_THE_GAP]
 *     responses:
 *       200:
 *         description: Excel template file
 */
router.get('/templates/:format', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const format = req.params.format as QuestionFormat;
        let data: any[] = [];
        let filename = '';

        if (format === 'MULTIPLE_CHOICE') {
            data = [
                {
                    'Question': 'Example: What is the capital of Nigeria?',
                    'Option A': 'Lagos',
                    'Option B': 'Abuja',
                    'Option C': 'Kano',
                    'Option D': 'Ibadan',
                    'Correct Option': 'B'
                }
            ];
            filename = 'mcq_template.xlsx';
        } else if (format === 'FILL_IN_THE_GAP') {
            data = [
                {
                    'Question': 'Example: The capital of Nigeria is ___.',
                    'Correct Answer': 'Abuja'
                },
                {
                    'Question': 'Example: ___ is the largest city in Nigeria.',
                    'Correct Answer': 'Lagos'
                }
            ];
            filename = 'fitg_template.xlsx';
        } else {
            return res.status(400).json({ message: 'Invalid format' });
        }

        const worksheet = xlsx.utils.json_to_sheet(data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Template');

        // Set column widths
        const wscols = [
            { wch: 50 }, // Question
            { wch: 20 }, // Option A / Correct Answer
            { wch: 20 }, // Option B
            { wch: 20 }, // Option C
            { wch: 20 }, // Option D
            { wch: 15 }, // Correct Option
        ];
        worksheet['!cols'] = wscols;

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        console.error('Template generation error:', error);
        res.status(500).json({ message: 'Failed to generate template' });
    }
});

/**
 * @openapi
 * /questions/import:
 *   post:
 *     tags: [Admin Questions]
 *     summary: Import questions from Excel
 *     description: Upload an Excel file containing questions. Can create a new quiz or add to an existing one.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, questionType]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               quizId:
 *                 type: string
 *               title:
 *                 type: string
 *               duration:
 *                 type: string
 *               format:
 *                 type: string
 *                 enum: [MULTIPLE_CHOICE, FILL_IN_THE_GAP]
 *               questionType:
 *                 type: string
 *                 enum: [AMBASSADOR_RANK_EXAMS, EXTRAORDINARY_RANK_EXAMS, PRE_PLENIPOTENTIARY_RANK_EXAMS, PLENIPOTENTIARY_RANK_EXAMS]
 *     responses:
 *       201:
 *         description: Questions imported
 */
router.post('/import', authenticate, authorizeAdmin, upload.single('file'), async (req: any, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        let quizId = req.body.quizId;
        const title = req.body.title;
        const duration = req.body.duration;
        const passMark = req.body.passMark;
        const examCode = req.body.examCode;
        const questionType = req.body.questionType;
        const format = (req.body.format as QuestionFormat) || 'MULTIPLE_CHOICE';

        // Validate questionType is provided and valid
        if (!questionType) {
            return res.status(400).json({ message: 'Question type is required' });
        }

        const validUserTypes = Object.values(UserType);
        if (!validUserTypes.includes(questionType)) {
            return res.status(400).json({ 
                message: 'Invalid question type. Must be one of: ' + validUserTypes.join(', ')
            });
        }

        if (!quizId) {
            if (!title || !duration) {
                return res.status(400).json({ message: 'Quiz ID or Title/Duration are required' });
            }
            console.log(`[IMPORT] Creating new quiz: ${title}`);
            // Create new quiz with createdById
            const newQuiz = await prisma.quiz.create({
                data: {
                    title: String(title),
                    duration: Number(duration),
                    passMark: passMark ? Number(passMark) : 50,
                    examCode: examCode || null,
                    isActive: false,
                    createdById: req.user?.userId // Associate quiz with creator
                }
            });
            console.log(`[IMPORT] Created new quiz with ID: ${newQuiz.id}`);
            quizId = newQuiz.id;
        } else {
            console.log(`[IMPORT] targetting existing quiz ID: ${quizId}`);
            // Update passMark if provided even for existing quiz
            if (passMark) {
                await prisma.quiz.update({
                    where: { id: quizId },
                    data: { passMark: Number(passMark) }
                });
            }
        }

        const workbook = xlsx.read(req.file.buffer);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'The uploaded file is empty' });
        }

        // Helper to find value from row with flexible keys
        const getVal = (row: any, keys: string[]) => {
            const rowKeys = Object.keys(row);
            for (const key of keys) {
                const foundKey = rowKeys.find(rk => rk.toLowerCase().trim() === key.toLowerCase());
                if (foundKey) return row[foundKey];
            }
            return null;
        };

        const questionsData = [];
        for (const row of (data as any[])) {
            const text = getVal(row, ['Question', 'text', 'Questions']);
            
            if (format === 'FILL_IN_THE_GAP') {
                const correctOptionValue = getVal(row, ['Correct Answer', 'Answer', 'Correct']);
                if (!text || !correctOptionValue) {
                    console.log(`[IMPORT] Skipping FITG row: ${JSON.stringify(row)}`);
                    continue;
                }
                questionsData.push({
                    text: String(text).trim(),
                    correctOption: String(correctOptionValue).trim(),
                    format: 'FILL_IN_THE_GAP' as QuestionFormat,
                    questionType: questionType,
                    quizId
                });
            } else {
                const optionA = getVal(row, ['Option A', 'option a', 'A']);
                const optionB = getVal(row, ['Option B', 'option b', 'B']);
                const optionC = getVal(row, ['Option C', 'option c', 'C']);
                const optionD = getVal(row, ['Option D', 'option d', 'D']);
                const correctOptionValue = getVal(row, ['Correct Option', 'right option', 'Answer', 'Correct']);

                if (!text || !optionA || !optionB || !correctOptionValue) {
                    console.log(`[IMPORT] Skipping MCQ row: ${JSON.stringify(row)}`);
                    continue;
                }

                questionsData.push({
                    text: String(text).trim(),
                    optionA: String(optionA).trim(),
                    optionB: String(optionB).trim(),
                    optionC: String(optionC || '').trim(),
                    optionD: String(optionD || '').trim(),
                    correctOption: String(correctOptionValue).trim().toUpperCase(),
                    format: 'MULTIPLE_CHOICE' as QuestionFormat,
                    questionType: questionType,
                    quizId
                });
            }
        }

        console.log(`[IMPORT] Prepared ${questionsData.length} questions for bulk insert`);

        if (questionsData.length > 0) {
            const result = await prisma.question.createMany({
                data: questionsData as any,
                skipDuplicates: false // We want to import all
            });
            console.log(`[IMPORT] Successfully inserted ${result.count} questions`);
        } else {
            console.log(`[IMPORT] No valid questions found in file`);
            return res.status(400).json({ message: 'No valid questions found in the uploaded file' });
        }

        res.status(201).json({
            message: 'Questions imported successfully',
            count: questionsData.length
        });

        // Audit question import
        await auditService.logFromRequest(req, 'QUESTIONS_IMPORTED', undefined, { 
            quizId, 
            count: questionsData.length,
            fileName: req.file?.originalname
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
});

/**
 * @openapi
 * /questions:
 *   get:
 *     tags: [Admin Questions]
 *     summary: Get all questions for a quiz
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of questions
 */
router.get('/', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { quizId } = req.query;
        
        if (!quizId) {
            return res.status(400).json({ message: 'Quiz ID is required' });
        }
        
        const questions = await prisma.question.findMany({
            where: { quizId: quizId as string },
            select: {
                id: true,
                text: true,
                optionA: true,
                optionB: true,
                optionC: true,
                optionD: true,
                correctOption: true,
                format: true,
                questionType: true, // Include questionType in response
                quizId: true,
                createdAt: true,
                updatedAt: true
            } as any
        });
        res.json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * @openapi
 * /questions/stats/{quizId}:
 *   get:
 *     tags: [Admin Questions]
 *     summary: Get question type distribution for a quiz
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Distribution statistics
 */
router.get('/stats/:quizId', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { quizId } = req.params;
        
        const questionStats = await prisma.question.groupBy({
            by: ['questionType'],
            where: { quizId: quizId as string },
            _count: {
                questionType: true
            }
        });

        const totalQuestions = await prisma.question.count({
            where: { quizId: quizId as string }
        });

        const stats = questionStats.map(stat => ({
            questionType: stat.questionType,
            count: stat._count?.questionType || 0,
            percentage: totalQuestions > 0 ? Math.round(((stat._count?.questionType || 0) / totalQuestions) * 100) : 0
        }));

        res.json({
            totalQuestions,
            questionTypeDistribution: stats
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
