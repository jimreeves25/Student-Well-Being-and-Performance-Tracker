# PRODUCTION-READY QUICK START GUIDE

## What's Been Upgraded? 🚀

Your Student Well-Being & Performance Tracker has been transformed from a local demo into a scalable, production-ready system.

### Key Improvements:

**Part 1: User Data Separation ✅**
- Each user has isolated data (userId-based filtering)
- No user can see another user's logs/sessions
- Backend middleware validates all requests
- [See API-ENDPOINTS.md for full API docs]

**Part 2: Deployment Ready ✅**
- Environment configuration templates (.env.example)
- Deployment guides for Railway/Render/VPS
- Database migration path (SQLite → PostgreSQL)
- [See PRODUCTION-DEPLOYMENT.md for setup instructions]

**Part 3: Real-Time Sync ✅**
- Auto-refetch data after saves (no manual refresh)
- Cache invalidation event system
- Polling-based updates (configurable interval)
- [See REAL-TIME-SYNC-EXAMPLES.md for usage patterns]

---

## Quick Start: Development Setup (5 minutes)

### 1. Clone & Setup
```bash
git clone <your-repo>
cd "Student Well Being And Performance Tracker"
```

### 2. Backend
```bash
cd backend
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
npm install
npm run dev
```
✅ Backend runs on http://localhost:3001

### 3. Frontend
```bash
cd ../frontend-student
cp .env.example .env
# REACT_APP_API_URL=http://localhost:3001/api (already set)
npm install
npm start
```
✅ Frontend runs on http://localhost:3000

### 4. Test the System
1. Go to http://localhost:3000
2. Sign up / Login
3. Save a daily log
4. Watch automatic refetch happen (no page reload needed!)
5. Open new browser tab with same user → data syncs instantly

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                      │
├─────────────────────────────────────────────────────────┤
│  • AIChatbot (visible only to authenticated users)      │
│  • Dashboard (overview, logs, sessions)                 │
│  • useDataSync hook (auto-refetch every 30s)            │
│  • useDataMutation hook (save & auto-refetch)           │
│  • localStorage: { token, user, chatHistory }           │
└──────────────┬──────────────────────────────────────────┘
               │ HTTP + JWT Bearer Token
               │
┌──────────────▼──────────────────────────────────────────┐
│              BACKEND (Express + SQLite)                  │
├─────────────────────────────────────────────────────────┤
│  • /api/auth (signup, login, change-password)           │
│  • /api/dashboard (logs, sessions, summary)             │
│  • authMiddleware (validates JWT, extracts userId)      │
│  • All queries: WHERE userId = req.userId               │
│  • Real-time Socket.io server                           │
└──────────────┬──────────────────────────────────────────┘
               │ SQLite file or PostgreSQL
               │
┌──────────────▼──────────────────────────────────────────┐
│         DATABASE (SQLite for dev, PostgreSQL prod)      │
├─────────────────────────────────────────────────────────┤
│  • Users (id, email, password_hash)                     │
│  • DailyLogs (id, userId, studyHours, moodRating...)   │
│  • StudySessions (id, userId, subject, duration...)    │
│  • ParentUsers, Assignments, LiveSessionActivity...    │
└─────────────────────────────────────────────────────────┘
```

---

## File Structure Reference

### Backend
```
backend/
├── .env.example              ← Copy to .env for development
├── server.js                 ← Main server
├── sequelize.js              ← Database config
├── models/
│   ├── User.js               ← User accounts
│   ├── DailyLog.js           ← User wellness logs (userId column)
│   ├── StudySession.js       ← Study sessions (userId column)
│   └── ...
├── routes/
│   ├── auth.js               ← signup, login, change-password
│   ├── dashboard.js          ← protected routes with userId filtering
├── socket/
│   └── realtime.js           ← WebSocket for real-time updates
└── database.sqlite           ← SQLite file (dev only)
```

### Frontend
```
frontend-student/
├── .env.example              ← Copy to .env
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx     ← Main dashboard
│   │   ├── Login.jsx
│   │   └── Signup.jsx
│   ├── components/
│   │   └── AIChatbot.jsx     ← Only visible to authenticated users
│   ├── hooks/
│   │   ├── useDataSync.js    ← ✨ NEW: Auto-refetch hook
│   │   └── useAssignments.js
│   ├── services/
│   │   └── api.js            ← API calls with Bearer token
│   └── styles/
└── public/
```

---

## Key Code Examples

### Example 1: Auto-Fetch with useDataSync
```javascript
import { useDataSync } from "../hooks/useDataSync";
import { getDashboardSummary } from "../services/api";

