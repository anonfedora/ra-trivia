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

    // Seed Public Quizzes
    console.log('Seeding public quizzes...');

    // MCQ Public Quiz
    const mcqQuiz = await prisma.publicQuiz.upsert({
        where: { id: 'mcq-sample' },
        update: {},
        create: {
            id: 'mcq-sample',
            title: 'General Knowledge Challenge',
            description: 'Test your general knowledge with these multiple choice questions!',
            category: 'MCQ',
            isActive: true,
            questions: {
                create: [
                    {
                        text: 'What is the capital of France?',
                        optionA: 'London',
                        optionB: 'Berlin',
                        optionC: 'Paris',
                        optionD: 'Madrid',
                        correctOption: 'C',
                        format: 'MULTIPLE_CHOICE'
                    },
                    {
                        text: 'Which planet is known as the Red Planet?',
                        optionA: 'Earth',
                        optionB: 'Mars',
                        optionC: 'Jupiter',
                        optionD: 'Saturn',
                        correctOption: 'B',
                        format: 'MULTIPLE_CHOICE'
                    },
                    {
                        text: 'What is the largest ocean on Earth?',
                        optionA: 'Atlantic Ocean',
                        optionB: 'Indian Ocean',
                        optionC: 'Arctic Ocean',
                        optionD: 'Pacific Ocean',
                        correctOption: 'D',
                        format: 'MULTIPLE_CHOICE'
                    },
                    {
                        text: 'Who painted the Mona Lisa?',
                        optionA: 'Vincent van Gogh',
                        optionB: 'Pablo Picasso',
                        optionC: 'Leonardo da Vinci',
                        optionD: 'Michelangelo',
                        correctOption: 'C',
                        format: 'MULTIPLE_CHOICE'
                    },
                    {
                        text: 'What is the smallest prime number?',
                        optionA: '0',
                        optionB: '1',
                        optionC: '2',
                        optionD: '3',
                        correctOption: 'C',
                        format: 'MULTIPLE_CHOICE'
                    }
                ]
            }
        }
    });

    // Fill-in-the-Gap Public Quiz
    const fillGapQuiz = await prisma.publicQuiz.upsert({
        where: { id: 'fill-gap-sample' },
        update: {},
        create: {
            id: 'fill-gap-sample',
            title: 'Complete the Sentence Challenge',
            description: 'Fill in the missing words to complete these sentences!',
            category: 'FILL_IN_THE_GAP',
            isActive: true,
            questions: {
                create: [
                    {
                        text: 'The capital of Japan is ___.',
                        correctAnswer: 'Tokyo',
                        format: 'FILL_IN_THE_GAP'
                    },
                    {
                        text: 'Water freezes at ___ degrees Celsius.',
                        correctAnswer: '0',
                        format: 'FILL_IN_THE_GAP'
                    },
                    {
                        text: 'The largest planet in our solar system is ___.',
                        correctAnswer: 'Jupiter',
                        format: 'FILL_IN_THE_GAP'
                    },
                    {
                        text: 'The chemical symbol for gold is ___.',
                        correctAnswer: 'Au',
                        format: 'FILL_IN_THE_GAP'
                    },
                    {
                        text: 'The human body has ___ bones.',
                        correctAnswer: '206',
                        format: 'FILL_IN_THE_GAP'
                    }
                ]
            }
        }
    });

    console.log('Public quizzes seeded successfully');
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
