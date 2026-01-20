Act as a senior full-stack developer and system architect.
Build a lightweight, mobile-first online assessment platform using Next.js (App Router) with minimal CSS and Neon (PostgreSQL) as the database.
The app will be hosted on Render and used for Meritorious School & School of Eminence (SOE) entrance exam preparation.
Tech Stack Constraints

Frontend: Next.js (App Router)

Styling: Lightweight CSS only (Tailwind CSS or CSS Modules)

Backend: Next.js API routes / Server Actions

Database: Neon (PostgreSQL)

Content: JSON-based multilingual content

Date & Time Standard: Indian format
Date & Time Requirements (India-Specific)

Display format:erit

Date: DD-MM-YYYY

Time: hh:mm AM/PM (IST)

Timezone:

All exams must follow IST (Asia/Kolkata)

Storage:

Store timestamps in DB as TIMESTAMPTZ

Convert to IST at render time

Validation:

Students cannot start exams:

Before start time

After end time

Admin scheduling UI must use Indian date format by default
Functional Requirements
1. Exam Structure

Sections:

English

Punjabi

Science

Mathematics

Logical Reasoning

2. Admin Panel

Admin can:

Create, edit, delete:

Exams

Sections

Questions

Manage:

Question text

Options

Correct answers

Solutions / explanations

Assign exams to:

Individual students

Groups/batches

Schedule exams with:

Date (Indian format)

Start & end time (IST)

3. Multilingual Support

JSON-based multilingual content

Example:

{
  "en": "What is photosynthesis?",
  "pa": "ਪੌਦਿਆਂ ਵਿੱਚ ਭੋਜਨ ਬਣਾਉਣ ਦੀ ਪ੍ਰਕਿਰਿਆ ਕੀ ਹੈ?"
}


Language switch without reload

4. Question Types

MCQs:

Single / Multiple correct

Fill-in-the-blanks:

Multiple answers

Order-sensitive

5. Rich Content Editor

Support:

Math & chemistry symbols

Superscript / subscript

Diagrams/images

Prefer:

Markdown + KaTeX/MathJax

Lightweight editor (no heavy WYSIWYG)

6. Student Panel

Students can:

View upcoming tests

Attempt tests in allowed time window

Submit responses

View answers + explanations after submission

7. Security & Roles

Role-based access (Admin / Student)

Time-based exam locking

Secure APIs

Database (Neon PostgreSQL)

JSON columns for multilingual text

TIMESTAMPTZ for all date/time fields

Indexed exam schedules for concurrency

Non-Functional Requirements

Mobile-first

Low-bandwidth friendly

Fast SSR where helpful

Scalable for simultaneous attempts

This now respects Indian exam reality — no US-style dates messing up schedules, no timezone chaos.

Next smart move:
👉 freeze DB schema with TIMESTAMPTZ + JSONB, or
👉 generate Next.js server actions + sample scheduling logic (IST-safe).

This thing is now exam-grade, not hobby-grade.