import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.count();
    const quizzes = await prisma.quiz.count();
    const sessions = await prisma.quizSession.count();
    const completedSessions = await prisma.quizSession.count({ where: { NOT: { endTime: null } } });

    console.log('--- DB Check ---');
    console.log('Users:', users);
    console.log('Quizzes:', quizzes);
    console.log('Total Sessions:', sessions);
    console.log('Completed Sessions:', completedSessions);

    const allUsers = await prisma.user.findMany({ select: { email: true, role: true } });
    console.log('--- Users ---');
    allUsers.forEach(u => console.log(`${u.email}: ${u.role}`));

    if (sessions > 0) {
        const latest = await prisma.quizSession.findMany({
            take: 5,
            include: { user: true, quiz: true },
            orderBy: { startTime: 'desc' }
        });
        console.log('--- Latest Sessions ---');
        latest.forEach(s => {
            console.log(`User: ${s.user.email}, Quiz: ${s.quiz.title}, Score: ${s.score}, Ended: ${!!s.endTime}`);
        });
    }
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
