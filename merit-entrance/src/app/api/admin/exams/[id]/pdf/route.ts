import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import puppeteer from 'puppeteer';

// Helper to safely extract text from bilingial JSON field
const extractText = (field: any) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    // Prefer English if both exist, or combine them
    let text = '';
    if (field.en) text += `<div>${field.en}</div>`;
    if (field.pa) text += `<div class="punjabi">${field.pa}</div>`;
    return text || JSON.stringify(field);
};

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const url = new URL(request.url);
        const schoolName = url.searchParams.get('schoolName') || 'Merit Entrance Exam';
        const examNameOption = url.searchParams.get('examNameOption') || '';
        const showPageNumbers = url.searchParams.get('showPageNumbers') !== 'false';
        const showDateTime = url.searchParams.get('showDateTime') !== 'false';
        const compactSpacing = url.searchParams.get('compactSpacing') === 'true';

        const examId = params.id;

        const exam = await prisma.exam.findUnique({
            where: { id: examId },
            include: {
                sections: {
                    include: {
                        questions: {
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        });

        if (!exam) {
            return new NextResponse('Exam not found', { status: 404 });
        }

        const examTitleText = typeof exam.title === 'string' ? exam.title : (exam.title as any)?.en || 'Exam';
        const finalExamName = examNameOption || examTitleText;

        // Build HTML content
        let htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        font-size: ${compactSpacing ? '12px' : '14px'};
                        line-height: ${compactSpacing ? '1.3' : '1.5'};
                        color: #000;
                        margin: 0;
                        padding: 0;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #000;
                        padding-bottom: 10px;
                    }
                    .school-name { font-size: 24px; font-weight: bold; text-transform: uppercase; }
                    .exam-name { font-size: 18px; margin-top: 5px; }
                    .exam-meta { font-size: 14px; margin-top: 10px; display: flex; justify-content: space-between; }
                    
                    .section-title {
                        font-size: 16px;
                        font-weight: bold;
                        margin-top: 20px;
                        margin-bottom: 10px;
                        text-decoration: underline;
                    }
                    
                    .question-container {
                        margin-bottom: ${compactSpacing ? '15px' : '25px'};
                        page-break-inside: avoid;
                    }
                    .question-header {
                        display: flex;
                        justify-content: space-between;
                        font-weight: bold;
                    }
                    .question-text {
                        margin-top: 5px;
                        margin-bottom: 10px;
                    }
                    .options-list {
                        list-style-type: none;
                        padding-left: 20px;
                        margin: 0;
                    }
                    .option-item {
                        margin-bottom: 5px;
                    }
                    .punjabi {
                        font-family: "GurbaniLipi", "Mukta Mahee", sans-serif;
                    }
                    /* Ensure images in questions don't overflow */
                    img {
                        max-width: 100%;
                        height: auto;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="school-name">${schoolName}</div>
                    <div class="exam-name">${finalExamName}</div>
                    <div class="exam-meta">
                        <span>Time: ${exam.duration} Mins</span>
                        <span>Total Marks: ${exam.totalMarks}</span>
                    </div>
                </div>
        `;

        let qCount = 1;
        for (const section of exam.sections) {
            const sectionName = extractText(section.name);
            htmlContent += `<div class="section-title">${sectionName}</div>`;

            for (const q of section.questions) {
                const qText = extractText(q.text);

                htmlContent += `
                    <div class="question-container">
                        <div class="question-header">
                            <span>Q${qCount}. </span>
                            <span>[${q.marks} Marks]</span>
                        </div>
                        <div class="question-text">${qText}</div>
                `;

                if (q.imageUrl) {
                    htmlContent += `<div style="margin: 10px 0;"><img src="${q.imageUrl}" style="max-height:200px;" alt="Question Image" /></div>`;
                }

                // Render options if any
                if (q.options && Array.isArray(q.options) && q.options.length > 0) {
                    htmlContent += `<ul class="options-list">`;
                    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
                    q.options.forEach((opt: any, idx: number) => {
                        htmlContent += `
                            <li class="option-item">
                                <strong>(${labels[idx] || idx + 1})</strong> ${extractText(opt.text)}
                            </li>
                        `;
                    });
                    htmlContent += `</ul>`;
                }

                htmlContent += `</div>`;
                qCount++;
            }
        }

        htmlContent += `
            </body>
            </html>
        `;

        // Generate PDF using Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Configure header and footer templates
        let headerTemplate = "<span></span>"; // Empty by default
        let footerTemplate = "<span></span>";

        if (showPageNumbers || showDateTime) {
            let leftFooter = showDateTime ? `<span class="date"></span> <span class="title"></span>` : "";
            let rightFooter = showPageNumbers ? `Page <span class="pageNumber"></span> of <span class="totalPages"></span>` : "";

            footerTemplate = `
                <div style="font-size: 10px; font-family: Arial, sans-serif; width: 100%; text-align: center; display: flex; justify-content: space-between; padding: 0 20px;">
                    <span style="color: #555;">${leftFooter}</span>
                    <span style="color: #555;">${rightFooter}</span>
                </div>
            `;
        }

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                bottom: (showPageNumbers || showDateTime) ? '40px' : '20px',
                left: '20px',
                right: '20px'
            },
            displayHeaderFooter: showPageNumbers || showDateTime,
            headerTemplate,
            footerTemplate
        });

        await browser.close();

        return new NextResponse(pdfBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${finalExamName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf"`
            }
        });
    } catch (error: any) {
        console.error('Failed to generate PDF:', error);
        return NextResponse.json({ success: false, error: 'Failed to generate PDF: ' + error.message }, { status: 500 });
    }
}
