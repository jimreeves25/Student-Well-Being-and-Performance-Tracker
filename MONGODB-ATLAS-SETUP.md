# 🍃 MongoDB Atlas Setup Guide (5 Minutes)

## ✅ Why MongoDB Atlas?
- ✅ **FREE** forever (no credit card needed)
- ✅ **No installation** required
- ✅ **Cloud-based** - works from anywhere
- ✅ **Easy setup** - just 5 steps

---

## 📝 Step-by-Step Setup

### Step 1: Create MongoDB Atlas Account (2 minutes)

1. Go to: **https://www.mongodb.com/cloud/atlas/register**
2. Sign up with:
   - Email address
   - OR Google account
   - OR GitHub account
3. Click "Sign Up"

### Step 2: Create a FREE Cluster (1 minute)

After signing up, you'll see "Create a deployment":

1. Choose: **M0 FREE** (should be already selected)
2. Provider: **AWS** (default is fine)
3. Region: Choose closest to you (e.g., **US East** or **Mumbai** for India)
4. Cluster Name: Leave default or name it `student-wellness`
5. Click: **"Create Deployment"** (green button)

⏳ Wait 1-3 minutes for cluster to be created...

### Step 3: Create Database User (30 seconds)

You'll see a "Security Quickstart" popup:

1. **Username**: Enter a username (e.g., `student` or `admin`)
2. **Password**: Enter a password (e.g., `Student123`)
   
   ⚠️ **IMPORTANT**: Remember this password! You'll need it.

3. Click: **"Create Database User"**

### Step 4: Add Your IP Address (30 seconds)

Still in the same popup:

1. Under "Where would you like to connect from?"
2. Click: **"Add My Current IP Address"**
   
   OR for development:
   
3. Click: **"Allow Access from Anywhere"** (easier for now)
   - This adds IP: `0.0.0.0/0`

4. Click: **"Finish and Close"**

### Step 5: Get Connection String (1 minute)

1. Click: **"Connect"** button on your cluster
2. Choose: **"Drivers"**
3. Select:
   - Driver: **Node.js**
   - Version: **5.5 or later**
4. Copy the connection string (looks like):

```
mongodb+srv://student:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

5. **IMPORTANT**: Replace `<password>` with your actual password from Step 3

Example:
```
If username: student
If password: Student123
Then: mongodb+srv://student:Student123@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

---

## 🔧 Step 6: Update Your Backend Configuration

### Open this file:
```
C:\Users\ADMIN\Downloads\frontend\backend\.env
```

### Replace the MONGODB_URI line:

**Change FROM:**
```env
MONGODB_URI=mongodb://localhost:27017/student-wellness
```

**Change TO:** (use YOUR connection string from Step 5)
```env
MONGODB_URI=mongodb+srv://student:Student123@cluster0.xxxxx.mongodb.net/student-wellness?retryWrites=true&w=majority
```

⚠️ **Make sure to:**
- Replace `<password>` with your actual password
- Add `/student-wellness` before the `?` (this is your database name)

### Save the file!

---

## 🚀 Step 7: Restart Backend Server

1. Go to the terminal running the backend
2. Press `Ctrl + C` to stop it
3. Type `Y` to confirm
4. Restart with:
```powershell
npm start
```

### ✅ Success Message:
You should now see:
```
✅ MongoDB connected successfully
🚀 Server running on http://localhost:3001
```

---

## 🎉 Test Your App!

1. Go to: **http://localhost:3000**
2. Click: **"Sign up here"**
3. Create account:
   - Name: Test User
   - Student ID: STU001
   - Email: test@example.com
   - Password: test123
4. Click: **"Sign Up"**

✅ You should be logged in and see the Dashboard!

---

## 🔍 Troubleshooting

### Error: "Bad Auth: Authentication failed"
- Check your password in .env file is correct
- Password should NOT have `<>` brackets
- Make sure you replaced `<password>` with actual password

### Error: "IP not whitelisted"
- Go to Atlas → Network Access
- Click "Add IP Address"
- Choose "Allow Access from Anywhere"
- Wait 1 minute for it to update

### Error: Still can't connect
1. Check your .env file has the correct connection string
2. Make sure you saved the .env file
3. Make sure you restarted the backend server
4. Check there are no extra spaces in the connection string

---

## 📸 Example Configuration

**Your .env should look like:**
```env
PORT=3001
MONGODB_URI=mongodb+srv://myusername:MyPassword123@cluster0.abc12.mongodb.net/student-wellness?retryWrites=true&w=majority
JWT_SECRET=your_secret_key_change_this_in_production
```

---

## ✅ Benefits of MongoDB Atlas

- ✅ No local installation needed
- ✅ Access from any computer
- ✅ Automatic backups
- ✅ Built-in monitoring
- ✅ Scales easily if needed
- ✅ Free forever (up to 512MB)

---

## 🎓 You're All Set!

Your app is now using cloud database! 

**Next steps:**
1. Create your account
2. Start tracking your wellness
3. Prepare for your viva! 🎉

---

**Need help?** The connection string is the most important part. Make sure it's correct in the .env file!
