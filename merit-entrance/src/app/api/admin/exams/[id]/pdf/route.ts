import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.MERIT_DATABASE_URL || process.env.MERIT_DIRECT_URL || '');

// Check if text contains Punjabi/Gurmukhi characters
const hasPunjabi = (text: string) => /[\u0A00-\u0A7F]/.test(text);

const extractText = (field: any) => {
    if (!field) return '';
    if (typeof field === 'string') {
        try { field = JSON.parse(field); } catch { return field; }
    }
    const en = field.en || '';
    const pa = field.pa || '';

    // If en and pa are same, or en already contains Punjabi text, just show en
    if (!pa || en === pa || hasPunjabi(en)) return en;
    // Show both: English first, then Punjabi
    return `${en} <span class="punjabi" style="margin-left:6px;">${pa}</span>`;
};

// Extract only English text (for options, answer key)
const extractTextEn = (field: any) => {
    if (!field) return '';
    if (typeof field === 'string') {
        try { field = JSON.parse(field); } catch { return field; }
    }
    return field.en || field.pa || '';
};

const extractTextHtml = (field: any) => {
    if (!field) return '';
    if (typeof field === 'string') {
        try { field = JSON.parse(field); } catch { return field; }
    }
    const en = field.en || '';
    const pa = field.pa || '';

    if (!pa || en === pa || hasPunjabi(en)) return en ? `<div>${en}</div>` : '';
    let text = '';
    if (en) text += `<div>${en}</div>`;
    if (pa) text += `<div class="punjabi">${pa}</div>`;
    return text;
};

function buildExamHtml(
    exam: any,
    sections: any[],
    schoolName: string,
    finalExamName: string,
    compactSpacing: boolean,
    showPageNumbers: boolean,
    showDateTime: boolean,
    isPreview: boolean
) {
    const fs = compactSpacing ? '12px' : '14px';
    const lh = compactSpacing ? '1.3' : '1.5';
    const qGap = compactSpacing ? '6px' : '12px';

    let htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4; margin: 10mm 12mm; }