function Dashboard() {
  // Automatically fetches every 30 seconds
  const { data: summary, loading, refetch } = useDataSync(
    () => getDashboardSummary(),
    { autoRefetchInterval: 30000 }
  );

  return (
    <div>
      {loading && <p>Loading...</p>}
      {summary && <p>Stress Index: {summary.stressIndex}</p>}
      <button onClick={() => refetch()}>Refresh Now</button>
    </div>
  );
}
```

### Example 2: Save & Auto-Refetch
```javascript
import { useDataMutation } from "../hooks/useDataSync";
import { saveDailyLog, getDashboardSummary } from "../services/api";

function SaveLogForm() {
  const { mutate: saveLog, loading, error } = useDataMutation(
    (logData) => saveDailyLog(logData),
    () => summary.refetch()  // Auto-refetch after save
  );

  const handleSubmit = async (formData) => {
    await saveLog(formData);
    // Dashboard auto-updates! No manual refetch needed.
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={loading}>{loading ? "Saving..." : "Save"}</button>
    </form>
  );
}
```

### Example 3: User Data Isolation (Backend)
```javascript
// Backend route - automatically filters by userId
router.get("/logs", authMiddleware, async (req, res) => {
  const userId = req.userId;  // From JWT token
  
  const logs = await DailyLog.findAll({
    where: { userId },  // ← Only this user's logs
    order: [["date", "DESC"]],
    limit: 30
  });
  
  res.json(logs);
});
```

---

## Deployment: Choose Your Platform

### 🚀 Option A: Railway (Fastest - Recommended)
1. Push code to GitHub
2. Sign up at railway.app
3. Click "New Project" → GitHub repo → `backend` folder
4. Set environment variables (JWT_SECRET, etc.)
5. Deploy!
6. Frontend on Vercel, point to Railway backend URL

**Cost:** $5-50/month with generous free tier  
**Setup Time:** 15 minutes  
**Best For:** Startups, MVPs, quick deployment

### 🌐 Option B: Render.com
Similar to Railway, good for Node.js apps
**Cost:** $7-50/month  
**Setup Time:** 20 minutes

### 🖥️ Option C: Traditional VPS (DigitalOcean, AWS)
Manual setup with PM2 for process management
**Cost:** $5-20/month  
**Setup Time:** 1-2 hours  
**Best For:** Advanced users wanting full control

→ **See PRODUCTION-DEPLOYMENT.md for detailed steps for each platform**

---

## Security Checklist

Before deploying to production:

```
✅ JWT_SECRET is random 32+ characters
✅ CORS_ORIGINS set to your actual domain (not *)
✅ .env file in .gitignore (not committed)
✅ No hardcoded passwords/API keys
✅ All API endpoints use authMiddleware
✅ All database queries filter by userId
✅ Password hashing with bcrypt
✅ HTTPS enabled (platform handles this)
✅ Database backups configured
✅ Error monitoring enabled
✅ User data isolation tested
```

→ **See SECURITY-DEPLOYMENT-CHECKLIST.md for full checklist & testing procedures**

---

## Common Questions

### Q: How is user data separated?
A: Every API request includes JWT token with userId. Backend middleware extracts it and all queries filter by `WHERE userId = req.userId`. User A literally cannot query User B's data.

### Q: How does auto-refetch work?
A: Frontend `useDataSync` hook fetches data every 30 seconds. When you save via `useDataMutation`, it triggers an immediate refetch. No manual page refresh needed!

### Q: What if I want real-time (WebSocket) updates?
A: Socket.io server exists in `backend/socket/realtime.js`. See REAL-TIME-SYNC-EXAMPLES.md for WebSocket integration pattern.

### Q: Can I use MongoDB instead of SQLite?
A: Yes! Backend uses Sequelize ORM (database-agnostic). Just update `backend/sequelize.js` connection string.

### Q: How do I handle 1000+ concurrent users?
A: Migrate from SQLite to PostgreSQL (built-in to Railway/Render deployments). Add Redis caching layer if needed.

### Q: What about mobile?
A: Same REST API works for React Native, Flutter, iOS, etc. Just point to your deployed backend URL.

---

## Monitoring & Support

### Check System Health
```bash
# Backend health check
curl http://localhost:3001

