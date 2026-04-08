const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedTrainingModules() {
    console.log('Starting Training Modules seeding...');
    
    try {
        // Fetch a school to attach modules to
        const school = await prisma.school.findFirst();
        
        if (!school) {
            console.log('No school found in the database. Please seed basic data first.');
            process.exit(1);
        }

        // Check if modules already exist
        const existingCount = await prisma.trainingModule.count();
        if (existingCount > 0) {
            console.log(`Found ${existingCount} existing training modules. Skipping seeding.`);
            process.exit(0);
        }

        console.log(`Seeding training modules for school: ${school.name}`);

        // Create Intro to Python Module
        const pythonModule = await prisma.trainingModule.create({
            data: {
                schoolId: school.id,
                title: 'Introduction to Python for Beginners',
                titleHindi: 'शुरुआती लोगों के लिए पायथन का परिचय',
                description: 'A comprehensive beginner course introducing basic programming concepts using Python 3.',
                language: 'Python',
                boardAligned: 'CBSE',
                classLevel: 9,
                totalUnits: 2,
                totalExercises: 4,
                isPublished: true,
                units: {
                    create: [
                        {
                            unitNumber: 1,
                            title: 'Getting Started with Variables',
                            description: 'Learn how to store and manipulate data in Python.',
                            expectedHours: 2,
                            exercises: {
                                create: [
                                    {
                                        exerciseNumber: 1,
                                        title: 'Hello World',
                                        description: 'Write your first Python program to output text to the screen.',
                                        type: 'coding',
                                        instructions: 'Use the `print()` function to output the phrase "Hello World!" exactly as shown.',
                                        difficulty: 'Beginner',
                                        totalPoints: 10,
                                        language: 'python',
                                        testCases: {
                                            create: [
                                                { input: '', expectedOutput: 'Hello World!\n', isHidden: false, points: 10 }
                                            ]
                                        }
                                    },
                                    {
                                        exerciseNumber: 2,
                                        title: 'Variable Math',
                                        description: 'Add two numbers together.',
                                        type: 'coding',
                                        instructions: 'Create a variable `a=5` and `b=10`. Print their sum.',
                                        difficulty: 'Beginner',
                                        totalPoints: 20,
                                        language: 'python',
                                        testCases: {
                                            create: [
                                                { input: '', expectedOutput: '15\n', isHidden: false, points: 20 }
                                            ]
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            unitNumber: 2,
                            title: 'Control Structures',
                            description: 'If statements and loops.',
                            expectedHours: 3,
                            exercises: {
                                create: [
                                    {
                                        exerciseNumber: 1,
                                        title: 'Even or Odd',
                                        description: 'Check if a number is even or odd.',
                                        type: 'coding',
                                        instructions: 'Take an integer input from user, print "Even" if even, "Odd" if odd.',
                                        difficulty: 'Intermediate',
                                        totalPoints: 30,
                                        language: 'python',
                                        testCases: {
                                            create: [
                                                { input: '4', expectedOutput: 'Even\n', isHidden: false, points: 15 },
                                                { input: '7', expectedOutput: 'Odd\n', isHidden: false, points: 15 }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        });

        console.log(`Created Training Module: ${pythonModule.title}`);

        // Create Intro to HTML Module
        const htmlModule = await prisma.trainingModule.create({
            data: {
                schoolId: school.id,
                title: 'HTML & Web Basics',
                description: 'Start building web pages from scratch.',
                language: 'HTML',
                boardAligned: 'ICSE',
                classLevel: 8,
                totalUnits: 1,
                totalExercises: 1,
                isPublished: true,
                units: {
                    create: [
                        {
                            unitNumber: 1,
                            title: 'Basic Tags',
                            description: 'Headings, paragraphs, and lists.',
                            expectedHours: 1,
                            exercises: {
                                create: [
                                    {
                                        exerciseNumber: 1,
                                        title: 'My First Webpage',
                                        description: 'Use h1 and p tags.',
                                        type: 'coding',
                                        instructions: 'Create an h1 tag with "Welcome" and a p tag with "Learning HTML".',
                                        difficulty: 'Beginner',
                                        totalPoints: 10,
                                        language: 'html',
                                        testCases: {
                                            create: [
                                                { input: '', expectedOutput: '<h1>Welcome</h1>\n<p>Learning HTML</p>', isHidden: false, points: 10 }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        });

        console.log(`Created Training Module: ${htmlModule.title}`);
        console.log('Seeding completed successfully!');
        
    } catch (error) {
        console.error('Error seeding training modules:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seedTrainingModules();
