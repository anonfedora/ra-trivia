import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { UserType } from '@prisma/client';
import * as xlsx from 'xlsx';

const prisma = new PrismaClient();

export class ReportGenerator {
    static async getExamResults(userType?: UserType, quizId?: string, createdById?: string) {
        const whereClause: any = {};
        
        if (userType) {
            whereClause.userType = userType;
        }
        
        if (quizId) {
            whereClause.quizId = quizId;
        }
        
        // Filter by quiz creator for regular admins
        if (createdById) {
            whereClause.quiz = {
                createdById: createdById
            };
        }
        
        const results = await prisma.quizSession.findMany({
            where: {
                ...whereClause,
                endTime: { not: null }
            },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        church: true,
                        association: true
                    }
                },
                quiz: {
                    select: {
                        title: true,
                        passMark: true,
                        questions: true
                    }
                }
            },
            orderBy: {
                startTime: 'desc'
            }
        });

        return results;
    }

    static calculateSummary(results: any[]) {
        if (results.length === 0) {
            return {
                totalCandidates: 0,
                totalSessions: 0,
                averageScore: 0,
                highestScore: 0,
                lowestScore: 0,
                noRecordCount: 0
            };
        }

        const scores = results.map(r => r.score || 0);
        const totalCandidates = results.length;
        const totalSessions = results.length;
        const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const highestScore = Math.max(...scores);
        const lowestScore = Math.min(...scores);
        const noRecordCount = results.filter(r => r.score === null || r.score === undefined).length;

        return {
            totalCandidates,
            totalSessions,
            averageScore: parseFloat(averageScore.toFixed(2)),
            highestScore: parseFloat(highestScore.toFixed(2)),
            lowestScore: parseFloat(lowestScore.toFixed(2)),
            noRecordCount
        };
    }

    static async generateQuizPreviewPDF(quizId: string, createdById?: string): Promise<{ buffer: Buffer; filename: string }> {
        try {
            console.log('[QUIZ_PREVIEW_PDF] Starting quiz preview PDF generation...');
            
            // Fetch quiz with questions
            const quiz = await prisma.quiz.findUnique({
                where: { id: quizId },
                include: {
                    questions: {
                        orderBy: { id: 'asc' }
                    }
                }
            });

            if (!quiz) {
                throw new Error('Quiz not found');
            }

            // Check permission for regular admins
            if (createdById && quiz.createdById !== createdById) {
                throw new Error('Permission denied');
            }

            let browser;
            
            try {
                // Check if we're in a production environment
                const isProduction = process.env.NODE_ENV === 'production';
                const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID;
                
                if (isProduction && isRender) {
                    console.log('[QUIZ_PREVIEW_PDF] Detected Render environment, using @sparticuz/chromium');
                }

                const quizTitle = quiz.title.toLowerCase()
                    .replace(/[^a-z0-9\s]/gi, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_+|_+$/g, '')
                    .substring(0, 50);

                const filename = `${quizTitle}_questions_preview.pdf`;

                // Load and convert logo to base64
                let logoBase64 = '';
                try {
                    const logoPath = path.join(process.cwd(), '../../apps/web/public/favicon.png');
                    if (fs.existsSync(logoPath)) {
                        const logoBuffer = fs.readFileSync(logoPath);
                        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
                    }
                } catch (error) {
                    console.log('Logo not found, using fallback');
                }

                // Generate HTML for quiz preview
                const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Quiz Preview - ${quiz.title}</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            padding: 20px;
                            font-size: 12px;
                            line-height: 1.4;
                        }
                        .header-container {
                            display: flex;
                            align-items: center;
                            background: linear-gradient(to bottom, #1e5ba8 0%, #1e5ba8 50%, #4a7bb8 50%, #4a7bb8 100%);
                            padding: 10px 20px;
                            margin-bottom: 20px;
                        }
                        .logo {
                            width: 60px;
                            height: 60px;
                            margin-right: 20px;
                            background: white;
                            border-radius: 50%;
                            padding: 5px;
                        }
                        .header-text {
                            flex: 1;
                            color: white;
                            text-align: center;
                        }
                        .header-text h1 {
                            font-size: 16px;
                            font-weight: bold;
                            margin-bottom: 3px;
                            letter-spacing: 1px;
                        }
                        .header-text h2 {
                            font-size: 12px;
                            font-weight: normal;
                            margin-bottom: 0;
                        }
                        .quiz-info {
                            background-color: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            padding: 15px;
                            margin-bottom: 20px;
                        }
                        .quiz-title {
                            font-size: 18px;
                            font-weight: bold;
                            color: #1e293b;
                            margin-bottom: 10px;
                        }
                        .quiz-details {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 15px;
                            margin-bottom: 10px;
                        }
                        .detail-item {
                            text-align: center;
                        }
                        .detail-label {
                            font-size: 10px;
                            color: #64748b;
                            font-weight: bold;
                            text-transform: uppercase;
                        }
                        .detail-value {
                            font-size: 14px;
                            font-weight: bold;
                            color: #1e293b;
                            margin-top: 2px;
                        }
                        .questions-container {
                            margin-top: 20px;
                        }
                        .question {
                            margin-bottom: 25px;
                            page-break-inside: avoid;
                        }
                        .question-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            margin-bottom: 8px;
                        }
                        .question-number {
                            font-size: 10px;
                            font-weight: bold;
                            color: #64748b;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }
                        .question-type {
                            font-size: 10px;
                            font-weight: bold;
                            color: #2563eb;
                            background-color: #eff6ff;
                            padding: 2px 6px;
                            border-radius: 4px;
                            text-transform: uppercase;
                        }
                        .question-text {
                            font-size: 12px;
                            font-weight: bold;
                            color: #1e293b;
                            margin-bottom: 10px;
                            line-height: 1.5;
                        }
                        .options-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 8px;
                        }
                        .option {
                            padding: 8px;
                            border: 1px solid #e2e8f0;
                            border-radius: 6px;
                            font-size: 11px;
                            line-height: 1.3;
                        }
                        .option.correct {
                            background-color: #f0fdf4;
                            border-color: #22c55e;
                            color: #166534;
                            font-weight: bold;
                        }
                        .option-key {
                            font-weight: bold;
                            margin-right: 4px;
                        }
                        .fill-in-answer {
                            background-color: #f0fdf4;
                            border: 1px solid #22c55e;
                            border-radius: 6px;
                            padding: 10px;
                            font-size: 12px;
                            font-weight: bold;
                            color: #166534;
                        }
                        .correct-label {
                            font-size: 9px;
                            text-transform: uppercase;
                            background-color: #22c55e;
                            color: white;
                            padding: 1px 4px;
                            border-radius: 3px;
                            margin-left: 8px;
                        }
                        @media print {
                            .question {
                                page-break-inside: avoid;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header-container">
                        ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo">` : '<div style="width: 60px;"></div>'}
                        <div class="header-text">
                            <h1>KADUNA BAPTIST CONFERENCE ROYAL AMBASSADORS</h1>
                            <h2>QUIZ PREVIEW - QUESTIONS AND ANSWERS</h2>
                        </div>
                    </div>
                    
                    <div class="quiz-info">
                        <div class="quiz-title">${quiz.title}</div>
                        <div class="quiz-details">
                            <div class="detail-item">
                                <div class="detail-label">Duration</div>
                                <div class="detail-value">${quiz.duration} min</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Questions</div>
                                <div class="detail-value">${quiz.questions.length}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Retake Limit</div>
                                <div class="detail-value">${quiz.retakeLimit || 2}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="questions-container">
                        ${quiz.questions.map((q: any, index: number) => {
                            const questionType = q.questionType?.replace(/_/g, ' ') || 'General';
                            
                            if (q.format === 'FILL_IN_THE_GAP') {
                                return `
                                <div class="question">
                                    <div class="question-header">
                                        <div class="question-number">Q${index + 1}</div>
                                        <div class="question-type">${questionType}</div>
                                    </div>
                                    <div class="question-text">${q.text}</div>
                                    <div class="fill-in-answer">
                                        <strong>Correct Answer:</strong> ${q.correctOption}
                                    </div>
                                </div>`;
                            } else {
                                const options = [
                                    { key: 'A', text: q.optionA },
                                    { key: 'B', text: q.optionB },
                                    { key: 'C', text: q.optionC },
                                    { key: 'D', text: q.optionD }
                                ].filter(o => o.text);
                                
                                return `
                                <div class="question">
                                    <div class="question-header">
                                        <div class="question-number">Q${index + 1}</div>
                                        <div class="question-type">${questionType}</div>
                                    </div>
                                    <div class="question-text">${q.text}</div>
                                    <div class="options-grid">
                                        ${options.map(opt => `
                                            <div class="option ${opt.key === q.correctOption ? 'correct' : ''}">
                                                <span class="option-key">${opt.key}.</span>${opt.text}
                                                ${opt.key === q.correctOption ? '<span class="correct-label">Correct</span>' : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>`;
                            }
                        }).join('')}
                    </div>
                    
                    <div style="margin-top: 30px; text-align: center; color: #64748b; font-size: 10px;">
                        <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                        <p>This is a confidential document containing quiz questions and answers.</p>
                    </div>
                </body>
                </html>`;

                // Use appropriate browser based on environment
                if (isProduction && isRender) {
                    console.log('[QUIZ_PREVIEW_PDF] Launching browser with @sparticuz/chromium');
                    browser = await puppeteerCore.launch({
                        args: chromium.args,
                        defaultViewport: { width: 1920, height: 1080 },
                        executablePath: await chromium.executablePath(),
                        headless: true,
                    });
                } else {
                    console.log('[QUIZ_PREVIEW_PDF] Launching browser with local puppeteer');
                    browser = await puppeteer.launch({
                        headless: true,
                        args: ['--no-sandbox', '--disable-setuid-sandbox']
                    });
                }

                const page = await browser.newPage();
                
                page.setDefaultTimeout(10000);
                await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
                
                console.log('[QUIZ_PREVIEW_PDF] Generating PDF buffer...');
                const pdfBuffer = await page.pdf({
                    format: 'A4',
                    printBackground: true,
                    margin: {
                        top: '20px',
                        right: '20px',
                        bottom: '20px',
                        left: '20px'
                    },
                    timeout: 15000
                });
                
                console.log('[QUIZ_PREVIEW_PDF] PDF generation successful');
                return { buffer: Buffer.from(pdfBuffer), filename };
                
            } catch (error) {
                console.error('[QUIZ_PREVIEW_PDF] Error generating PDF:', error);
                throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                try {
                    if (browser && typeof browser.close === 'function') {
                        await browser.close();
                    }
                } catch (closeError) {
                    console.error('[QUIZ_PREVIEW_PDF] Error closing browser:', closeError);
                }
            }
        } catch (error) {
            console.error('[QUIZ_PREVIEW_PDF] Error:', error);
            throw error;
        }
    }

    static async generateExcelReport(userType?: UserType, quizId?: string, createdById?: string): Promise<{ buffer: Buffer; filename: string }> {
        try {
            console.log('[EXCEL_GENERATION] Starting formatted Excel report generation...');
            
            const results = await this.getExamResults(userType, quizId, createdById);
            const summary = this.calculateSummary(results);
            
            // Get quiz title for filename
            let quizTitle = 'exams';
            if (quizId && results.length > 0) {
                quizTitle = results[0].quiz.title.toLowerCase()
                    .replace(/[^a-z0-9\s]/gi, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_+|_+$/g, '')
                    .substring(0, 50);
            }
            
            const filename = `${quizTitle}_exam_report_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            // Create workbook
            const wb = xlsx.utils.book_new();
            
            // Create summary worksheet
            const summaryData = [
                ['EXAMINATION SUMMARY REPORT'],
                [],
                ['Report Generated:', new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })],
                ['Total Candidates:', summary.totalCandidates],
                ['Total Sessions:', summary.totalSessions],
                ['Average Score:', `${summary.averageScore.toFixed(2)}%`],
                ['Highest Score:', `${summary.highestScore.toFixed(2)}%`],
                ['Lowest Score:', `${summary.lowestScore.toFixed(2)}%`],
                ['No Records:', summary.noRecordCount]
            ];
            
            const summaryWs = xlsx.utils.aoa_to_sheet(summaryData);
            xlsx.utils.book_append_sheet(wb, summaryWs, 'Summary');
            
            // Create results worksheet
            const resultsData = [
                ['S/N', 'NAME', 'CHURCH', 'ASSOCIATION', 'EXAM SCORE', 'REMARK', 'STATUS']
            ];
            
            results.forEach((result: any, index: number) => {
                const score = result.score || 0;
                const passMark = result.quiz.passMark ?? 50;
                const remark = score >= passMark ? 'Pass' : 'Fail';
                const status = result.manualStatus || (score >= passMark ? 'Cleared' : 'Not Cleared - No Certificates');
                
                resultsData.push([
                    index + 1,
                    result.user.name,
                    result.user.church || 'N/A',
                    result.user.association || 'N/A',
                    score.toFixed(2),
                    remark,
                    status
                ]);
            });
            
            const resultsWs = xlsx.utils.aoa_to_sheet(resultsData);
            
            // Set column widths
            const colWidths = [
                { wch: 8 },  // S/N
                { wch: 25 }, // NAME
                { wch: 20 }, // CHURCH
                { wch: 20 }, // ASSOCIATION
                { wch: 12 }, // EXAM SCORE
                { wch: 10 }, // REMARK
                { wch: 25 }  // STATUS
            ];
            resultsWs['!cols'] = colWidths;
            
            xlsx.utils.book_append_sheet(wb, resultsWs, 'Results');
            
            // Generate buffer
            const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
            
            console.log('[EXCEL_GENERATION] Excel generation successful');
            return { buffer: Buffer.from(excelBuffer), filename };
            
        } catch (error) {
            console.error('[EXCEL_GENERATION] Error generating Excel:', error);
            throw new Error(`Excel generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    static async generatePDFReport(userType?: UserType, quizId?: string, createdById?: string): Promise<{ buffer: Buffer; filename: string }> {
        let quizTitle = 'exams';
        let html = '';
        let browser;

        try {
            console.log('[PDF_GENERATION] Starting PDF report generation...');
            
            // Check if we're in a production environment
            const isProduction = process.env.NODE_ENV === 'production';
            const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID;
            
            if (isProduction && isRender) {
                console.log('[PDF_GENERATION] Detected Render environment, using @sparticuz/chromium');
            }
            
            const results = await this.getExamResults(userType, quizId, createdById);
            const summary = this.calculateSummary(results);
            
            // Get quiz title for filename
            if (quizId && results.length > 0) {
                quizTitle = results[0].quiz.title.toLowerCase()
                    .replace(/[^a-z0-9\s]/gi, '_') // Replace special characters with underscores
                    .replace(/_+/g, '_') // Clean up multiple underscores  
                    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
                    .substring(0, 50); // Limit length
            }
            
            const examTypeName = userType ? userType.replace(/_/g, ' ').replace(/EXAMS/g, 'EXAMINATION') : 'ALL EXAMINATIONS';
            const currentYear = new Date().getFullYear();

            // Load and convert logo to base64
            let logoBase64 = '';
            try {
                const logoPath = path.join(process.cwd(), '../../apps/web/public/favicon.png');
                if (fs.existsSync(logoPath)) {
                    const logoBuffer = fs.readFileSync(logoPath);
                    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
                }
            } catch (error) {
                console.log('Logo not found, using fallback');
            }

            // Calculate pass/fail statistics
            const passCount = results.filter(r => {
                const passMark = r.quiz.passMark ?? 50;
                return (r.score || 0) >= passMark;
            }).length;
            const failCount = results.filter(r => {
                const passMark = r.quiz.passMark ?? 50;
                return (r.score || 0) < passMark && r.score !== null;
            }).length;
            
            html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Exam Results Report</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    font-size: 11px;
                }
                .header-container {
                    display: flex;
                    align-items: center;
                    background: linear-gradient(to bottom, #1e5ba8 0%, #1e5ba8 50%, #4a7bb8 50%, #4a7bb8 100%);
                    padding: 10px 20px;
                    margin-bottom: 2px;
                }
                .logo {
                    width: 80px;
                    height: 80px;
                    margin-right: 20px;
                    background: white;
                    border-radius: 50%;
                    padding: 5px;
                }
                .header-text {
                    flex: 1;
                    color: white;
                    text-align: center;
                }
                .header-text h1 {
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 5px;
                    letter-spacing: 1px;
                }
                .header-text h2 {
                    font-size: 14px;
                    font-weight: normal;
                    margin-bottom: 0;
                }
                .yellow-bar {
                    background-color: #ffd700;
                    padding: 8px 20px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 14px;
                    color: #000;
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th {
                    background-color: #87ceeb;
                    border: 1px solid #5a9fb8;
                    padding: 10px 8px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 11px;
                }
                td {
                    border: 1px solid #ccc;
                    padding: 8px;
                    text-align: center;
                    font-size: 10px;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                .summary-table {
                    width: 50%;
                    margin: 20px 0;
                }
                .summary-table th {
                    background-color: #666;
                    color: white;
                }
                .pass-row {
                    background-color: #c8e6c9 !important;
                }
                .fail-row {
                    background-color: #ffcdd2 !important;
                }
                .no-record-row {
                    background-color: #fff9c4 !important;
                }
                .total-row {
                    background-color: #e0e0e0 !important;
                    font-weight: bold;
                }
                .footer-stats {
                    margin-top: 20px;
                    font-size: 11px;
                    line-height: 1.6;
                }
                .footer-stats p {
                    margin: 5px 0;
                }
            </style>
        </head>
        <body>
            <div class="header-container">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo">` : '<div style="width: 80px;"></div>'}
                <div class="header-text">
                    <h1>KADUNA BAPTIST CONFERENCE ROYAL AMBASSADORS</h1>
                    <h2>RANKING COMMITTEE REPORT</h2>
                </div>
            </div>
            <div class="yellow-bar">
                ${currentYear} ${examTypeName} RESULT AND ANALYSIS
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>S/N</th>
                        <th>NAME</th>
                        <th>CHURCH</th>
                        <th>ASSOCIATION</th>
                        <th>EXAM SCORE</th>
                        <th>REMARK</th>
                        <th>STATUS</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map((result: any, index: number) => {
                        const score = result.score || 0;
                        const passMark = result.quiz.passMark ?? 50;
                        // REMARK is based on score (Pass/Fail)
                        const remark = score >= passMark ? 'Pass' : 'Fail';
                        // STATUS is the manual status or auto-calculated status (Cleared/Not Cleared)
                        const status = result.manualStatus || (score >= passMark ? 'Cleared' : 'Not Cleared - No Certificates');
                        
                        return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${result.user.name}</td>
                            <td>${result.user.church || 'N/A'}</td>
                            <td>${result.user.association || 'N/A'}</td>
                            <td>${score.toFixed(2)}</td>
                            <td>${remark}</td>
                            <td>${status}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Exams REMARK</th>
                        <th>NO of Candidates</th>
                    </tr>
                </thead>
                <tbody>
                    <tr class="pass-row">
                        <td><strong>Pass</strong></td>
                        <td><strong>${passCount}</strong></td>
                    </tr>
                    <tr class="fail-row">
                        <td><strong>Fail</strong></td>
                        <td><strong>${failCount}</strong></td>
                    </tr>
                    <tr class="no-record-row">
                        <td><strong>No Record</strong></td>
                        <td><strong>${summary.noRecordCount}</strong></td>
                    </tr>
                    <tr class="total-row">
                        <td><strong>Grand Total</strong></td>
                        <td><strong>${results.length}</strong></td>
                    </tr>
                </tbody>
            </table>
            
            <div class="footer-stats">
                <p><strong>Report Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                <p><strong>Average Score:</strong> ${summary.averageScore.toFixed(2)}%</p>
                <p><strong>Highest Score:</strong> ${summary.highestScore.toFixed(2)}%</p>
                <p><strong>Lowest Score:</strong> ${summary.lowestScore.toFixed(2)}%</p>
            </div>
        </body>
        </html>
        `;

            // Use @sparticuz/chromium for serverless environments (Render, AWS Lambda, etc.)
            // Use regular puppeteer for local development
            if (isProduction && isRender) {
                console.log('[PDF_GENERATION] Launching browser with @sparticuz/chromium');
                browser = await puppeteerCore.launch({
                    args: chromium.args,
                    defaultViewport: { width: 1920, height: 1080 },
                    executablePath: await chromium.executablePath(),
                    headless: true,
                });
            } else {
                console.log('[PDF_GENERATION] Launching browser with local puppeteer');
                browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
            }

            const page = await browser.newPage();
            
            // Set timeout and use different wait strategy
            page.setDefaultTimeout(10000);
            await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
            
            console.log('[PDF_GENERATION] Generating PDF buffer...');
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                },
                timeout: 15000
            });

            const filename = `${quizTitle}_exam_report_${new Date().toISOString().split('T')[0]}.pdf`;
            
            console.log('[PDF_GENERATION] PDF generation successful');
            return { buffer: Buffer.from(pdfBuffer), filename };
        } catch (error) {
            console.error('[PDF_GENERATION] Error generating PDF:', error);
            
            // Provide more helpful error message for Chrome issues
            if (error instanceof Error && error.message.includes('Browser was not found')) {
                console.error('[PDF_GENERATION] Chrome browser not found. This may be due to:');
                console.error('  1. Chrome not installed via install-chrome.sh script');
                console.error('  2. Incorrect PUPPETEER_EXECUTABLE_PATH environment variable');
                console.error('  3. Missing permissions on Chrome binary');
                throw new Error('PDF generation failed: Chrome browser not available. Please ensure Chrome is properly installed.');
            }
            
            throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            try {
                if (browser && typeof browser.close === 'function') {
                    await browser.close();
                }
            } catch (closeError) {
                console.error('[PDF_GENERATION] Error closing browser:', closeError);
            }
        }
    }
}
