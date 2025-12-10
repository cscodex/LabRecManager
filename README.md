# Lab Record Manager

A comprehensive lab management system for Indian schools with multi-language support, online viva, grading, and reporting.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+

### 1. Setup Backend

```bash
cd server

# Copy environment file
cp .env.example .env

# Edit .env with your database URL
# DATABASE_URL="postgresql://user:password@localhost:5432/lab_record_manager"

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed sample data
npm run seed

# Start server
npm run dev
```

### 2. Setup Frontend

```bash
cd client

# Install dependencies
npm install

# Start development server
npm run dev
```

### 3. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **API Health**: http://localhost:5000/api/health

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@dps.edu | admin123 |
| Instructor | instructor@dps.edu | instructor123 |
| Student | student1@dps.edu | student123 |

## Features

- ✅ Multi-role authentication (Admin, Instructor, Student)
- ✅ Assignment creation & management
- ✅ Student submissions with file upload
- ✅ Online viva voice system (WebRTC)
- ✅ Comprehensive grading with breakdown
- ✅ Multi-language support (Hindi, English)
- ✅ Fee tracking & accounting
- ✅ Reports & analytics  
- ✅ Real-time notifications

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Node.js, Express.js, Prisma ORM
- **Database**: PostgreSQL
- **Real-time**: Socket.io, WebRTC
