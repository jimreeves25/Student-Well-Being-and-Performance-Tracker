# Deployment Guide (Frontend + Backend)

This repo is set up for:
- Frontend: Vercel (React app in `frontend-student/`)
- Backend: Render (Node API in `backend/`)

## 1. Deploy Backend on Render

1. Open Render dashboard and create a new `Web Service` from this GitHub repo.
2. Use these settings:
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Auto-Deploy: enabled

3. Add environment variables in Render:
- `JWT_SECRET`: a long random secret
- `CORS_ORIGINS`: your frontend URL (for example `https://your-app.vercel.app`)
- `PORT`: leave blank (Render provides port automatically) or set `3001`

4. Deploy and copy your backend URL:
- Example: `https://your-backend.onrender.com`
- API base becomes: `https://your-backend.onrender.com/api`

## 2. Deploy Frontend on Vercel

1. Open Vercel dashboard and import this GitHub repo.
2. Configure project:
- Framework preset: Create React App
- Root Directory: `frontend-student`
- Build Command: `npm run build`
- Output Directory: `build`

3. Add environment variable in Vercel:
- `REACT_APP_API_URL` = `https://your-backend.onrender.com/api`

4. Deploy.

## 3. Update Backend CORS

After frontend deploy, copy your Vercel domain and update backend `CORS_ORIGINS` on Render.

Example:
`CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000`

Then redeploy backend.

## Notes

- Backend currently uses SQLite (`backend/database.sqlite`).
- On cloud hosts with ephemeral filesystem, SQLite data may reset on redeploy/restart.
- For durable production data, migrate to a managed database.
