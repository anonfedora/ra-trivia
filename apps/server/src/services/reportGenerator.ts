import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { UserType } from '@prisma/client';

const prisma = new PrismaClient();

export class ReportGenerator {
    static async getExamResults(userType?: UserType, quizId?: string) {
        const whereClause: any = {};
        
        if (userType) {
            whereClause.userType = userType;
        }
        
        if (quizId) {
            whereClause.quizId = quizId;
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
                        association: true
                    }
                },
                quiz: {
                    select: {
                        title: true,
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
            averageScore: parseFloat(averageScore.toFixed(1)),
            highestScore,
            lowestScore,
            noRecordCount
        };
    }

    static async generateExcelReport(userType?: UserType, quizId?: string): Promise<{ buffer: Buffer; filename: string }> {
        // Implementation would go here
        const quizTitle = 'all_exams';
        const filename = `${quizTitle}_exam_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        return { buffer: Buffer.from(''), filename };
    }

    static async generatePDFReport(userType?: UserType, quizId?: string): Promise<{ buffer: Buffer; filename: string }> {
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
            
            const results = await this.getExamResults(userType, quizId);
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

            html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Exam Results Report</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    font-size: 12px;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .logo {
                    max-width: 200px;
                    max-height: 100px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                }
                .total-row {
                    font-weight: bold;
                    background-color: #f9f9f9;
                }
                .no-record-row {
                    color: #999;
                }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo">` : ''}
                <h1>${examTypeName} Results Report - ${currentYear}</h1>
                <p><strong>Report Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                <p><strong>Average Score:</strong> ${summary.averageScore}%</p>
                <p><strong>Highest Score:</strong> ${summary.highestScore}%</p>
                <p><strong>Lowest Score:</strong> ${summary.lowestScore}%</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Candidate Name</th>
                        <th>Email</th>
                        <th>Quiz Title</th>
                        <th>Score</th>
                        <th>Remark</th>
                    </tr>
                </thead>
                <tbody>
                    ${results.map((result: any) => {
                        const score = result.score || 0;
                        const remark = score >= 50 ? 'Cleared' : 'Not Cleared - No Certificates';
                        
                        return `
                        <tr>
                            <td>${result.user.name}</td>
                            <td>${result.user.email}</td>
                            <td>${result.quiz.title}</td>
                            <td>${score}</td>
                            <td>${remark}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            <div style="margin-top: 30px; font-size: 11px;">
                <p><strong>Average Score:</strong> ${summary.averageScore}%</p>
                <p><strong>Highest Score:</strong> ${summary.highestScore}%</p>
                <p><strong>Lowest Score:</strong> ${summary.lowestScore}%</p>
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