body {
    font-family: 'Times New Roman', serif;
    font-size: ${fs};
    line-height: ${lh};
    color: #000;
${isPreview ? `
    background: #d1d5db;
    padding: 8px 0;
` : `
    background: transparent;
`}
}
${isPreview ? `
.a4-page {
    width: 210mm;
    min-height: 297mm;
    padding: 10mm 12mm;
    margin: 8mm auto;
    background: #fff;
    box-shadow: 0 2px 10px rgba(0,0,0,0.18);
    border: 1px solid #bbb;
    position: relative;
}
.page-footer {
    position: absolute;
    bottom: 8mm;
    left: 12mm;
    right: 12mm;
    font-size: 9px;
    color: #888;
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #ddd;
    padding-top: 3px;
}
` : `
.a4-page { }
.page-break { page-break-before: always; }
.page-footer { display: none; }
`}
.header {
    text-align: center;
    margin-bottom: 10px;
    border-bottom: 2px solid #000;
    padding-bottom: 6px;
}
.school-name { font-size: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
.exam-name { font-size: 16px; margin-top: 3px; }
.exam-meta { font-size: 12px; margin-top: 6px; display: flex; justify-content: space-between; color: #222; }

.section-title {
    font-size: 13px;
    font-weight: bold;
    margin: 10px 0 6px;
    padding: 3px 6px;
    background: #eee;
    border-left: 3px solid #333;
}

.q {
    margin-bottom: ${qGap};
    page-break-inside: avoid;
}
.q-head {
    display: flex;
    gap: 4px;
    align-items: baseline;
}
.q-num {
    font-weight: bold;
    white-space: nowrap;
    flex-shrink: 0;
}
.q-marks {
    font-size: 11px;
    color: #444;
    white-space: nowrap;
    margin-left: auto;
    flex-shrink: 0;
}
.q-text {
    flex: 1;
}
.q-img {
    margin: 4px 0 4px 20px;
}
.q-img img { max-height: 160px; }

.opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px 14px;
    padding-left: 20px;
    margin-top: 3px;
}
.opts.single-col { grid-template-columns: 1fr; }
.opt {
    display: flex;
    align-items: flex-start;
    gap: 3px;
    padding: 1px 0;
}
.opt-lbl { font-weight: bold; flex-shrink: 0; }
.opt-img { max-height: 50px; max-width: 120px; margin-top: 2px; }

.passage-box {
    background: #f8f8f8;
    border: 1px solid #ccc;
    padding: 8px;
    margin-bottom: 8px;
    font-size: ${compactSpacing ? '11px' : '13px'};
}
.passage-title { font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }

.punjabi { font-family: "GurbaniLipi","Mukta Mahee",sans-serif; }
img { max-width: 100%; height: auto; }

/* Answer Key Section */
.answer-key-section {
    page-break-before: always;
    margin-top: 0;
}
.ak-title {
    font-size: 18px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid #000;
}
.ak-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 13px;
}
.ak-table th, .ak-table td {
    border: 1px solid #999;
    padding: 4px 8px;
    text-align: left;
}
.ak-table th {
    background: #eee;
    font-weight: bold;
}
.ak-table tr:nth-child(even) { background: #fafafa; }

.explanation-block {
    margin-bottom: 10px;
    page-break-inside: avoid;
}
.explanation-block .exp-q {
    font-weight: bold;
    margin-bottom: 2px;
}
.explanation-block .exp-text {
    padding-left: 16px;
    color: #333;
}

@media print {
    body { background: transparent !important; }
    .a4-page { box-shadow: none !important; border: none !important; margin: 0 !important; padding: 0 !important; min-height: auto !important; }
}
</style>
<script>
window.MathJax = {
    tex: {
        inlineMath: [['$','$'],['\\\\(','\\\\)']],
        displayMath: [['$$','$$'],['\\\\[','\\\\]']],
    },
    options: { skipHtmlTags: ['script','noscript','style','textarea'] },
    startup: { typeset: true }
};
</script>
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
</head>
<body>
`;

    // Collect all question items with their data for answer key
    const allQuestions: { num: number; data: any }[] = [];
    const allItems: { type: string; data: any }[] = [];

    for (const section of sections) {
        allItems.push({ type: 'section-header', data: section });
        const renderedParagraphs = new Set<string>();

        for (const q of section.questions) {
            // Skip paragraph-type parent questions (they're rendered via paragraph_text on sub-questions)
            if (q.type === 'paragraph') continue;

            // If this question has paragraph_text (from JOIN with paragraphs table), render passage above it
            if (q.paragraph_text) {
                const paraKey = typeof q.paragraph_text === 'string' ? q.paragraph_text : (q.paragraph_text?.en || JSON.stringify(q.paragraph_text));
                if (!renderedParagraphs.has(paraKey)) {
                    renderedParagraphs.add(paraKey);
                    allItems.push({ type: 'passage', data: { paragraph_text: q.paragraph_text, text: q.paragraph_title || q.text } });
                }
            }

            allItems.push({ type: 'question', data: q });
        }
    }

    // ===== QUESTION PAGES =====
    if (isPreview) {
        htmlContent += `<div class="a4-page">`;
        htmlContent += buildHeader(exam, schoolName, finalExamName);
    } else {
        htmlContent += buildHeader(exam, schoolName, finalExamName);
    }

    let qCount = 1;
    for (const item of allItems) {
        htmlContent += renderItem(item, qCount, compactSpacing);
        if (item.type === 'question') {
            allQuestions.push({ num: qCount, data: item.data });
            qCount++;
        }
    }

    if (isPreview) {
        if (showPageNumbers || showDateTime) {
            htmlContent += buildFooter(showDateTime, showPageNumbers, '');
        }
        htmlContent += `</div>`; // close last a4-page
    }

    // ===== ANSWER KEY + EXPLANATIONS on last pages =====
    const hasAnswers = allQuestions.some(q => {
        const ca = q.data.correct_answer;
        return ca && (Array.isArray(ca) ? ca.length > 0 : true);
    });
    const hasExplanations = allQuestions.some(q => {
        const expl = q.data.explanation;
        return expl && (typeof expl === 'string' ? expl.trim() : (expl.en?.trim() || expl.pa?.trim()));
    });

    if (hasAnswers || hasExplanations) {
        if (isPreview) {
            htmlContent += `<div class="a4-page">`;
        } else {
            htmlContent += `<div class="page-break"></div>`;
        }

        htmlContent += `<div class="answer-key-section">`;
        htmlContent += `<div class="ak-title">Answer Key & Solutions</div>`;

        // Answer key - 4-column grid
        if (hasAnswers) {
            htmlContent += `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px 12px;margin-bottom:16px;">`;
            const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
            for (const q of allQuestions) {
                let answerText = '';
                const ca = q.data.correct_answer;
                const opts = typeof q.data.options === 'string' ? JSON.parse(q.data.options) : q.data.options;

                if (ca) {
                    const answers = Array.isArray(ca) ? ca : (typeof ca === 'string' ? JSON.parse(ca) : [ca]);
                    answerText = answers.map((a: string) => {
                        if (opts && Array.isArray(opts)) {
                            const idx = opts.findIndex((o: any) => o.id === a);
                            if (idx >= 0) return `(${labels[idx] || idx + 1})`;
                        }
                        return a;
                    }).join(', ');
                }
                htmlContent += `<div style="padding:3px 6px;border:1px solid #ddd;background:#fafafa;font-size:12px;"><strong>Q${q.num}.</strong> ${answerText}</div>`;
            }
            htmlContent += `</div>`;
        }

        // Explanations / Solutions
        if (hasExplanations) {
            htmlContent += `<div style="font-size:15px;font-weight:bold;margin:14px 0 8px;border-bottom:1px solid #000;padding-bottom:4px;">Solutions & Explanations</div>`;
            for (const q of allQuestions) {
                const expl = q.data.explanation;
                if (!expl) continue;
                const explText = extractTextHtml(expl);
                if (!explText.trim()) continue;

                htmlContent += `
                    <div class="explanation-block">
                        <div class="exp-q">Q${q.num}.</div>
                        <div class="exp-text">${explText}</div>
                    </div>
                `;
            }
        }

        htmlContent += `</div>`; // close answer-key-section

        if (isPreview) {
            if (showPageNumbers || showDateTime) {
                htmlContent += buildFooter(showDateTime, showPageNumbers, '');
            }
            htmlContent += `</div>`; // close a4-page
        }
    }

    htmlContent += `</body></html>`;
    return htmlContent;
}

