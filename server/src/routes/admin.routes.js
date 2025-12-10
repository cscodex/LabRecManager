const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const PDFDocument = require('pdfkit');

// Multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    }
});

/**
 * @route   POST /api/admin/students/import
 * @desc    Import students from CSV
 * @access  Private (Admin)
 */
router.post('/students/import', authenticate, authorize('admin', 'principal'), upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: 'Please upload a CSV file'
        });
    }

    const results = [];
    const errors = [];
    const schoolId = req.user.schoolId;
    const defaultPassword = 'Password123!';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Parse CSV from buffer
    const csvData = [];
    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
        stream
            .pipe(csv())
            .on('data', (row) => csvData.push(row))
            .on('end', resolve)
            .on('error', reject);
    });

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const rowNum = i + 2; // Account for header row

        try {
            // Extract and validate fields
            const firstName = row.first_name || row.firstName || row['First Name'] || '';
            const lastName = row.last_name || row.lastName || row['Last Name'] || '';
            const email = row.email || row.Email || '';
            const admissionNumber = row.admission_number || row.admissionNumber || row['Admission Number'] || row['Roll No'] || '';
            const phone = row.phone || row.Phone || row['Mobile'] || '';
            const className = row.class || row.Class || row['Class Name'] || '';
            const section = row.section || row.Section || '';
            const trade = row.trade || row.Trade || row['Stream'] || '';
            const gender = (row.gender || row.Gender || 'male').toLowerCase();
            const dateOfBirth = row.dob || row.date_of_birth || row['Date of Birth'] || null;

            // Validate required fields
            if (!firstName || !lastName || !email) {
                errors.push({ row: rowNum, error: 'Missing required fields (first_name, last_name, email)' });
                continue;
            }

            // Check if email already exists
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                errors.push({ row: rowNum, email, error: 'Email already exists' });
                continue;
            }

            // Find or create class if specified
            let classId = null;
            if (className) {
                let classRecord = await prisma.class.findFirst({
                    where: {
                        schoolId,
                        OR: [
                            { name: { equals: className, mode: 'insensitive' } },
                            { gradeLevel: parseInt(className) || 0 }
                        ]
                    }
                });

                if (!classRecord && parseInt(className)) {
                    // Create the class if it doesn't exist
                    classRecord = await prisma.class.create({
                        data: {
                            schoolId,
                            gradeLevel: parseInt(className),
                            section: section || 'A',
                            name: `Class ${className}${section ? '-' + section : ''}`,
                            academicYearId: (await prisma.academicYear.findFirst({
                                where: { schoolId, isCurrent: true }
                            }))?.id
                        }
                    });
                }

                classId = classRecord?.id;
            }

            // Create user
            const user = await prisma.user.create({
                data: {
                    schoolId,
                    email,
                    passwordHash: hashedPassword,
                    firstName,
                    lastName,
                    role: 'student',
                    admissionNumber,
                    phone,
                    gender,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                    isActive: true,
                    isVerified: true
                }
            });

            // Enroll in class if classId exists
            if (classId) {
                await prisma.classEnrollment.create({
                    data: {
                        classId,
                        studentId: user.id,
                        rollNumber: parseInt(admissionNumber) || null,
                        status: 'active'
                    }
                });
            }

            results.push({
                email,
                name: `${firstName} ${lastName}`,
                class: className || 'Not assigned',
                status: 'Created'
            });

        } catch (error) {
            errors.push({ row: rowNum, error: error.message });
        }
    }

    res.json({
        success: true,
        message: `Imported ${results.length} students successfully`,
        data: {
            imported: results.length,
            failed: errors.length,
            results,
            errors,
            defaultPassword
        }
    });
}));

/**
 * @route   GET /api/admin/students/export/csv
 * @desc    Export students to CSV
 * @access  Private (Admin)
 */