# Frontend should work
curl http://localhost:3000

# Check logs (if deployed on Railway)
railway logs
```

### Database Backups
```bash
# SQLite
cp backend/database.sqlite backup-$(date +%Y%m%d).sqlite

# PostgreSQL (production)
pg_dump your_db_name > backup-$(date +%Y%m%d).sql
```

### Performance Monitoring
- Track API response times (target <200ms)
- Monitor database queries (target <50ms)
- Watch error rates (aim for <1% of requests)
- Check uptime (target 99.9%)

---

## Next Steps

### 1. Local Development
```bash
npm install  # backend & frontend
npm run dev  # backend
npm start    # frontend
```

### 2. Test User Data Isolation
- Create 2 users in separate browser tabs
- User A creates a log
- User B refreshes → should NOT see User A's log
- Verify isolation works

### 3. Deploy to Production
Follow PRODUCTION-DEPLOYMENT.md for:
- Railway: 15 minutes setup
- Render: 20 minutes setup  
- VPS: 1-2 hours manual setup

### 4. Post-Deployment
- Monitor logs & uptime
- Set up automated backups
- Configure error/alert notifications
- Track performance metrics

---

## Files You'll Reference

| File | Purpose | When to Use |
|------|---------|------------|
| PRODUCTION-DEPLOYMENT.md | Step-by-step deployment | Before deploying |
| API-ENDPOINTS.md | Complete API documentation | When integrating frontend |
| REAL-TIME-SYNC-EXAMPLES.md | Auto-refetch examples | Implementing new features |
| SECURITY-DEPLOYMENT-CHECKLIST.md | Security audit & testing | Before production launch |
| .env.example | Environment template | Setting up dev environment |

---

## Support

### If You Get Stuck:
1. Check the relevant .md file (listed above)
2. Review example code in REAL-TIME-SYNC-EXAMPLES.md
3. Test API endpoints directly with curl (API-ENDPOINTS.md)
4. Verify security checklist (SECURITY-DEPLOYMENT-CHECKLIST.md)
5. Check backend logs for error details

---

## Summary: You Now Have ✅

✅ **User Data Separation**  
Every user's data is isolated. User A cannot see User B's logs.

✅ **Real-Time Sync**  
Data auto-refetches every 30 seconds. Saves trigger immediate updates.

✅ **Production Deployment**  
Ready for Railway, Render, VPS, or your cloud provider.

✅ **Security**  
JWT tokens, bcrypt passwords, userId filtering, CORS configured.

✅ **Scalability**  
SQLite for dev, migrate to PostgreSQL for production.

✅ **Documentation**  
Complete guides for deployment, security, API usage, and examples.

---

**🚀 You're ready to deploy! Start with Railway for the quickest path to production.**

Need help? Review the file guides above or check PRODUCTION-DEPLOYMENT.md first.
