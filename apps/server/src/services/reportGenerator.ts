import * as xlsx from 'xlsx';
import puppeteer from 'puppeteer';
import { prisma, UserType } from 'database';
import * as fs from 'fs';
import * as path from 'path';

interface ExamResult {
    id: string;
    user: {
        name: string;
        email: string;
        church: string | null;
        association: string | null;
        userType: UserType;
    };
    quiz: {
        title: string;
    };
    score: number | null;
    startTime: Date;
    endTime: Date | null;
}

interface ExamSummary {
    totalCandidates: number;
    passCount: number;
    failCount: number;
    noRecordCount: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
}

export class ReportGenerator {

    static async getExamResults(userType?: UserType, quizId?: string): Promise<ExamResult[]> {
        const where: any = {
            endTime: { not: null } // Only completed sessions
        };

        if (userType) {
            where.user = { userType };
        }

        if (quizId) {
            where.quizId = quizId;
        }

        const results = await prisma.quizSession.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                        church: true,
                        association: true,
                        userType: true
                    }
                },
                quiz: {
                    select: {
                        title: true
                    }
                }
            },
            orderBy: [
                { score: 'desc' }, // Highest scores first
                { user: { name: 'asc' } } // Then alphabetically
            ]
        });

        return results as ExamResult[];
    }

    static calculateSummary(results: ExamResult[]): ExamSummary {
        const completedResults = results.filter(r => r.score !== null);
        const scores = completedResults.map(r => r.score!);

        const passCount = scores.filter(s => s >= 50).length; // Assuming 50% is pass mark
        const failCount = scores.filter(s => s < 50).length;
        const noRecordCount = results.length - completedResults.length;

        const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
        const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

        return {
            totalCandidates: results.length,
            passCount,
            failCount,
            noRecordCount,
            averageScore: Math.round(averageScore * 100) / 100,
            highestScore: Math.round(highestScore * 100) / 100,
            lowestScore: Math.round(lowestScore * 100) / 100
        };
    }

    static async generateExcelReport(userType?: UserType, quizId?: string): Promise<{ buffer: Buffer; filename: string }> {
        const results = await this.getExamResults(userType, quizId);
        const summary = this.calculateSummary(results);

        // Get quiz title for filename
        let quizTitle = 'all_exams';
        if (quizId && results.length > 0) {
            quizTitle = results[0].quiz.title.toLowerCase()
                .replace(/[^a-z0-9\s]/gi, '_') // Replace special characters with underscores
                .replace(/_+/g, '_') // Clean up multiple underscores  
                .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
                .substring(0, 50); // Limit length
        }

        // Create main results sheet
        const resultsData = results.map((result, index) => ({
            'S/N': index + 1,
            'NAME': result.user.name,
            'CHURCH': result.user.church || 'N/A',
            'ASSOCIATION': result.user.association || 'N/A',
            'EXAM SCORE': result.score || 0,
            'REMARK': result.score !== null ? (result.score >= 50 ? 'Pass' : 'Fail') : 'No Record',
            'STATUS': result.score !== null ? 'Cleared' : 'Not Cleared - No Certificates'
        }));

        // Create summary data
        const summaryData = [
            { 'Exams REMARK': 'Pass', 'NO of Candidates': summary.passCount },
            { 'Exams REMARK': 'Fail', 'NO of Candidates': summary.failCount },
            { 'Exams REMARK': 'No Record', 'NO of Candidates': summary.noRecordCount },
            { 'Exams REMARK': 'Grand Total', 'NO of Candidates': summary.totalCandidates }
        ];

        const workbook = xlsx.utils.book_new();

        // Add results sheet
        const resultsWorksheet = xlsx.utils.json_to_sheet(resultsData);

        // Set column widths - optimized for longer names
        resultsWorksheet['!cols'] = [
            { wch: 5 },  // S/N
            { wch: 30 }, // NAME (increased for longer names)
            { wch: 25 }, // CHURCH (increased for longer church names)
            { wch: 25 }, // ASSOCIATION (increased for longer association names)
            { wch: 10 }, // EXAM SCORE (reduced)
            { wch: 8 },  // REMARK (reduced)
            { wch: 20 }  // STATUS (reduced)
        ];

        xlsx.utils.book_append_sheet(workbook, resultsWorksheet, 'Exam Results');

        // Add summary sheet
        const summaryWorksheet = xlsx.utils.json_to_sheet(summaryData);
        summaryWorksheet['!cols'] = [
            { wch: 15 }, // Exams REMARK
            { wch: 15 }  // NO of Candidates
        ];

        xlsx.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

        const filename = `${quizTitle}_exam_report_${new Date().toISOString().split('T')[0]}.xlsx`;

        return { buffer: xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' }), filename };
    }

    static async generatePDFReport(userType?: UserType, quizId?: string): Promise<{ buffer: Buffer; filename: string }> {
        try {
            console.log('[PDF_GENERATION] Starting PDF report generation...');
            
            // Check if we're in a production environment that might not support Puppeteer
            const isProduction = process.env.NODE_ENV === 'production';
            const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID;
            
            if (isProduction && isRender) {
                console.log('[PDF_GENERATION] Detected Render environment, using optimized Puppeteer config');
            }
            
            const results = await this.getExamResults(userType, quizId);
            const summary = this.calculateSummary(results);
            
            // Get quiz title for filename
            let quizTitle = 'all_exams';
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

        const html = `
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
                    margin-bottom: 20px;
                    position: relative;
                }
                .header-logo {
                    position: absolute;
                    left: 20px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3px solid #2c5aa0;
                    background-color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                    font-weight: bold;
                    color: #2c5aa0;
                }
                .header-logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                }
                .header h1 {
                    background-color: #4a90e2;
                    color: white;
                    padding: 10px;
                    margin: 0;
                    font-size: 16px;
                    font-weight: bold;
                }
                .header h2 {
                    background-color: #2c5aa0;
                    color: white;
                    padding: 8px;
                    margin: 0;
                    font-size: 14px;
                }
                .header h3 {
                    background-color: #f4d03f;
                    color: black;
                    padding: 8px;
                    margin: 0;
                    font-size: 14px;
                    font-weight: bold;
                }
                .results-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                .results-table th {
                    background-color: #87ceeb;
                    color: black;
                    padding: 8px;
                    border: 1px solid #000;
                    font-weight: bold;
                    text-align: center;
                }
                .results-table th:nth-child(1) { width: 5%; }  /* S/N */
                .results-table th:nth-child(2) { width: 25%; } /* NAME */
                .results-table th:nth-child(3) { width: 20%; } /* CHURCH */
                .results-table th:nth-child(4) { width: 20%; } /* ASSOCIATION */
                .results-table th:nth-child(5) { width: 8%; }  /* EXAM SCORE */
                .results-table th:nth-child(6) { width: 7%; }  /* REMARK */
                .results-table th:nth-child(7) { width: 15%; } /* STATUS */
                
                .results-table td {
                    padding: 6px 8px;
                    border: 1px solid #000;
                    text-align: center;
                    font-size: 11px;
                }
                .results-table td:nth-child(2) { text-align: left; } /* NAME column left-aligned */
                .results-table td:nth-child(3) { text-align: left; } /* CHURCH column left-aligned */
                .results-table td:nth-child(4) { text-align: left; } /* ASSOCIATION column left-aligned */
                
                /* Alternating row colors for candidates */
                .results-table tbody tr:nth-child(odd) {
                    background-color: white;
                }
                .results-table tbody tr:nth-child(even) {
                    background-color: #e6f3ff;
                }
                
                .summary-table {
                    width: 50%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                .summary-table th {
                    background-color: #6c757d;
                    color: white;
                    padding: 8px;
                    border: 1px solid #000;
                    font-weight: bold;
                }
                .summary-table td {
                    padding: 6px 8px;
                    border: 1px solid #000;
                    text-align: center;
                }
                .summary-table .pass-row { background-color: #d4edda; }
                .summary-table .fail-row { background-color: #f8d7da; }
                .summary-table .no-record-row { background-color: #fff3cd; }
                .summary-table .total-row {
                    background-color: #e9ecef;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoBase64 ? `<div class="header-logo"><img src="${logoBase64}" alt="RA Logo" /></div>` : '<div class="header-logo">RA</div>'}
                <h1>KADUNA BAPTIST CONFERENCE ROYAL AMBASSADORS</h1>
                <h2>RANKING COMMITTEE REPORT</h2>
                <h3>${currentYear} ${examTypeName} RESULT AND ANALYSIS</h3>
            </div>

            <table class="results-table">
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
                    ${results.map((result, index) => {
            const score = result.score || 0;
            const remark = result.score !== null ? (score >= 50 ? 'Pass' : 'Fail') : 'No Record';

            return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${result.user.name}</td>
                            <td>${result.user.church || 'N/A'}</td>
                            <td>${result.user.association || 'N/A'}</td>
                            <td>${score}</td>
                            <td>${remark}</td>
                            <td>Cleared</td>
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
                        <td>Pass</td>
                        <td>${summary.passCount}</td>
                    </tr>
                    <tr class="fail-row">
                        <td>Fail</td>
                        <td>${summary.failCount}</td>
                    </tr>
                    <tr class="no-record-row">
                        <td>No Record</td>
                        <td>${summary.noRecordCount}</td>
                    </tr>
                    <tr class="total-row">
                        <td><strong>Grand Total</strong></td>
                        <td><strong>${summary.totalCandidates}</strong></td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 30px; font-size: 11px;">
                <p><strong>Report Generated:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                <p><strong>Average Score:</strong> ${summary.averageScore}%</p>
                <p><strong>Highest Score:</strong> ${summary.highestScore}%</p>
                <p><strong>Lowest Score:</strong> ${summary.lowestScore}%</p>
            </div>
        </body>
        </html>
        `;

        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ]
        });

        try {
            console.log('[PDF_GENERATION] Starting PDF generation...');
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });
            
            console.log('[PDF_GENERATION] Generating PDF buffer...');
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20px',
                    right: '20px',
                    bottom: '20px',
                    left: '20px'
                }
            });

            const filename = `${quizTitle}_exam_report_${new Date().toISOString().split('T')[0]}.pdf`;
            
            console.log('[PDF_GENERATION] PDF generation successful');
            return { buffer: Buffer.from(pdfBuffer), filename };
        } catch (error) {
            console.error('[PDF_GENERATION] Error generating PDF:', error);
            throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            try {
                await browser.close();
            } catch (closeError) {
                console.error('[PDF_GENERATION] Error closing browser:', closeError);
            }
        }
        } catch (error) {
            console.error('[PDF_GENERATION] Fatal error in PDF generation:', error);
            throw new Error(`Failed to generate PDF report: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}