# 🚀 Deploying Lab Record Manager to Render

This guide will help you deploy both the **backend API** and **frontend client** to Render with free HTTPS.

## Prerequisites

1. A [Render](https://render.com/) account (free tier available)
2. Your code pushed to a GitHub repository
3. A [Neon](https://neon.tech/) PostgreSQL database (you already have this!)

---

## Step 1: Push Your Code to GitHub

If you haven't already, push your code to a GitHub repository:

```bash
cd /Users/charanpreetsingh/LabRecManagemer
git init
git add .
git commit -m "Initial commit for deployment"
git remote add origin https://github.com/YOUR_USERNAME/lab-record-manager.git
git push -u origin main
```

---

## Step 2: Deploy the Backend API

### 2.1 Create a New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select your repository
4. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `lab-record-api` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | Node |
| **Build Command** | `npm install && npx prisma generate` |
| **Start Command** | `npm start` |
| **Plan** | Free |

### 2.2 Set Environment Variables

In the **Environment** section, add these variables:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://neondb_owner:npg_AqdEieg3QG0C@ep-icy-glade-ahfbz57u-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `DIRECT_URL` | `postgresql://neondb_owner:npg_AqdEieg3QG0C@ep-icy-glade-ahfbz57u.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | Click "Generate" to create a secure random secret |
| `JWT_EXPIRES_IN` | `7d` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` |
| `CLIENT_URL` | (Leave empty for now, add frontend URL after deploying frontend) |
| `PORT` | `5001` |

### 2.3 Deploy

Click **"Create Web Service"**. Render will build and deploy your backend.

Once deployed, you'll get a URL like: `https://lab-record-api.onrender.com`

**Save this URL**, you'll need it for the frontend!

---

## Step 3: Deploy the Frontend Client

### 3.1 Create Another Web Service

1. Click **"New +"** → **"Web Service"**
2. Select the same repository
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `lab-record-client` |
| **Region** | Oregon (US West) |
| **Branch** | `main` |
| **Root Directory** | `client` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Plan** | Free |

### 3.2 Set Environment Variables

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_API_URL` | `https://lab-record-api.onrender.com` (your backend URL from Step 2) |

### 3.3 Deploy

Click **"Create Web Service"**. Your frontend will build and deploy.

Once deployed, you'll get a URL like: `https://lab-record-client.onrender.com`

---

## Step 4: Update Backend CORS

Go back to your **backend service** environment variables and update:

| Key | Value |
|-----|-------|
| `CLIENT_URL` | `https://lab-record-client.onrender.com` (your frontend URL) |

This allows the frontend to make API requests to the backend.

---

## Step 5: Run Database Migrations

### Option A: Using Render Shell

1. Go to your **backend service** on Render
2. Click **"Shell"** tab
3. Run: `npx prisma migrate deploy`

### Option B: From Your Local Machine

```bash
cd server
export DATABASE_URL="your-neon-connection-string"
npx prisma migrate deploy
```

---

## Step 6: Seed Initial Data (Optional)

If you want to seed test data:

```bash
# In Render Shell or locally with DATABASE_URL set
npm run seed
```

---

## 🎉 You're Done!

Your app is now live at:
- **Frontend**: `https://lab-record-client.onrender.com`
- **Backend API**: `https://lab-record-api.onrender.com/api`

### Benefits:
- ✅ **Free HTTPS** - Camera/microphone work on mobile!
- ✅ **Auto-deploy** - Push to GitHub = automatic deployment
- ✅ **Free tier** - No credit card required

---

## Troubleshooting

### Build Fails

1. Check build logs in Render dashboard
2. Ensure all dependencies are in `package.json`
3. Verify the `rootDir` is set correctly (`server` or `client`)

### API Connection Issues

1. Verify `NEXT_PUBLIC_API_URL` points to your backend (with `https://`)
2. Check `CLIENT_URL` in backend matches your frontend URL
3. Look at browser console for CORS errors

### Camera/Mic Still Blocked

After deploying with HTTPS, you should have no issues. If problems persist:
1. Clear browser cache
2. Revoke camera permissions and re-grant them
3. Make sure you're accessing via `https://` URL

### Slow Cold Starts

Free tier services "spin down" after 15 minutes of inactivity. First request may take 30-60 seconds. To keep it warm:
- Use a service like [UptimeRobot](https://uptimerobot.com/) to ping your services every 5 minutes

---

## Quick Deploy with render.yaml

Alternatively, you can deploy both services at once:

1. Push your code with the `render.yaml` file to GitHub
2. Go to Render Dashboard → **Blueprints**
3. Click **"New Blueprint Instance"**
4. Select your repository
5. Render will automatically create both services
6. Fill in the environment variables when prompted

---

## Updating Your Deployment

Simply push changes to your GitHub repository:

```bash
git add .
git commit -m "Your changes"
git push
```

Render will automatically rebuild and redeploy!
