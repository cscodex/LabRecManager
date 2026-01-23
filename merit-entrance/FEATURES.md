# Merit Entrance - Feature Checklist

## Overview
Merit Entrance is a bilingual (English/Punjabi) online examination platform for SOE entrance exams with JEE-style interface.

---

## 🔐 Authentication & Security

### Implemented ✅
- [x] Admin login with email/password
- [x] Student login with roll number/password
- [x] Google OAuth sign-in for students
- [x] Auto-create student account on first Google sign-in
- [x] Session management with JWT
- [x] Role-based access control (admin, superadmin, student)
- [x] Fullscreen mode during exam
- [x] Tab-switch detection with 10-second warning
- [x] Auto-submit on repeated tab violations

### To Be Implemented 🔲
- [ ] Password reset functionality
- [ ] Email verification for new accounts
- [ ] Two-factor authentication for admins
- [ ] Login attempt limiting
- [ ] Session timeout warnings
- [ ] Device fingerprinting

---

## 👨‍💼 Admin Features

### Dashboard
- [x] Total exams count
- [x] Total students count
- [x] Active exams display
- [x] Quick stats overview
- [ ] Analytics graphs/charts
- [ ] Recent activity feed

### Exam Management
- [x] Create new exam
- [x] Edit exam details (title, duration, marks)
- [x] Bilingual exam titles and descriptions
- [x] Rich text instructions editor (English & Punjabi)
- [x] Delete exam
- [x] Exam status (draft, published, archived)
- [x] Shuffle questions option
- [x] Negative marking configuration
- [x] Exam preview (student view simulation)
- [x] Read-only exam view page
- [ ] Duplicate exam
- [ ] Exam templates
- [ ] Bulk exam operations

### Section Management
- [x] Add sections to exam
- [x] Edit section name (bilingual)
- [x] Section duration (per-section timing)
- [x] Reorder sections (up/down)
- [x] Delete sections
- [ ] Section-wise marking scheme
- [ ] Mandatory sections

### Question Management
- [x] Add individual questions
- [x] Multiple Choice - Single answer (MCQ)
- [x] Multiple Choice - Multiple answers
- [x] Fill in the blank
- [x] Bilingual question text (English & Punjabi)
- [x] Bilingual options
- [x] Image upload for questions
- [x] Image upload for options
- [x] Correct answer selection
- [x] Marks and negative marks per question
- [x] Question explanation (bilingual)
- [x] Reorder questions
- [x] Edit questions
- [x] Delete questions
- [x] **Bulk import from CSV template**
- [x] Language selection for import
- [x] **Math superscript conversion** (a^2 → a<sup>2</sup>)
- [x] **Bulk delete questions with select all**
- [ ] Question bank / repository
- [ ] Import from Word/PDF
- [ ] Question categories/tags

### Student Management
- [x] View all students
- [x] Add individual student
- [x] Edit student details
- [x] Toggle student active/inactive status
- [x] Student search and filter
- [ ] Bulk import students from CSV
- [ ] Student groups/batches
- [ ] Student performance analytics

### Exam Assignment & Scheduling
- [x] Assign exam to students
- [x] Unassign students from exam
- [x] Bulk select/deselect students
- [x] Schedule exams (start/end time)
- [x] View scheduled exams
- [ ] Recurring exam schedules
- [ ] Automatic assignment by groups

### Results & Analytics
- [x] View exam results page
- [x] Exam-wise performance statistics
- [x] Pass/fail counts and rates
- [x] Recent student attempts list
- [x] Search by student name
- [x] Filter by exam
- [x] Sort by date/score/name
- [ ] Export results to CSV/PDF
- [ ] Detailed question-wise analytics
- [ ] Comparative performance charts

### Settings
- [x] General settings (site name, default language)
- [x] Exam settings (warning time, auto-submit options)
- [x] Security settings (registration, login attempts)
- [x] System maintenance options
- [x] Danger zone (reset data - superadmin only)
- [ ] Email notification settings
- [ ] Backup and restore

---

## 👨‍🎓 Student Features

### Dashboard
- [x] View assigned exams
- [x] Exam status indicators (scheduled, available, completed)
- [x] Start exam button
- [x] View results link for completed exams
- [ ] Upcoming exams calendar
- [ ] Performance summary
- [ ] Practice mode

