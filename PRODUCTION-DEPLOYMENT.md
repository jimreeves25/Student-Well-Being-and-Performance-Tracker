# Production Deployment Guide

## Overview
This guide covers deploying the Student Well-Being & Performance Tracker as a production-ready system with proper data isolation, security, and scalability.

---

## PART 1: LOCAL DEVELOPMENT SETUP

### Prerequisites
- Node.js 16+
- npm 8+
- Git

### Steps

1. **Clone and setup repository**
```bash
git clone <your-repo-url>
cd "Student Well Being And Performance Tracker"
```

2. **Backend Setup**
```bash
cd backend
cp .env.example .env
# Edit .env and update:
# JWT_SECRET=your_long_random_secret_here
# CORS_ORIGINS=http://localhost:3000
npm install
npm run dev
```

Backend will be available at: `http://localhost:3001`

3. **Frontend Setup**
```bash
cd ../frontend-student
cp .env.example .env
# Edit .env:
# REACT_APP_API_URL=http://localhost:3001/api
npm install
npm start
```

Frontend will be available at: `http://localhost:3000`

---

## PART 2: USER DATA SEPARATION (Multi-Tenant)

### Architecture
Each user has isolated data:
- Every API request includes JWT token with `userId`
- Backend middleware extracts `userId` from token
- All database queries filter by `userId`
- No user can access another user's data

### Database Schema
All user-specific tables have `userId` column:
```javascript
// DailyLog example
{
  id: 1,
  userId: 42,           // ← User-specific
  studyHours: 4,
  sleepHours: 7,
  moodRating: 8,
  createdAt: "2024-04-12T10:00:00Z"
}
```

### API Authentication
All protected endpoints require Bearer token:
```javascript
// Frontend
const headers = {
  "Authorization": `Bearer ${localStorage.getItem("token")}`
};

// Backend (authMiddleware)
const decoded = jwt.verify(token, JWT_SECRET);
const userId = decoded.userId;
```

### Verified Endpoints with userId Filtering
✅ GET /api/dashboard/summary → filters by req.userId
✅ GET /api/dashboard/logs → filters by req.userId  
✅ POST /api/dashboard/log → attaches userId to created record
✅ POST /api/dashboard/study-session → filters by req.userId
✅ GET /api/dashboard/study-sessions → filters by req.userId

---

## PART 3: DEPLOYMENT PLATFORMS

### Option A: Railway.app (Recommended - 1-Click Deploy)

#### Steps:
1. **Push to GitHub**
```bash
git push origin main
```

2. **Create Railway Account**
   - Sign up at https://railway.app
   - Connect GitHub account

3. **Deploy Backend**
   - In Railway dashboard: New Project
   - Select GitHub repo → choose `backend` directory
   - Add environment variables:
     ```
     PORT=3001
     NODE_ENV=production
     JWT_SECRET=your_long_random_secret_here
     CORS_ORIGINS=https://your-frontend-domain.vercel.app
     OPENROUTER_API_KEY=your_api_key
     ```
   - Railway generates: `https://your-app.railway.app`

4. **Deploy Frontend (Vercel)**
   - Sign up at https://vercel.com
   - Import GitHub repo
   - Set root directory: `frontend-student`
   - Add environment variable:
     ```
     REACT_APP_API_URL=https://your-app.railway.app/api
     ```
   - Deploy generates: `https://your-app.vercel.app`

---

### Option B: Render.com

#### Backend Deployment:
1. Sign up at https://render.com
2. New Web Service → Connect GitHub
3. Select repository & `backend` directory
4. Configuration:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment Variables (same as above)
5. Deploy → Generates: `https://your-app.onrender.com`

#### Frontend Deployment:
1. New Static Site → Connect GitHub
2. Select repository → set root: `frontend-student/build`
3. Build Command: `npm run build`
4. Add env var: `REACT_APP_API_URL=https://your-app.onrender.com/api`
5. Deploy

---

### Option C: Traditional VPS (AWS EC2, DigitalOcean, Linode)

#### Backend:
```bash
# SSH into server
ssh user@your-server.com

# Install dependencies
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs npm

# Clone repo
git clone <your-repo-url>
cd backend

# Create .env
cp .env.example .env
nano .env  # Edit variables

# Install & Run with PM2
npm install -g pm2
npm install
pm2 start server.js --name "wellness-backend"
pm2 save
```

#### Frontend:
```bash
cd ../frontend-student

# Build production
npm install
npm run build

# Serve with nginx
sudo apt-get install nginx
sudo cp -r build /var/www/html/wellness-app/

# Update nginx config to proxy to backend
sudo systemctl restart nginx
```

---

## PART 4: DATABASE OPTIONS

### Option A: SQLite (Current - Demo/Small Scale)
```javascript
// Current setup in backend/sequelize.js
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DATABASE_PATH || './database.sqlite'
});
```
✅ Works for < 1000 concurrent users
❌ Not suitable for production scale

### Option B: PostgreSQL (Recommended - Production)

