import { prisma } from 'database';
import { sendQuizResultEmail } from './email';

export const initScheduler = () => {
    console.log('⏰ Initializing results release scheduler...');
    console.log(`🌍 Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    console.log(`🕐 Current server time: ${new Date().toLocaleString()}`);

    // Run immediately on startup to catch any missed emails
    processResultsRelease();

    // Run every 15 minutes to check for pending releases (more frequent than hourly)
    setInterval(async () => {
        await processResultsRelease();
    }, 15 * 60 * 1000); // 15 minutes
};

async function processResultsRelease() {
    try {
        const now = new Date();
        
        console.log(`[SCHEDULER] ⏰ Checking for results to release at ${now.toISOString()} (Local: ${now.toLocaleString()})...`);

        // Find sessions that have reached release time and haven't sent email
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
            console.log(`[SCHEDULER] No pending sessions found at this time`);
            return;
        }

        console.log(`[SCHEDULER] Found ${pendingSessions.length} sessions ready for email release.`);

        let processedCount = 0;
        let failedCount = 0;

        for (const session of pendingSessions) {
            try {
                // Compute per-question breakdown (same logic as results route)
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

                console.log(`[SCHEDULER] Sending email to ${session.user.email} for session ${session.id} (Score: ${score}%)`);

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

                    // Notify the candidate in-app
                    await prisma.notification.create({
                        data: {
                            type: 'RESULT_RELEASED',
                            title: 'Your Result is Ready',
                            message: `Your result for "${session.quiz.title}" has been released. Check your results now.`,
                            quizId: session.quizId,
                            sessionId: session.id,
                            isRead: false,
                            createdById: session.userId,
                        }
                    });

                    processedCount++;
                    console.log(`[SCHEDULER] ✅ Successfully sent email for session ${session.id}`);
                } else {
                    failedCount++;
                    console.log(`[SCHEDULER] ❌ Failed to send email for session ${session.id}`);
                }
            } catch (err) {
                failedCount++;
                console.error(`[SCHEDULER] ❌ Error processing session ${session.id}:`, err);
            }
        }

        console.log(`[SCHEDULER] Completed processing. Success: ${processedCount}, Failed: ${failedCount}, Total: ${pendingSessions.length}`);
    } catch (error) {
        console.error('[SCHEDULER] Global error in results release task:', error);
    }
}
