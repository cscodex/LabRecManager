# Lab Record Manager - Render + Neon Deployment Guide

## Overview

This guide shows how to deploy the Lab Record Manager on:
- **Render** - Free hosting for Node.js apps
- **Neon** - Free serverless PostgreSQL database

---

## Step 1: Set Up Neon Database

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project (e.g., "lab-record-manager")
3. Copy your connection string (looks like):
   ```
   postgresql://username:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
psql 'postgresql://neondb_owner:npg_AqdEieg3QG0C@ep-icy-glade-ahfbz57u-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
4. Open **Neon SQL Editor** and run these SQL files in order:

### Run Schema (Copy-paste from `database/schema.sql`)
This creates all 25+ tables with proper relationships.

### Run Seed Data (Copy-paste from `database/seed.sql`)  
This creates sample school, users, assignments for testing.

> ⚠️ **Important:** The seed data uses placeholder password hashes. You'll need to regenerate proper bcrypt hashes for production.

---

## Step 2: Deploy Backend to Render

1. Go to [render.com](https://render.com) and connect your GitHub repo

2. Create a **New Web Service**:
   - **Name**: `lab-record-manager-api`
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npx prisma generate`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

3. Add Environment Variables:
   | Variable | Value |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Your Neon connection string |
   | `JWT_SECRET` | (Generate a random 64-char string) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `JWT_REFRESH_EXPIRES_IN` | `30d` |
   | `CLIENT_URL` | `https://your-frontend.onrender.com` |

4. Deploy!

---

## Step 3: Deploy Frontend to Render

1. Create another **New Web Service**:
   - **Name**: `lab-record-manager-client`
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

2. Add Environment Variables:
   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://lab-record-manager-api.onrender.com` |

3. Deploy!

---

## Step 4: Update Frontend API Configuration

Update `client/next.config.js` to point to your Render backend:

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: process.env.NEXT_PUBLIC_API_URL 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`
        : 'http://localhost:5000/api/:path*',
    },
  ];
}
```

---

## Login Credentials (After Seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@dps.edu | admin123 |
| Principal | principal@dps.edu | principal123 |
| Instructor | instructor@dps.edu | instructor123 |
| Lab Assistant | labassist@dps.edu | labassist123 |
| Students | student1@dps.edu - student5@dps.edu | student123 |

---

## Pending Features & How They Fit

| Feature | Status | Implementation Notes |
|---------|--------|---------------------|
| **WebRTC Viva** | Backend Ready | Add `/client/src/app/viva/room/[id]/page.jsx` with WebRTC peer connection using Socket.io signals |
| **Assignment Pages** | API Ready | Add `/client/src/app/assignments/page.jsx` and `[id]/page.jsx` using existing `assignmentsAPI` |
| **Submission UI** | API Ready | Add submission form with code editor and file upload |
| **Grading UI** | API Ready | Add instructor grading panel with mark breakdown |
| **More Languages** | Schema Ready | Add translation JSON files in `/client/public/locales/{lang}/` |
| **PDF Reports** | Backend TODO | Add Puppeteer/jsPDF for generating lab records |

All pending features use **existing backend APIs** - only frontend UI components need to be added.

---

## Troubleshooting

**"relation does not exist" error:**  
→ Run `schema.sql` in Neon SQL Editor first

**"invalid password" on login:**  
→ The seed data password hashes need to match. Generate fresh hashes with:
```javascript
const bcrypt = require('bcryptjs');
bcrypt.hash('admin123', 10).then(console.log);
```

**CORS errors:**  
→ Add your frontend URL to `CLIENT_URL` env var on backend

**Free tier cold starts:**  
→ Render free tier sleeps after 15 min of inactivity. First request may take 30s.
