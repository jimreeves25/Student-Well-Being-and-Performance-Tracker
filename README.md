# Student Wellness Dashboard - MERN Stack Application

A comprehensive web application for tracking student wellbeing and academic performance.

## 🌟 Features

### Core Features
✅ Track study hours  
✅ Track screen time  
✅ Manage sleep schedule  
✅ Track food/nutrition  
✅ Schedule study sessions  
✅ Schedule exercise  
✅ Calculate stress index  
✅ Daily tracking/logs  
✅ Student wellbeing & performance summary  

### Additional Features
✅ Daily progress cards  
✅ Stress level indicator (Low/Medium/High)  
✅ Personalized recommendations  
✅ Clean, responsive dashboard layout  

## 🛠️ Tech Stack

**Frontend:**
- React.js
- CSS3 (Custom styling)
- Fetch API

**Backend:**
- Node.js
- Express.js
- MongoDB (with Mongoose)
- JWT Authentication
- bcryptjs for password hashing

## 📁 Project Structure

```
frontend/
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   ├── DailyLog.js
│   │   └── StudySession.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── dashboard.js
│   ├── .env
│   ├── server.js
│   └── package.json
│
└── frontend-student/
    ├── public/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Signup.jsx
    │   │   └── Dashboard.jsx
    │   ├── services/
    │   │   └── api.js
    │   ├── styles/
    │   │   ├── Login.css
    │   │   └── Dashboard.css
    │   ├── App.js
    │   └── index.js
    └── package.json
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB installed and running locally OR MongoDB Atlas account

### Step 1: Install MongoDB (if not already installed)

**Option A: Local MongoDB (Recommended for development)**

**Windows:**
1. Download MongoDB Community Server from: https://www.mongodb.com/try/download/community
2. Install MongoDB (use default settings)
3. MongoDB will start automatically as a service

Or use Chocolatey:
```powershell
choco install mongodb
```

**Option B: MongoDB Atlas (Cloud)**
1. Create free account at https://www.mongodb.com/cloud/atlas
2. Create a cluster
3. Get connection string
4. Update `.env` file in backend with your connection string

### Step 2: Install Backend Dependencies

```powershell
cd backend
npm install
```

### Step 3: Install Frontend Dependencies

```powershell
cd ../frontend-student
npm install
```

### Step 4: Configure Environment Variables

The backend `.env` file is already created with default settings:
```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/student-wellness
JWT_SECRET=your_secret_key_change_this_in_production
```

**If using MongoDB Atlas**, update the `MONGODB_URI` in `backend/.env`:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/student-wellness
```

### Step 5: Start MongoDB (if using local installation)

MongoDB should start automatically. To verify it's running:

```powershell
# Check if MongoDB is running
Get-Service -Name MongoDB*
```

If not running:
```powershell
# Start MongoDB service
net start MongoDB
```

### Step 6: Start the Backend Server

```powershell
cd backend
npm start
```

You should see:
```
✅ MongoDB connected successfully
🚀 Server running on http://localhost:3001
```

### Step 7: Start the Frontend Application

Open a **NEW terminal** window:

```powershell
cd frontend-student
npm start
```

The app will open at `http://localhost:3000`

## 📱 Using the Application

### 1. Sign Up
- Click "Sign up here" on login page
- Enter: Name, Student ID, Email, Password
- Click "Sign Up"

### 2. Login
- Enter your email and password
- Click "Login"

### 3. Dashboard Features

**Add Daily Log:**
- Click "Add Daily Log"
- Fill in:
  - Study Hours
  - Screen Time
  - Sleep Hours & Quality
  - Meals Count & Water Intake
  - Exercise Minutes & Type
  - Stress Level & Mood Rating
  - Notes (optional)
- Click "Save Daily Log"

**Schedule Study Session:**
- Click "Schedule Study Session"
- Enter:
  - Subject
  - Date & Time
  - Duration
  - Notes (optional)
- Click "Schedule Session"

**View Analytics:**
- Stress Index (calculated automatically)
- Average Study Hours (last 7 days)
- Average Sleep (last 7 days)
- Average Screen Time (last 7 days)
- Average Exercise (last 7 days)
- Today's Log Summary
- Personalized Recommendations
- Upcoming Study Sessions

## 🔧 Troubleshooting

### MongoDB Connection Error

**Error:** `MongoDB connection error`

**Solutions:**
1. Check if MongoDB is running:
   ```powershell
   Get-Service -Name MongoDB*
   ```

2. Start MongoDB if not running:
   ```powershell
   net start MongoDB
   ```

3. Verify connection string in `backend/.env`

### Port Already in Use

**Error:** `Port 3001 already in use`

**Solution:**
```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### CORS Error

Make sure backend is running on port 3001 and frontend on port 3000. The backend is configured to accept requests from all origins.

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user

### Dashboard
- `GET /api/dashboard/summary` - Get dashboard summary (requires auth)
- `POST /api/dashboard/log` - Save daily log (requires auth)
- `GET /api/dashboard/logs` - Get all logs (requires auth)
- `POST /api/dashboard/study-session` - Create study session (requires auth)
- `GET /api/dashboard/study-sessions` - Get study sessions (requires auth)
- `PATCH /api/dashboard/study-session/:id/complete` - Mark session complete (requires auth)

## 📊 Stress Index Calculation

The stress index is calculated based on:
- Self-reported stress level (Low: 20, Medium: 50, High: 80)
- Sleep hours (< 6 hours adds 20 points, > 8 hours subtracts 10)
- Exercise (> 30 min subtracts 15 points, otherwise adds 10)
- Screen time (> 8 hours adds 15 points)

Result: 0-100 scale
- Low: 0-34
- Medium: 35-65
- High: 66-100

## 🎨 Customization

### Change Color Scheme

Edit `frontend-student/src/styles/Dashboard.css`:
```css
/* Primary gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Change to your colors */
background: linear-gradient(135deg, #YOUR_COLOR1 0%, #YOUR_COLOR2 100%);
```

### Change Backend Port

1. Update `backend/.env`:
   ```
   PORT=YOUR_PORT
   ```

2. Update `frontend-student/src/services/api.js`:
   ```javascript
   const BASE_URL = "http://localhost:YOUR_PORT/api";
   ```

## 📝 Development Mode

For development with auto-reload:

**Backend:**
```powershell
cd backend
npm install -g nodemon
npm run dev
```

**Frontend:**
```powershell
cd frontend-student
npm start
```

## 🔐 Security Notes

- Change `JWT_SECRET` in production
- Use HTTPS in production
- Implement rate limiting for production
- Add input validation and sanitization
- Use environment-specific configurations

## 📄 License

MIT License - feel free to use for your projects!

## 🤝 Contributing

This is a student project. Feel free to fork and enhance!

## 📞 Support

For issues or questions, check:
1. MongoDB is running
2. Both frontend and backend servers are running
3. Ports 3000 and 3001 are available
4. Environment variables are set correctly

---

**Happy Learning! 🎓**