1. **Local PostgreSQL Setup**
```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database
sudo -u postgres psql
CREATE DATABASE wellness_db;
CREATE USER wellness_user WITH PASSWORD 'your_password';
ALTER ROLE wellness_user SET client_encoding TO 'utf8';
ALTER ROLE wellness_user SET default_transaction_isolation TO 'read committed';
GRANT ALL PRIVILEGES ON DATABASE wellness_db TO wellness_user;
\q
```

2. **Update Backend .env**
```
DATABASE_URL=postgresql://wellness_user:your_password@localhost:5432/wellness_db
```

3. **Update Sequelize Config** (backend/sequelize.js)
```javascript
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  pool: { max: 5, min: 0 }
});
```

4. **Deploy with Cloud PostgreSQL**
   - Railway: Automatically provisions PostgreSQL
   - Heroku: Heroku Postgres
   - AWS: RDS PostgreSQL
   - Google Cloud: Cloud SQL

---

## PART 5: REAL-TIME SYNC & AUTO-REFETCH

### Auto-Refetch Implementation
The frontend now includes automatic cache invalidation:

```javascript
// In Dashboard component
import { useDataSync, useDataMutation, invalidateCache } from "../hooks/useDataSync";

// Auto-fetch every 30 seconds
const { data: summary, refetch } = useDataSync(
  () => getDashboardSummary(),
  { autoRefetchInterval: 30000 }
);

// Save & auto-refetch related data
const { mutate: saveDailyLog } = useDataMutation(
  (logData) => saveDailyLog(logData),
  () => refetch()  // Auto-refetch after save
);
```

### Events Fired on Data Changes
After any POST/PUT/DELETE:
1. Backend processes request
2. Frontend receives response
3. useDataMutation triggers refetch()
4. All listening components update

---

## PART 6: SECURITY CHECKLIST

Before deploying to production:

- [ ] JWT_SECRET changed to random 32+ character string
- [ ] CORS_ORIGINS set to your actual domain only
- [ ] OPENROUTER_API_KEY never committed to git
- [ ] HTTPS enforced (Railway/Vercel do this by default)
- [ ] SQL injection mitigation (Sequelize ORM prevents this)
- [ ] Password hashing with bcrypt (backend/routes/auth.js)
- [ ] Middleware validates all user input
- [ ] Database backups configured
- [ ] Rate limiting enabled
- [ ] Logging configured for monitoring

---

## PART 7: MONITORING & MAINTENANCE

### View Logs
```bash
# Railway
railway logs

# Render  
View in dashboard

# PM2 (VPS)
pm2 logs wellness-backend
```

### Database Backups
```bash
# PostgreSQL dump
pg_dump wellness_db > backup_$(date +%Y%m%d).sql

# Restore
psql wellness_db < backup_20240412.sql
```

### Performance Monitoring
- Track API response times
- Monitor database query performance
- Watch error rates
- Set up alerts for uptime

---

## PART 8: ENVIRONMENT VARIABLES REFERENCE

| Variable | Purpose | Example |
|----------|---------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `production` |
| `JWT_SECRET` | Token signing key | `a1b2c3d4e5f6...` |
| `CORS_ORIGINS` | Allowed frontends | `https://app.example.com` |
| `DATABASE_PATH` (SQLite) | Database file path | `./database.sqlite` |
| `DATABASE_URL` (PostgreSQL) | Connection string | `postgresql://user:pass@host/db` |
| `OPENROUTER_API_KEY` | AI API key | `sk-or-...` |
| `REACT_APP_API_URL` | Backend URL for frontend | `https://api.example.com/api` |
| `REACT_APP_AUTO_REFETCH_INTERVAL` | Cache refetch interval (ms) | `30000` |

---

## PART 9: TROUBLESHOOTING

### Issue: "Invalid token" error
**Solution:** Check JWT_SECRET matches between backend and login token

### Issue: CORS errors in browser console  
**Solution:** Update CORS_ORIGINS to match your frontend domain

### Issue: Slow queries / high database CPU
**Solution:** 
- Add indexes to frequently queried columns
- Migrate from SQLite to PostgreSQL
- Increase database pool size

### Issue: Users seeing other users' data
**Solution:** Verify authMiddleware is attached to ALL protected routes

### Issue: Frontend can't reach backend
**Solution:** Check REACT_APP_API_URL matches deployed backend URL

---

## PART 10: SUPPORT & NEXT STEPS

### Completed in This Upgrade:
✅ User data isolation with JWT + userId filtering
✅ Auto-refetch hooks for real-time sync
✅ Environment variable templates
✅ Deployment guides for Railway/Render/VPS
✅ Database options (SQLite → PostgreSQL migration)
✅ Security checklist

### Future Enhancements:
- [ ] Add API rate limiting
- [ ] Implement caching layer (Redis)
- [ ] Add comprehensive logging
- [ ] Set up automated testing/CI-CD
- [ ] Add dark mode toggle
- [ ] Implement real-time WebSocket updates
- [ ] Add file upload functionality
- [ ] Analytics dashboard

---

**Ready to deploy! Start with Option A (Railway) for fastest setup.**
