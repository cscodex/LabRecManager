const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const prisma = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @route   GET /api/fees/categories
 * @desc    Get fee categories
 * @access  Private
 */
router.get('/categories', authenticate, asyncHandler(async (req, res) => {
    const categories = await prisma.feeCategory.findMany({
        where: { schoolId: req.user.schoolId },
        orderBy: { name: 'asc' }
    });

    res.json({
        success: true,
        data: { categories }
    });
}));

/**
 * @route   POST /api/fees/categories
 * @desc    Create fee category
 * @access  Private (Admin, Accountant)
 */
router.post('/categories', authenticate, authorize('admin', 'principal', 'accountant'), asyncHandler(async (req, res) => {
    const { name, nameHindi, description, isRecurring, frequency } = req.body;

    const category = await prisma.feeCategory.create({
        data: {
            schoolId: req.user.schoolId,
            name,
            nameHindi,
            description,
            isRecurring: isRecurring !== false,
            frequency: frequency || 'yearly'
        }
    });

    res.status(201).json({
        success: true,
        message: 'Fee category created',
        data: { category }
    });
}));

/**
 * @route   GET /api/fees/structure
 * @desc    Get fee structure
 * @access  Private
 */
router.get('/structure', authenticate, asyncHandler(async (req, res) => {
    const { academicYearId, classId, subjectId } = req.query;

    let where = { schoolId: req.user.schoolId };
    if (academicYearId) where.academicYearId = academicYearId;
    if (classId) where.classId = classId;
    if (subjectId) where.subjectId = subjectId;

    const structure = await prisma.feeStructure.findMany({
        where,
        include: {
            feeCategory: true,
            class: {
                select: { id: true, name: true, gradeLevel: true }
            },
            subject: {
                select: { id: true, name: true, code: true }
            },
            academicYear: {
                select: { yearLabel: true }
            }
        }
    });

    res.json({
        success: true,
        data: { structure }
    });
}));

/**
 * @route   POST /api/fees/structure
 * @desc    Create fee structure
 * @access  Private (Admin, Accountant)
 */
router.post('/structure', authenticate, authorize('admin', 'principal', 'accountant'), [
    body('feeCategoryId').isUUID(),
    body('academicYearId').isUUID(),
    body('amount').isFloat({ min: 0 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const {
        feeCategoryId, academicYearId, classId, subjectId,
        amount, currency, dueDate, concessionApplicable
    } = req.body;

    const structure = await prisma.feeStructure.create({
        data: {
            schoolId: req.user.schoolId,
            feeCategoryId,
            academicYearId,
            classId,
            subjectId,
            amount,
            currency: currency || 'INR',
            dueDate: dueDate ? new Date(dueDate) : null,
            concessionApplicable: concessionApplicable !== false
        }
    });

    res.status(201).json({
        success: true,
        message: 'Fee structure created',
        data: { structure }
    });
}));

/**
 * @route   GET /api/fees/student/:studentId
 * @desc    Get student's fees
 * @access  Private
 */
router.get('/student/:studentId', authenticate, asyncHandler(async (req, res) => {
    // Students can only view their own fees
    if (req.user.role === 'student' && req.user.id !== req.params.studentId) {
        return res.status(403).json({
            success: false,
            message: 'Not authorized'
        });
    }

    const fees = await prisma.studentFee.findMany({
        where: { studentId: req.params.studentId },
        include: {
            feeStructure: {
                include: {
                    feeCategory: true,
                    subject: {
                        select: { name: true, nameHindi: true }
                    }
                }
            },
            academicYear: {
                select: { yearLabel: true }
            },
            payments: {
                orderBy: { paymentDate: 'desc' }
            }
        }
    });

    // Calculate totals
    const summary = {
        totalDue: 0,
        totalPaid: 0,
        pending: 0
    };

    fees.forEach(fee => {
        summary.totalDue += parseFloat(fee.finalAmount);
        const paid = fee.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        summary.totalPaid += paid;
    });
    summary.pending = summary.totalDue - summary.totalPaid;

    res.json({
        success: true,
        data: { fees, summary }
    });
}));

/**
 * @route   POST /api/fees/payments
 * @desc    Record a fee payment
 * @access  Private (Admin, Accountant)
 */
router.post('/payments', authenticate, authorize('admin', 'accountant'), [
    body('studentFeeId').isUUID(),
    body('amount').isFloat({ min: 0 }),
    body('paymentMode').isIn(['cash', 'cheque', 'upi', 'card', 'net_banking', 'dd'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }

    const {
        studentFeeId, studentId, amount, paymentMode,
        transactionId, receiptNumber, remarks
    } = req.body;

    // Generate receipt number if not provided
    const generatedReceiptNumber = receiptNumber ||
        `REC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const payment = await prisma.feePayment.create({
        data: {
            studentFeeId,
            studentId,
            amount,
            paymentMode,
            transactionId,
            receiptNumber: generatedReceiptNumber,
            collectedById: req.user.id,
            remarks
        }
    });

    // Update fee status
    const studentFee = await prisma.studentFee.findUnique({
        where: { id: studentFeeId },
        include: { payments: true }
    });

    const totalPaid = studentFee.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const newStatus = totalPaid >= parseFloat(studentFee.finalAmount) ? 'paid' : 'partial';

    await prisma.studentFee.update({
        where: { id: studentFeeId },
        data: { status: newStatus }
    });

    res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        messageHindi: 'भुगतान सफलतापूर्वक दर्ज किया गया',
        data: { payment, receiptNumber: generatedReceiptNumber }
    });
}));

/**
 * @route   GET /api/fees/reports/collection
 * @desc    Get fee collection report
 * @access  Private (Admin, Accountant)
 */
router.get('/reports/collection', authenticate, authorize('admin', 'accountant', 'principal'), asyncHandler(async (req, res) => {
    const { startDate, endDate, classId, paymentMode } = req.query;

    let where = {};

    if (startDate && endDate) {
        where.paymentDate = {
            gte: new Date(startDate),
            lte: new Date(endDate)
        };
    }

    if (paymentMode) {
        where.paymentMode = paymentMode;
    }

    const payments = await prisma.feePayment.findMany({
        where,
        include: {
            studentFee: {
                include: {
                    feeStructure: {
                        include: {
                            feeCategory: true,
                            class: true
                        }
                    }
                }
            },
            collectedBy: {
                select: { firstName: true, lastName: true }
            }
        },
        orderBy: { paymentDate: 'desc' }
    });

    // Aggregate by payment mode
    const byPaymentMode = payments.reduce((acc, p) => {
        acc[p.paymentMode] = (acc[p.paymentMode] || 0) + parseFloat(p.amount);
        return acc;
    }, {});

    // Total collection
    const totalCollection = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    res.json({
        success: true,
        data: {
            payments,
            summary: {
                totalCollection,
                byPaymentMode,
                transactionCount: payments.length
            }
        }
    });
}));

module.exports = router;
