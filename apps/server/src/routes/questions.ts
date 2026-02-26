import { Router } from 'express';
import { prisma } from 'database';
import multer from 'multer';
import * as xlsx from 'xlsx';
import { authenticate, authorizeAdmin } from '../middlewares/auth';

const router = Router();
const upload = multer({ 
    dest: 'uploads/',
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

// Admin: Import questions from Excel
router.post('/import', authenticate, authorizeAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        let quizId = req.body.quizId;
        const title = req.body.title;
        const duration = req.body.duration;

        if (!quizId) {
            if (!title || !duration) {
                return res.status(400).json({ message: 'Quiz ID or Title/Duration are required' });
            }
            console.log(`[IMPORT] Creating new quiz: ${title}`);
            // Create new quiz
            const newQuiz = await prisma.quiz.create({
                data: {
                    title: String(title),
                    duration: Number(duration),
                    isActive: false
                }
            });
            console.log(`[IMPORT] Created new quiz with ID: ${newQuiz.id}`);
            quizId = newQuiz.id;
        } else {
            console.log(`[IMPORT] targetting existing quiz ID: ${quizId}`);
        }

        const workbook = xlsx.readFile(req.file.path);
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
            const optionA = getVal(row, ['Option A', 'option a', 'A']);
            const optionB = getVal(row, ['Option B', 'option b', 'B']);
            const optionC = getVal(row, ['Option C', 'option c', 'C']);
            const optionD = getVal(row, ['Option D', 'option d', 'D']);
            const correctOptionValue = getVal(row, ['Correct Option', 'right option', 'Answer', 'Correct']);

            if (!text || !optionA || !optionB || !correctOptionValue) {
                console.log(`[IMPORT] Skipping row: ${JSON.stringify(row)}`);
                continue;
            }

            questionsData.push({
                text: String(text).trim(),
                optionA: String(optionA).trim(),
                optionB: String(optionB).trim(),
                optionC: String(optionC || '').trim(),
                optionD: String(optionD || '').trim(),
                correctOption: String(correctOptionValue).trim().toUpperCase(),
                quizId
            });
        }

        console.log(`[IMPORT] Prepared ${questionsData.length} questions for bulk insert`);

        if (questionsData.length > 0) {
            const result = await prisma.question.createMany({
                data: questionsData,
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
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: 'Internal server error', error: String(error) });
    }
});

// Admin: Get all questions (for a quiz) - Protected endpoint
router.get('/', authenticate, authorizeAdmin, async (req, res) => {
    try {
        const { quizId } = req.query;
        
        if (!quizId) {
            return res.status(400).json({ message: 'Quiz ID is required' });
        }
        
        const questions = await prisma.question.findMany({
            where: { quizId: quizId as string }
        });
        res.json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