router.get('/students/export/csv', authenticate, authorize('admin', 'principal', 'instructor'), asyncHandler(async (req, res) => {
    const { classId, status } = req.query;
    const schoolId = req.user.schoolId;

    let where = { schoolId, role: 'student' };
    if (status) where.isActive = status === 'active';

    // Get students with class info
    const students = await prisma.user.findMany({
        where,
        include: {
            classEnrollments: {
                where: { status: 'active' },
                include: {
                    class: { select: { name: true, gradeLevel: true, section: true } }
                }
            }
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    // Filter by class if specified
    let filteredStudents = students;
    if (classId) {
        filteredStudents = students.filter(s =>
            s.classEnrollments.some(e => e.classId === classId)
        );
    }

    // Generate CSV
    const csvHeader = 'Admission No,First Name,Last Name,Email,Phone,Class,Section,Gender,Status\n';
    const csvRows = filteredStudents.map(s => {
        const enrollment = s.classEnrollments[0];
        const className = enrollment?.class?.name || enrollment?.class?.gradeLevel || '';
        const section = enrollment?.class?.section || '';
        return `"${s.admissionNumber || ''}","${s.firstName}","${s.lastName}","${s.email}","${s.phone || ''}","${className}","${section}","${s.gender || ''}","${s.isActive ? 'Active' : 'Inactive'}"`;
    }).join('\n');

    const csvContent = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=students_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
}));

/**
 * @route   GET /api/admin/students/export/pdf
 * @desc    Export students to PDF
 * @access  Private (Admin)
 */
router.get('/students/export/pdf', authenticate, authorize('admin', 'principal', 'instructor'), asyncHandler(async (req, res) => {
    const { classId, status } = req.query;
    const schoolId = req.user.schoolId;

    let where = { schoolId, role: 'student' };
    if (status) where.isActive = status === 'active';

    // Get school info
    const school = await prisma.school.findUnique({ where: { id: schoolId } });

    // Get students with class info
    const students = await prisma.user.findMany({
        where,
        include: {
            classEnrollments: {
                where: { status: 'active' },
                include: {
                    class: { select: { name: true, gradeLevel: true, section: true } }
                }
            }
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
    });

    // Filter by class if specified
    let filteredStudents = students;
    if (classId) {
        filteredStudents = students.filter(s =>
            s.classEnrollments.some(e => e.classId === classId)
        );
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=students_export_${new Date().toISOString().split('T')[0]}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(school?.name || 'School', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Student List', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();

    // Table header
    const tableTop = doc.y;
    const colWidths = [60, 100, 120, 80, 60, 50];
    const headers = ['Adm. No', 'Name', 'Email', 'Class', 'Phone', 'Status'];

    doc.font('Helvetica-Bold').fontSize(9);
    let xPos = 50;
    headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i] });
        xPos += colWidths[i];
    });

    doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

    // Table rows
    doc.font('Helvetica').fontSize(8);
    let yPos = tableTop + 20;

    filteredStudents.forEach((student, index) => {
        if (yPos > 750) {
            doc.addPage();
            yPos = 50;
        }

        const enrollment = student.classEnrollments[0];
        const className = enrollment?.class?.name || `${enrollment?.class?.gradeLevel || ''}-${enrollment?.class?.section || ''}`;

        xPos = 50;
        const rowData = [
            student.admissionNumber || '-',
            `${student.firstName} ${student.lastName}`,
            student.email,
            className || '-',
            student.phone || '-',
            student.isActive ? 'Active' : 'Inactive'
        ];

        rowData.forEach((data, i) => {
            doc.text(data.substring(0, 20), xPos, yPos, { width: colWidths[i] });
            xPos += colWidths[i];
        });

        yPos += 15;
    });

    // Footer
    doc.fontSize(10).text(`Total Students: ${filteredStudents.length}`, 50, yPos + 20);

    doc.end();
}));

/**
 * @route   POST /api/admin/students/bulk-assign
 * @desc    Bulk assign students to a class
 * @access  Private (Admin)
 */
router.post('/students/bulk-assign', authenticate, authorize('admin', 'principal'), [
    body('studentIds').isArray().withMessage('Student IDs array required'),
    body('classId').isUUID().withMessage('Valid class ID required')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { studentIds, classId } = req.body;

    // Verify class exists
    const classRecord = await prisma.class.findUnique({ where: { id: classId } });
    if (!classRecord) {
        return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const results = [];
    const errors_list = [];

    for (const studentId of studentIds) {
        try {
            // Check if enrollment already exists
            const existing = await prisma.classEnrollment.findFirst({
                where: { studentId, classId }
            });

            if (existing) {
                // Update existing enrollment
                await prisma.classEnrollment.update({
                    where: { id: existing.id },
                    data: { status: 'active' }
                });
            } else {
                // Deactivate other enrollments for this student
                await prisma.classEnrollment.updateMany({
                    where: { studentId, status: 'active' },
                    data: { status: 'transferred' }
                });

                // Create new enrollment
                await prisma.classEnrollment.create({
                    data: {
                        classId,
                        studentId,
                        status: 'active'
                    }
                });
            }
            results.push(studentId);
        } catch (error) {
            errors_list.push({ studentId, error: error.message });
        }
    }

    res.json({
        success: true,
        message: `Assigned ${results.length} students to class`,
        data: {
            assigned: results.length,
            failed: errors_list.length,
            className: classRecord.name || `Class ${classRecord.gradeLevel}-${classRecord.section}`,
            errors: errors_list
        }
    });
}));

/**
 * @route   GET /api/admin/students/template
 * @desc    Download CSV template for import
 * @access  Private (Admin)
 */
router.get('/students/template', authenticate, authorize('admin', 'principal'), (req, res) => {
    const template = `first_name,last_name,email,admission_number,phone,class,section,trade,gender,date_of_birth
John,Doe,john.doe@school.edu,2024001,9876543210,11,A,Science,male,2008-05-15
Jane,Smith,jane.smith@school.edu,2024002,9876543211,11,B,Commerce,female,2008-07-20
`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=student_import_template.csv');
    res.send(template);
});

/**
 * @route   GET /api/admin/stats
 * @desc    Get admin dashboard stats
 * @access  Private (Admin)
 */
router.get('/stats', authenticate, authorize('admin', 'principal'), asyncHandler(async (req, res) => {
    const schoolId = req.user.schoolId;

    const [
        totalStudents,
        activeStudents,
        totalClasses,
        totalInstructors
    ] = await Promise.all([
        prisma.user.count({ where: { schoolId, role: 'student' } }),
        prisma.user.count({ where: { schoolId, role: 'student', isActive: true } }),
        prisma.class.count({ where: { schoolId } }),
        prisma.user.count({ where: { schoolId, role: 'instructor' } })
    ]);

    res.json({
        success: true,
        data: {
            totalStudents,
            activeStudents,
            inactiveStudents: totalStudents - activeStudents,
            totalClasses,
            totalInstructors
        }
    });
}));

module.exports = router;
