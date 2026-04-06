import puppeteer from 'puppeteer';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { UserType } from '@prisma/client';

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

    static async generateExcelReport(userType?: UserType, quizId?: string, createdById?: string): Promise<{ buffer: Buffer; filename: string }> {
        // Implementation would go here
        const quizTitle = 'exams';
        const filename = `${quizTitle}_exam_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        return { buffer: Buffer.from(''), filename };
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
