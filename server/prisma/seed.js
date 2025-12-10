const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Clean up existing data (in reverse order of dependencies)
    console.log('🧹 Cleaning existing data...');
    const cleanupTables = [
        'grade', 'submissionFile', 'submissionRevision', 'vivaSession',
        'submission', 'assignmentTarget', 'assignmentFile', 'assignment',
        'vivaQuestion', 'labMaterialUsage', 'labMaterial', 'labSchedule',
        'lab', 'classEnrollment', 'studentGroup', 'class', 'subject',
        'academicYear', 'activityLog', 'notification', 'notificationTemplate',
        'userSession', 'feeCategory', 'user', 'school'
    ];

    for (const table of cleanupTables) {
        try {
            if (prisma[table]) {
                await prisma[table].deleteMany();
            }
        } catch (e) {
            // Table might not exist, ignore
        }
    }
    console.log('✅ Cleanup complete');

    // Create School
    const school = await prisma.school.create({
        data: {
            name: 'Delhi Public School',
            nameHindi: 'दिल्ली पब्लिक स्कूल',
            code: 'DPS001',
            address: '123 Education Lane, New Delhi',
            state: 'Delhi',
            district: 'South Delhi',
            boardAffiliation: 'CBSE',
            primaryLanguage: 'en',
            secondaryLanguages: ['hi']
        }
    });
    console.log('✅ School created');

    // Create Academic Year
    const academicYear = await prisma.academicYear.create({
        data: {
            schoolId: school.id,
            yearLabel: '2024-25',
            startDate: new Date('2024-04-01'),
            endDate: new Date('2025-03-31'),
            isCurrent: true
        }
    });
    console.log('✅ Academic Year created');

    // Hash passwords
    const salt = await bcrypt.genSalt(10);
    const adminPass = await bcrypt.hash('admin123', salt);
    const instructorPass = await bcrypt.hash('instructor123', salt);
    const studentPass = await bcrypt.hash('student123', salt);

    // Create Admin
    await prisma.user.create({
        data: {
            schoolId: school.id,
            email: 'admin@dps.edu',
            passwordHash: adminPass,
            role: 'admin',
            firstName: 'Admin',
            lastName: 'User',
            employeeId: 'ADM001'
        }
    });
    console.log('✅ Admin created (admin@dps.edu / admin123)');

    // Create Instructor
    const instructor = await prisma.user.create({
        data: {
            schoolId: school.id,
            email: 'instructor@dps.edu',
            passwordHash: instructorPass,
            role: 'instructor',
            firstName: 'Rajesh',
            firstNameHindi: 'राजेश',
            lastName: 'Kumar',
            lastNameHindi: 'कुमार',
            employeeId: 'INS001'
        }
    });
    console.log('✅ Instructor created (instructor@dps.edu / instructor123)');

    // Create Subject
    const subject = await prisma.subject.create({
        data: {
            schoolId: school.id,
            code: 'CS',
            name: 'Computer Science',
            nameHindi: 'कंप्यूटर विज्ञान',
            hasLab: true,
            labHoursPerWeek: 4
        }
    });

    // Create Lab
    const lab = await prisma.lab.create({
        data: {
            schoolId: school.id,
            subjectId: subject.id,
            name: 'Computer Lab 1',
            nameHindi: 'कंप्यूटर लैब 1',
            roomNumber: 'LAB-101',
            capacity: 30,
            inchargeId: instructor.id
        }
    });
    console.log('✅ Subject and Lab created');

    // Create Class
    const classData = await prisma.class.create({
        data: {
            schoolId: school.id,
            academicYearId: academicYear.id,
            name: '11-A Science',
            nameHindi: '11-ए विज्ञान',
            gradeLevel: 11,
            section: 'A',
            stream: 'Science'
        }
    });

    // Create Students
    const students = [];
    for (let i = 1; i <= 5; i++) {
        const student = await prisma.user.create({
            data: {
                schoolId: school.id,
                email: `student${i}@dps.edu`,
                passwordHash: studentPass,
                role: 'student',
                firstName: `Student`,
                lastName: `${i}`,
                admissionNumber: `STU00${i}`
            }
        });
        students.push(student);

        await prisma.classEnrollment.create({
            data: {
                studentId: student.id,
                classId: classData.id,
                rollNumber: i
            }
        });
    }
    console.log('✅ 5 Students created (student1@dps.edu to student5@dps.edu / student123)');

    // Create Sample Assignment
    const assignment = await prisma.assignment.create({
        data: {
            schoolId: school.id,
            subjectId: subject.id,
            labId: lab.id,
            createdById: instructor.id,
            title: 'Python: Hello World Program',
            titleHindi: 'पायथन: हैलो वर्ल्ड प्रोग्राम',
            description: 'Write a simple Python program that prints "Hello, World!"',
            experimentNumber: 'EXP-01',
            assignmentType: 'program',
            programmingLanguage: 'Python',
            maxMarks: 100,
            passingMarks: 35,
            vivaMarks: 20,
            practicalMarks: 60,
            outputMarks: 20,
            status: 'published',
            publishDate: new Date(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    });

    // Assign to class
    await prisma.assignmentTarget.create({
        data: {
            assignmentId: assignment.id,
            targetType: 'class',
            targetClassId: classData.id,
            assignedById: instructor.id
        }
    });
    console.log('✅ Sample assignment created and assigned');

    // Create sample submissions from first 2 students
    const submission1 = await prisma.submission.create({
        data: {
            assignmentId: assignment.id,
            studentId: students[0].id,
            codeContent: `# Python Hello World Program
print("Hello, World!")
print("नमस्ते, दुनिया!")

# Additional output
for i in range(3):
    print(f"Line {i+1}")`,
            outputContent: `Hello, World!
नमस्ते, दुनिया!
Line 1
Line 2
Line 3`,
            observations: 'Successfully printed output in both English and Hindi.',
            conclusion: 'Learned basic Python print statements and loops.',
            submissionNumber: 1,
            status: 'graded'
        }
    });

    // Grade the first submission
    await prisma.grade.create({
        data: {
            submissionId: submission1.id,
            studentId: students[0].id,
            gradedById: instructor.id,
            practicalMarks: 55,
            outputMarks: 18,
            vivaMarks: 15,
            totalMarks: 88,
            latePenaltyMarks: 0,
            finalMarks: 88,
            maxMarks: 100,
            percentage: 88,
            gradeLetter: 'A',
            codeFeedback: 'Good code structure. Consider using functions.',
            generalRemarks: 'Excellent work!',
            isPublished: true
        }
    });

    const submission2 = await prisma.submission.create({
        data: {
            assignmentId: assignment.id,
            studentId: students[1].id,
            codeContent: `print("Hello, World!")`,
            outputContent: `Hello, World!`,
            observations: 'Basic program execution.',
            conclusion: 'Understood print function.',
            submissionNumber: 1,
            status: 'submitted'
        }
    });
    console.log('✅ Student submissions created with grades');

    // Create Fee Category
    await prisma.feeCategory.create({
        data: {
            schoolId: school.id,
            name: 'Lab Fee',
            nameHindi: 'प्रयोगशाला शुल्क',
            frequency: 'yearly'
        }
    });
    console.log('✅ Fee category created');

    console.log('\n🎉 Database seeded successfully!\n');
    console.log('Login credentials:');
    console.log('  Admin: admin@dps.edu / admin123');
    console.log('  Instructor: instructor@dps.edu / instructor123');
    console.log('  Students: student1@dps.edu to student5@dps.edu / student123');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
