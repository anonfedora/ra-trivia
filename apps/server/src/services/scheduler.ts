import { prisma } from 'database';
import { sendQuizResultEmail } from './email';

export const initScheduler = () => {
    console.log('⏰ Initializing results release scheduler...');
    console.log(`🌍 Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    console.log(`🕐 Current server time: ${new Date().toLocaleString()}`);

    let lastProcessedDate: string | null = null;

    // Run every hour to check for pending releases
    setInterval(async () => {
        try {
            const now = new Date();
            const currentHour = now.getHours();
            const currentDateString = now.toDateString(); // e.g., "Mon Mar 10 2026"

            // Process results during 8 PM hour (20:00-20:59) OR if we're past 8 PM and haven't processed today
            const isIn8PMWindow = currentHour === 20;
            const isPast8PM = currentHour > 20;
            const hasProcessedToday = lastProcessedDate === currentDateString;
            
            if (!isIn8PMWindow && !isPast8PM) {
                console.log(`[SCHEDULER] Skipping check at ${now.toISOString()} (Hour: ${currentHour}, before 8 PM window)`);
                return;
            }

            if (hasProcessedToday) {
                console.log(`[SCHEDULER] Already processed results today (${currentDateString}), skipping...`);
                return;
            }

            console.log(`[SCHEDULER] ⏰ Processing results release at ${now.toISOString()} (Local: ${now.toLocaleString()})...`);
            console.log(`[SCHEDULER] Window check: isIn8PMWindow=${isIn8PMWindow}, isPast8PM=${isPast8PM}`);

            // Find sessions that have reached release time and haven't sent email
            const pendingSessions = await prisma.quizSession.findMany({
                where: {
                    endTime: { not: null },
                    resultReleasesAt: { lte: now },
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
                console.log(`[SCHEDULER] No pending sessions found, but marking as processed for today`);
                lastProcessedDate = currentDateString;
                return;
            }

            console.log(`[SCHEDULER] Found ${pendingSessions.length} sessions to release.`);

            let processedCount = 0;
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

                    console.log(`[SCHEDULER] Sending email to ${session.user.email} for session ${session.id}`);

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
                        console.log(`[SCHEDULER] Successfully processed session ${session.id}`);
                    }
                } catch (err) {
                    console.error(`[SCHEDULER] Error processing session ${session.id}:`, err);
                }
            }

            // Mark as processed for today regardless of success/failure to prevent retries
            lastProcessedDate = currentDateString;
            console.log(`[SCHEDULER] Completed processing for ${currentDateString}. Processed ${processedCount}/${pendingSessions.length} sessions.`);
        } catch (error) {
            console.error('[SCHEDULER] Global error in results release task:', error);
        }
    }, 60 * 60 * 1000); // 1 hour
};
