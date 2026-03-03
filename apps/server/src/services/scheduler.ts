import { prisma } from 'database';
import { sendQuizResultEmail } from './email';

export const initScheduler = () => {
    console.log('⏰ Initializing results release scheduler...');

    // Run every 10 minutes to check for pending releases
    setInterval(async () => {
        try {
            const now = new Date();
            console.log(`[SCHEDULER] Checking for results to release at ${now.toISOString()}...`);

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

            if (pendingSessions.length === 0) return;

            console.log(`[SCHEDULER] Found ${pendingSessions.length} sessions to release.`);

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
                        console.log(`[SCHEDULER] Successfully processed session ${session.id}`);
                    }
                } catch (err) {
                    console.error(`[SCHEDULER] Error processing session ${session.id}:`, err);
                }
            }
        } catch (error) {
            console.error('[SCHEDULER] Global error in results release task:', error);
        }
    }, 3 * 60 * 60 * 1000); // 3 hours
};