function buildHeader(exam: any, schoolName: string, finalExamName: string): string {
    return `
        <div class="header">
            <div class="school-name">${schoolName}</div>
            <div class="exam-name">${finalExamName}</div>
            <div class="exam-meta">
                <span>Time: ${exam.duration} Mins</span>
                <span>Total Marks: ${exam.total_marks || 0}</span>
            </div>
        </div>
    `;
}

function buildFooter(showDateTime: boolean, showPageNumbers: boolean, extra: string): string {
    let html = `<div class="page-footer">`;
    html += showDateTime ? `<span>${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>` : `<span></span>`;
    html += showPageNumbers ? `<span>${extra}</span>` : ``;
    html += `</div>`;
    return html;
}

function renderItem(item: { type: string; data: any }, qCount: number, compactSpacing: boolean): string {
    if (item.type === 'section-header') {
        return `<div class="section-title">${extractText(item.data.name)}</div>`;
    }
    if (item.type === 'passage') {
        // Parse paragraph_text content - always show both languages for passages
        let paraContent = item.data.paragraph_text;
        if (!paraContent) paraContent = item.data.text; // fallback to question text

        let paraHtml = '';
        if (paraContent) {
            if (typeof paraContent === 'string') {
                try { paraContent = JSON.parse(paraContent); } catch { paraHtml = paraContent; }
            }
            if (typeof paraContent === 'object' && paraContent !== null) {
                if (paraContent.en) paraHtml += `<div>${paraContent.en}</div>`;
                if (paraContent.pa && paraContent.pa !== paraContent.en) paraHtml += `<div class="punjabi">${paraContent.pa}</div>`;
                if (!paraHtml) paraHtml = JSON.stringify(paraContent);
            }
        }

        // Title from question text field
        let titleText = item.data.text;
        let titleHtml = '';
        if (titleText) {
            if (typeof titleText === 'string') {
                try { titleText = JSON.parse(titleText); } catch { titleHtml = titleText; }
            }
            if (typeof titleText === 'object' && titleText !== null) {
                titleHtml = titleText.en || titleText.pa || '';
            }
        }

        return `
            <div class="passage-box">
                ${titleHtml ? `<div class="passage-title">${titleHtml}</div>` : ''}
                <div>${paraHtml}</div>
            </div>
        `;
    }
    if (item.type === 'question') {
        const q = item.data;
        const qText = extractText(q.text);
        const marks = q.sq_marks || q.marks || 0;

        // Q number and text on the SAME line
        let html = `
            <div class="q">
                <div class="q-head">
                    <span class="q-num">Q${qCount}.</span>
                    <span class="q-text">${qText}</span>
                    <span class="q-marks">[${marks}M]</span>
                </div>
        `;

        if (q.image_url) {
            html += `<div class="q-img"><img src="${q.image_url}" alt="" /></div>`;
        }

        const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
        if (options && Array.isArray(options) && options.length > 0) {
            const hasLongText = options.some((o: any) => {
                const t = o.text?.en || o.text || '';
                return (typeof t === 'string' ? t.length : 0) > 50;
            });
            const singleCol = hasLongText;

            html += `<div class="opts${singleCol ? ' single-col' : ''}">`;
            const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
            options.forEach((opt: any, idx: number) => {
                const optImg = opt.image_url || opt.imageUrl;
                html += `
                    <div class="opt">
                        <span class="opt-lbl">(${labels[idx] || idx + 1})</span>
                        <span>${extractText(opt.text)}${optImg ? `<br/><img src="${optImg}" class="opt-img" alt="" />` : ''}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    }
    return '';
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const url = new URL(request.url);
        const schoolName = url.searchParams.get('schoolName') || 'Merit Entrance Exam';
        const examNameOption = url.searchParams.get('examNameOption') || '';
        const showPageNumbers = url.searchParams.get('showPageNumbers') !== 'false';
        const showDateTime = url.searchParams.get('showDateTime') !== 'false';
        const compactSpacing = url.searchParams.get('compactSpacing') === 'true';
        const isPreview = url.searchParams.get('preview') === 'true';

        const examId = params.id;

        const exams = await sql`SELECT * FROM exams WHERE id = ${examId}`;
        if (exams.length === 0) {
            return new NextResponse('Exam not found', { status: 404 });
        }
        const exam = exams[0];

        const examTitleText = typeof exam.title === 'string' ? JSON.parse(exam.title)?.en || 'Exam' : (exam.title as any)?.en || 'Exam';
        const finalExamName = examNameOption || examTitleText;

        const sections = await sql`
            SELECT * FROM sections WHERE exam_id = ${examId} ORDER BY "order"
        `;

        for (const section of sections) {
            // Same query pattern as the working section questions API
            const questions = await sql`
                SELECT DISTINCT ON (q.id)
                    q.*,
                    p.content as paragraph_text,
                    p.text as paragraph_title,
                    sq.marks as sq_marks,
                    sq.negative_marks as sq_negative_marks,
                    sq."order" as sq_order
                FROM section_questions sq
                JOIN questions q ON sq.question_id = q.id
                LEFT JOIN paragraphs p ON q.paragraph_id = p.id
                WHERE sq.section_id = ${section.id}
                ORDER BY q.id, sq."order"
            `;
            section.questions = questions.sort((a: any, b: any) => (a.sq_order || 0) - (b.sq_order || 0));
        }

        const htmlContent = buildExamHtml(exam, sections, schoolName, finalExamName, compactSpacing, showPageNumbers, showDateTime, isPreview);

        if (isPreview) {
            return new NextResponse(htmlContent, {
                status: 200,
                headers: { 'Content-Type': 'text/html' }
            });
        }

        // Generate PDF using Puppeteer
        const puppeteer = (await import('puppeteer')).default;
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Wait for MathJax to finish rendering
        await page.evaluate(() => {
            return new Promise<void>((resolve) => {
                if ((window as any).MathJax && (window as any).MathJax.startup) {
                    (window as any).MathJax.startup.promise.then(() => resolve());
                } else {
                    // Wait up to 3s for MathJax
                    let waited = 0;
                    const interval = setInterval(() => {
                        waited += 200;
                        if ((window as any).MathJax && (window as any).MathJax.startup) {
                            (window as any).MathJax.startup.promise.then(() => {
                                clearInterval(interval);
                                resolve();
                            });
                        } else if (waited >= 3000) {
                            clearInterval(interval);
                            resolve();
                        }
                    }, 200);
                }
            });
        });

        let headerTemplate = "<span></span>";
        let footerTemplate = "<span></span>";

        if (showPageNumbers || showDateTime) {
            let leftFooter = showDateTime ? `<span class="date"></span>` : "";
            let rightFooter = showPageNumbers ? `Page <span class="pageNumber"></span> of <span class="totalPages"></span>` : "";

            footerTemplate = `
                <div style="font-size: 9px; font-family: Arial, sans-serif; width: 100%; display: flex; justify-content: space-between; padding: 0 12mm;">
                    <span style="color: #777;">${leftFooter}</span>
                    <span style="color: #777;">${rightFooter}</span>
                </div>
            `;
        }

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '10mm',
                bottom: (showPageNumbers || showDateTime) ? '16mm' : '10mm',
                left: '12mm',
                right: '12mm'
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
