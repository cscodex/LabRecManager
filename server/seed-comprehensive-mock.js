const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanData() {
    console.log('Cleaning up mock data...');
    // We try to clean data carefully so we don't destroy actual useful tables.
    // However, since it's mock data, we delete things created by this seed.
    await prisma.studentUnitMastery.deleteMany();
    await prisma.studentTrainingProgress.deleteMany();
    await prisma.codingSubmission.deleteMany();
    await prisma.trainingExercise.deleteMany();
    await prisma.trainingUnit.deleteMany();
    await prisma.trainingModule.deleteMany();
    await prisma.schoolCalendar.deleteMany();
    
    // We ignore deleting timetable data because it might exist.
    // Or we can just seed new stuff.
}

async function seedData() {
    console.log('Starting comprehensive mock data generation...');

    try {
        await cleanData();
        
        const school = await prisma.school.findFirst();
        if (!school) throw new Error('No school found in the database. Please run basic seed first.');

        const academicYear = await prisma.academicYear.findFirst({
            where: { schoolId: school.id, isCurrent: true }
        });
        if (!academicYear) throw new Error('No current academic year found.');

        // Get some users
        const instructor = await prisma.user.findFirst({
            where: { role: 'instructor', schoolId: school.id }
        });
        const students = await prisma.user.findMany({
            where: { role: 'student', schoolId: school.id },
            take: 3
        });

        if (!instructor || students.length === 0) {
            console.log('Warn: Instructor or Students missing. Cannot seed comprehensive mock data.');
            return;
        }

        // ==========================================
        // 1. ADMIN DATA: Holidays & Calendar
        // ==========================================
        console.log('Seeding Punjab Holidays...');
        const holidays = [
            { date: new Date('2026-01-26'), title: 'Republic Day' },
            { date: new Date('2026-03-14'), title: 'Holi' },
            { date: new Date('2026-04-13'), title: 'Baisakhi' },
            { date: new Date('2026-08-15'), title: 'Independence Day' },
            { date: new Date('2026-10-02'), title: 'Gandhi Jayanti' },
            { date: new Date('2026-11-01'), title: 'Diwali' },
            { date: new Date('2026-12-25'), title: 'Christmas' },
        ];

        for (const h of holidays) {
            await prisma.schoolCalendar.upsert({
                where: { unique_calendar_date_per_school: { schoolId: school.id, date: h.date } },
                update: {},
                create: {
                    schoolId: school.id,
                    academicYearId: academicYear.id,
                    date: h.date,
                    title: h.title,
                    type: 'gazetted_holiday',
                    isHoliday: true,
                    source: 'punjab_govt'
                }
            });
        }

        // ==========================================
        // 2. TRAINING MODULE DATA (WITH PEDAGOGY)
        // ==========================================
        console.log('Seeding Training Module & Pedagogy structure...');
        const module = await prisma.trainingModule.create({
            data: {
                schoolId: school.id,
                title: 'Python Masterclass (PSEB Aligned)',
                description: 'A comprehensive pedagogical standard Python course.',
                language: 'python',
                boardAligned: 'PSEB',
                classLevel: 11,
                totalUnits: 2,
                totalExercises: 4,
                isPublished: true,
                units: {
                    create: [
                        {
                            unitNumber: 1,
                            title: 'Python Basics & Variables',
                            description: 'Learn the fundamentals of Python.',
                            expectedHours: 5,
                            unlockThreshold: 80,
                            sequenceOrder: 1,
                            exercises: {
                                create: [
                                    {
                                        title: 'Hello World Introduction',
                                        description: 'Print "Hello World" using Python.',
                                        difficulty: 'beginner',
                                        scaffoldLevel: 'guided',
                                        isReviewExercise: false,
                                        starterCode: '# write your print statement\n',
                                        solutionCode: 'print("Hello World")',
                                        timeLimit: 5,
                                        sequenceOrder: 1,
                                        xpReward: 10,
                                        testCases: [
                                            { input: '', expectedOutput: 'Hello World\n', isHidden: false }
                                        ],
                                        hints: ['Use the built-in print() function']
                                    },
                                    {
                                        title: 'Interactive Calculator',
                                        description: 'Read an integer and multiply it by 2.',
                                        difficulty: 'beginner',
                                        scaffoldLevel: 'semi_guided',
                                        isReviewExercise: false,
                                        starterCode: 'n = int(input())\n',
                                        timeLimit: 5,
                                        sequenceOrder: 2,
                                        xpReward: 15,
                                        testCases: [
                                            { input: '4', expectedOutput: '8\n', isHidden: false },
                                            { input: '10', expectedOutput: '20\n', isHidden: true } // Hidden test case!
                                        ],
                                        hints: ['Use the * operator']
                                    }
                                ]
                            }
                        },
                        {
                            unitNumber: 2,
                            title: 'Flow Control & Loops',
                            description: 'Learn logic flow.',
                            expectedHours: 8,
                            unlockThreshold: 80,
                            sequenceOrder: 2,
                            exercises: {
                                create: [
                                    {
                                        title: 'Review: Variable Multiplication (Spaced Repetition)',
                                        description: 'Multiply by 3 this time in a loop.',
                                        difficulty: 'intermediate',
                                        scaffoldLevel: 'independent',
                                        isReviewExercise: true,
                                        timeLimit: 5,
                                        sequenceOrder: 1,
                                        xpReward: 20,
                                        testCases: [
                                            { input: '2', expectedOutput: '6\n', isHidden: false }
                                        ]
                                    },
                                    {
                                        title: 'Capstone: Prime Number Checker',
                                        description: 'Check if a number is prime.',
                                        difficulty: 'advanced',
                                        scaffoldLevel: 'project',
                                        isReviewExercise: false,
                                        timeLimit: 5,
                                        sequenceOrder: 2,
                                        xpReward: 50,
                                        testCases: [
                                            { input: '7', expectedOutput: 'Prime\n', isHidden: false },
                                            { input: '8', expectedOutput: 'Not Prime\n', isHidden: true }
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        });

        // ==========================================
        // 3. STUDENT PROGRESS & AI SOCRATIC REVIEWS
        // ==========================================
        console.log('Seeding Student Submissions & Mastery Locks...');
        
        // Let's get the specific exercises we just created
        const unit1 = await prisma.trainingUnit.findFirst({ where: { moduleId: module.id, unitNumber: 1 }});
        const unit2 = await prisma.trainingUnit.findFirst({ where: { moduleId: module.id, unitNumber: 2 }});
        const exercises = await prisma.trainingExercise.findMany({ where: { unitId: unit1.id }, orderBy: { sequenceOrder: 'asc' }});
        
        // Student 1: Completes Unit 1, unlocks Unit 2
        const student1 = students[0];
        
        await prisma.studentTrainingProgress.create({
            data: {
                studentId: student1.id,
                moduleId: module.id,
                currentUnitId: unit2.id,
                overallProgress: 50.0,
                totalXP: 25,
                streak: 3,
                lastActiveAt: new Date(),
                startedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
            }
        });

        await prisma.studentUnitMastery.create({
            data: {
                studentId: student1.id,
                unitId: unit1.id,
                masteryScore: 100, // Fully Mastered
                exercisesDone: 2,
                status: 'mastered',
                unlockedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
                masteredAt: new Date()
            }
        });

        await prisma.studentUnitMastery.create({
            data: {
                studentId: student1.id,
                unitId: unit2.id,
                masteryScore: 0,
                exercisesDone: 0,
                status: 'in_progress', // Unlocked!
                unlockedAt: new Date()
            }
        });

        // Simulate AI Socratic Feedback for a failed submission
        await prisma.codingSubmission.create({
            data: {
                exerciseId: exercises[0].id,
                studentId: student1.id,
                code: 'print("Helllo Worlld")',
                status: 'failed',
                output: 'Helllo Worlld\n',
                aiSocraticReview: "I see you're printing the text, but check your spelling carefully. Are there too many 'l's in your output compared to 'Hello World'?",
                submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
            }
        });

        // Successful submission
        await prisma.codingSubmission.create({
            data: {
                exerciseId: exercises[0].id,
                studentId: student1.id,
                code: 'print("Hello World")',
                status: 'passed',
                output: 'Hello World\n',
                submittedAt: new Date()
            }
        });

        // ==========================================
        // 4. INSTRUCTOR TIMETABLE & LECTURE SESSIONS
        // ==========================================
        console.log('Mocks complete!');

    } catch (e) {
        console.error('Seeding Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

seedData();
