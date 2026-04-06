const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PSEB_EXERCISES = [
  {
    title: 'Hello World & Print Formatting',
    description: 'Write a Python program that prints exactly: "Hello, World! Welcome to Python."',
    difficulty: 'beginner',
    scaffoldLevel: 'guided',
    isReviewExercise: false,
    starterCode: '# Print the welcome message below\n\n',
    solutionCode: 'print("Hello, World! Welcome to Python.")',
    testCases: [
      { input: '', expected: 'Hello, World! Welcome to Python.\n', isHidden: false }
    ],
    hints: ['Make sure your punctuation exactly matches the prompt, including the comma and exclamation mark.'],
    timeLimit: 5,
    xpReward: 10,
    sequenceOrder: 1
  },
  {
    title: 'Variables & Type Conversion',
    description: 'Given a string variable `num_str = "45"`, convert it to an integer and print the result of adding 5 to it.',
    difficulty: 'beginner',
    scaffoldLevel: 'guided',
    isReviewExercise: false,
    starterCode: 'num_str = "45"\n# Convert and add 5\n\n',
    solutionCode: 'num_str = "45"\nnum = int(num_str)\nprint(num + 5)',
    testCases: [
      { input: '', expected: '50\n', isHidden: false }
    ],
    hints: ['Use the int() function to convert the string.'],
    timeLimit: 5,
    xpReward: 10,
    sequenceOrder: 2
  },
  {
    title: 'Even or Odd Checker',
    description: 'Write a program to accept a number from input and print "Even" if the number is even, and "Odd" if it is odd.',
    difficulty: 'beginner',
    scaffoldLevel: 'semi_guided',
    isReviewExercise: false,
    starterCode: 'n = int(input())\n# Write your if-else logic here\n\n',
    solutionCode: 'n = int(input())\nif n % 2 == 0:\n    print("Even")\nelse:\n    print("Odd")',
    testCases: [
      { input: '4', expected: 'Even\n', isHidden: false },
      { input: '7', expected: 'Odd\n', isHidden: false },
      { input: '0', expected: 'Even\n', isHidden: true }
    ],
    hints: ['Use the modulo operator % to check for remainders.'],
    timeLimit: 5,
    xpReward: 15,
    sequenceOrder: 1
  },
  {
    title: '★ Mini-Project: Student Grade Calculator',
    description: 'Accept 3 subject marks from input. Calculate the average. If average >= 80 print "Grade A", if >= 60 print "Grade B", else print "Grade C".',
    difficulty: 'intermediate',
    scaffoldLevel: 'project',
    isReviewExercise: true,
    starterCode: '# Write your grade calculator here (read 3 inputs)\n\n',
    solutionCode: 'm1 = int(input())\nm2 = int(input())\nm3 = int(input())\navg = (m1 + m2 + m3) / 3\nif avg >= 80:\n    print("Grade A")\nelif avg >= 60:\n    print("Grade B")\nelse:\n    print("Grade C")',
    testCases: [
      { input: '85\n90\n80', expected: 'Grade A\n', isHidden: false },
      { input: '60\n65\n55', expected: 'Grade B\n', isHidden: false },
      { input: '40\n50\n30', expected: 'Grade C\n', isHidden: true }
    ],
    hints: ['Remember to divide the sum by 3 to get the average.', 'Use if-elif-else statements.'],
    timeLimit: 5,
    xpReward: 30,
    sequenceOrder: 2
  }
];

async function main() {
    console.log('Seeding Training Modules...');

    // Need a dummy school ID to link the module to. 
    // In a multi-tenant DB, we usually find the First active school or 'default' school.
    const school = await prisma.school.findFirst();
    if (!school) {
        console.error('No school found in the database. Please setup standard Db first.');
        return;
    }

    // 1. Create Class 11 PSEB Module
    const module11 = await prisma.trainingModule.create({
        data: {
            schoolId: school.id,
            title: 'Python Fundamentals (PSEB Class 11)',
            description: 'Mastery-based Python course aligned with Punjab State Education Board for Class 11.',
            language: 'python',
            boardAligned: 'PSEB',
            classLevel: 11,
            totalUnits: 2,
            totalExercises: 4,
            isPublished: true,
        }
    });

    console.log(`Created Module: ${module11.title}`);

    // 2. Create Units
    const unit1 = await prisma.trainingUnit.create({
        data: {
            moduleId: module11.id,
            unitNumber: 1,
            title: 'Python Basics',
            expectedHours: 4,
            unlockThreshold: 80,
            sequenceOrder: 1
        }
    });

    const unit2 = await prisma.trainingUnit.create({
        data: {
            moduleId: module11.id,
            unitNumber: 2,
            title: 'Flow Control',
            expectedHours: 6,
            unlockThreshold: 80,
            sequenceOrder: 2
        }
    });

    console.log(`Created Units for ${module11.title}`);

    // 3. Create Exercises
    // Insert Unit 1 exercises (Basics)
    for (let i = 0; i < 2; i++) {
        await prisma.trainingExercise.create({
            data: {
                unitId: unit1.id,
                ...PSEB_EXERCISES[i]
            }
        });
    }

    // Insert Unit 2 exercises (Flow Control)
    for (let i = 2; i < 4; i++) {
        await prisma.trainingExercise.create({
            data: {
                unitId: unit2.id,
                ...PSEB_EXERCISES[i]
            }
        });
    }

    console.log('Successfully seeded 4 foundational exercises showcasing the pedagogical model.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
