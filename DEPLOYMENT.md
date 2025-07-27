# Vercel Deployment Guide

## Prerequisites
1. Install Vercel CLI: `npm i -g vercel`
2. Have a Vercel account (sign up at vercel.com)
3. MongoDB Atlas cluster configured

## Deployment Steps

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Deploy to Vercel
```bash
vercel
```

### 4. Follow the prompts:
- Set up and deploy: `Y`
- Which scope: Select your account
- Link to existing project: `N`
- Project name: `bill-generator` (or your preferred name)
- Directory: `./` (current directory)
- Override settings: `N`

### 5. Set Environment Variables
After deployment, go to your Vercel dashboard and set these environment variables:

**Production Environment:**
- `MONGODB_URI`: `mongodb+srv://aditkatiyar101:katiyar1972@cluster0.bhjbsnd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
- `REACT_APP_API_URL`: `/api`

### 6. Redeploy
```bash
vercel --prod
```

## Project Structure for Vercel
- `vercel.json`: Configuration file for routing and builds
- `server/index.js`: Backend API server
- `src/`: React frontend
- `package.json`: Build scripts

## API Endpoints
After deployment, your API will be available at:
- `https://your-domain.vercel.app/api/bills`
- `https://your-domain.vercel.app/api/health`

## Troubleshooting
1. If API calls fail, check that `REACT_APP_API_URL` is set to `/api`
2. If MongoDB connection fails, verify the connection string
3. Check Vercel function logs for any errors

## Local Development
For local development, the app will use:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000/api` 