### Exam Taking
- [x] JEE-style exam interface
- [x] Question palette with status colors
- [x] Section tabs navigation
- [x] Timer display
- [x] Language toggle (English/Punjabi)
- [x] Answer selection for MCQ
- [x] Clear response option
- [x] Mark for review feature
- [x] Save & Next / Previous navigation
- [x] Question status tracking (Answered, Not Answered, Marked, Not Visited)
- [x] Auto-save answers periodically
- [x] Submit confirmation dialog
- [x] Fullscreen enforcement
- [x] Tab-switch warning modal
- [x] Auto-submit on violations
- [x] Empty section handling with navigation
- [x] **Mobile responsive layout**
- [x] **Mobile floating bottom bar**
- [x] **Mobile question navigation drawer**
- [ ] Calculator integration
- [ ] Scratch pad / notes

### Results
- [x] View exam results
- [x] Score display
- [x] Pass/Fail status
- [x] Correct/Incorrect/Unattempted counts
- [x] Time taken
- [ ] Detailed answer review
- [ ] Download result certificate
- [ ] Performance comparison

---

## 🌐 General Site Features

### Internationalization (i18n)
- [x] English language support
- [x] Punjabi (ਪੰਜਾਬੀ) language support
- [x] Language toggle in UI
- [x] Bilingual content storage in database
- [x] Translation files for UI strings
- [ ] Additional language support
- [ ] RTL layout support

### UI/UX
- [x] Responsive design
- [x] Mobile-friendly student exam view
- [x] Toast notifications
- [x] Loading states
- [x] Confirmation dialogs
- [x] Clean, modern design
- [ ] Dark mode
- [ ] Accessibility improvements (ARIA)
- [ ] Keyboard navigation

### Media & Uploads
- [x] Image upload to Cloudinary
- [x] Question images
- [x] Option images
- [ ] Student profile photos
- [ ] Bulk image upload
- [ ] Media library

### Technical
- [x] Next.js 14 App Router
- [x] TypeScript
- [x] Tailwind CSS
- [x] Neon PostgreSQL database
- [x] Prisma ORM (schema)
- [x] Raw SQL queries (neon serverless)
- [x] NextAuth.js for Google OAuth
- [x] Cloudinary for image storage
- [x] Deploy ready for Render
- [ ] API rate limiting
- [ ] Database connection pooling
- [ ] Caching layer (Redis)
- [ ] CDN for static assets

---

## 📱 Mobile Responsiveness

### Implemented ✅
- [x] Login page responsive
- [x] Student dashboard responsive
- [x] Exam interface mobile layout
- [x] Floating bottom bar (timer, stats, submit)
- [x] Slide-up question navigation drawer
- [x] Touch-friendly buttons

### To Be Implemented 🔲
- [ ] Admin dashboard mobile optimization
- [ ] Admin exam editor mobile view
- [ ] PWA (Progressive Web App)
- [ ] Offline support

---

## 🔧 API Endpoints

### Authentication
- [x] `POST /api/auth/login`
- [x] `POST /api/auth/logout`
- [x] `GET/POST /api/auth/[...nextauth]` (Google OAuth)

### Admin APIs
- [x] `GET/POST /api/admin/exams`
- [x] `GET/PUT/DELETE /api/admin/exams/[id]`
- [x] `GET/POST /api/admin/exams/[id]/sections`
- [x] `PUT/DELETE /api/admin/exams/[id]/sections/[sectionId]`
- [x] `GET/POST /api/admin/exams/[id]/sections/[sectionId]/questions`
- [x] `PUT/DELETE /api/admin/exams/[id]/sections/[sectionId]/questions/[questionId]`
- [x] `POST /api/admin/exams/[id]/sections/[sectionId]/questions/import`
- [x] `GET/POST /api/admin/exams/[id]/assign`
- [x] `GET/POST /api/admin/exams/[id]/schedule`
- [x] `GET/POST /api/admin/students`
- [x] `PUT /api/admin/students/[id]`
- [x] `GET /api/admin/stats`
- [x] `GET /api/admin/results`
- [x] `POST /api/upload`

### Student APIs
- [x] `GET /api/student/exams`
- [x] `GET /api/student/exam/[examId]`
- [x] `POST /api/student/exam/[examId]/save`
- [x] `POST /api/student/exam/[examId]/submit`
- [x] `GET /api/student/results/[examId]`

---

## 🚀 Deployment

### Current
- [x] Render.com deployment
- [x] Neon PostgreSQL (serverless)
- [x] Cloudinary for images
- [x] Environment variables configured

### Future
- [ ] CI/CD pipeline
- [ ] Staging environment
- [ ] Database migrations automation
- [ ] Monitoring and alerting
- [ ] Error tracking (Sentry)

---

## 📊 Summary

| Category | Implemented | To Do |
|----------|-------------|-------|
| Authentication | 10 | 6 |
| Admin Features | 45+ | 15+ |
| Student Features | 25+ | 8 |
| General Site | 20+ | 10 |
| Mobile | 6 | 4 |
| APIs | 20+ | - |

---

*Last Updated: January 23, 2026*
