# Quick Start Guide 🚀

## Option 1: Using MongoDB Locally (Recommended for Development)

### Step 1: Install MongoDB (if not installed)

**Check if MongoDB is installed:**
```powershell
mongod --version
```

**If not installed:**

**Method A - Download Installer:**
1. Go to: https://www.mongodb.com/try/download/community
2. Download MongoDB Community Server for Windows
3. Run installer with default settings
4. MongoDB will start automatically

**Method B - Using Chocolatey (if you have it):**
```powershell
choco install mongodb
```

### Step 2: Verify MongoDB is Running

```powershell
# Check service status
Get-Service -Name MongoDB*

# If stopped, start it
net start MongoDB
```

### Step 3: Start the Application

**Option A - Double-click:**
- Double-click `start-app.bat` file

**Option B - Manual:**

Open **Terminal 1** (Backend):
```powershell
cd C:\Users\ADMIN\Downloads\frontend\backend
npm start
```

Open **Terminal 2** (Frontend):
```powershell
cd C:\Users\ADMIN\Downloads\frontend\frontend-student
npm start
```

### Step 4: Access the Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

---

## Option 2: Using MongoDB Atlas (Cloud) - No Local Installation Needed!

### Step 1: Create MongoDB Atlas Account

1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up for FREE account
3. Create a FREE cluster (M0 Sandbox)
4. Click "Connect" on your cluster

### Step 2: Get Connection String

1. Choose "Connect your application"
2. Select "Node.js" driver
3. Copy the connection string (looks like):
   ```
   mongodb+srv://username:<password>@cluster0.xxxxx.mongodb.net/
   ```

### Step 3: Update Backend Configuration

Edit `C:\Users\ADMIN\Downloads\frontend\backend\.env`:

```env
PORT=3001
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/student-wellness
JWT_SECRET=your_secret_key_change_this_in_production
```

**Replace:**
- `YOUR_USERNAME` with your MongoDB Atlas username
- `YOUR_PASSWORD` with your MongoDB Atlas password
- `YOUR_CLUSTER` with your cluster name

### Step 4: Whitelist Your IP

In MongoDB Atlas:
1. Go to "Network Access"
2. Click "Add IP Address"
3. Click "Allow Access from Anywhere" (for development)

### Step 5: Start the Application

Same as Option 1, Step 3 above.

---

## Test Your Setup

### 1. Check Backend is Running

Open browser: http://localhost:3001

You should see:
```json
{"message":"Student Wellness Backend API is running"}
```

### 2. Check Frontend is Running

Open browser: http://localhost:3000

You should see the Login page!

### 3. Create First Account

1. Click "Sign up here"
2. Fill in:
   - Name: Test User
   - Student ID: STU001
   - Email: test@example.com
   - Password: test123
3. Click "Sign Up"
4. You'll be redirected to Dashboard!

---

## Troubleshooting

### Problem: "Cannot connect to MongoDB"

**Using Local MongoDB:**
```powershell
# Start MongoDB service
net start MongoDB

# If service doesn't exist, MongoDB isn't installed
# Follow Option 2 (MongoDB Atlas) instead
```

**Using MongoDB Atlas:**
- Check your connection string is correct
- Check your IP is whitelisted
- Check username/password are correct

### Problem: "Port 3001 already in use"

```powershell
# Find what's using port 3001
netstat -ano | findstr :3001

# Kill the process (replace <PID> with actual number)
taskkill /PID <PID> /F

# Then restart backend
cd backend
npm start
```

### Problem: "Port 3000 already in use"

The frontend will ask if you want to use a different port. Say "Yes".

---

## Stopping the Application

1. In both terminal windows, press `Ctrl + C`
2. Type `Y` when asked to terminate

---

## Need Help?

Check the full README.md file for detailed documentation!

**Common Issues:**
- Make sure Node.js is installed: `node --version`
- Make sure npm is installed: `npm --version`
- Both should be version 14 or higher

**Still stuck?**
1. Close all terminals
2. Run `setup.bat` again
3. Follow this Quick Start guide from beginning

---

**You're all set! Happy tracking! 🎓✨**
