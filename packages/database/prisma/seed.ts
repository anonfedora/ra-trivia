import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding...');

    // Seed admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
        where: { email: 'admin@rattrivia.com' },
        update: {},
        create: {
            email: 'admin@rattrivia.com',
            name: 'admin',
            password: adminPassword,
            role: 'ADMIN'
        }
    });

    // Seed default quiz
    await prisma.quiz.upsert({
        where: { id: 'default' },
        update: {},
        create: {
            id: 'default',
            title: 'General Knowledge Quiz',
            duration: 30,
            questions: {
                create: [
                    {
                        text: 'What is the capital of France?',
                        optionA: 'London',
                        optionB: 'Berlin',
                        optionC: 'Paris',
                        optionD: 'Madrid',
                        correctOption: 'C'
                    },
                    {
                        text: 'Which planet is known as the Red Planet?',
                        optionA: 'Earth',
                        optionB: 'Mars',
                        optionC: 'Jupiter',
                        optionD: 'Saturn',
                        correctOption: 'B'
                    },
                    {
                        text: 'What is the largest ocean on Earth?',
                        optionA: 'Atlantic Ocean',
                        optionB: 'Indian Ocean',
                        optionC: 'Arctic Ocean',
                        optionD: 'Pacific Ocean',
                        correctOption: 'D'
                    }
                ]
            }
        }
    });

    console.log('Seeding completed successfully');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
