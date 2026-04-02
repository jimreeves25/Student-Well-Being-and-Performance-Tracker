const express = require("express");
const http = require("http");
const cors = require("cors");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const { initializeRealtimeServer } = require("./socket/realtime");
const sequelize = require("./sequelize");

const app = express();
const httpServer = http.createServer(app);

// Middleware
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Allow common local dev hosts even if not explicitly listed in env.
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow tools like curl/postman with no origin header.
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      // Reject by disabling CORS for this request instead of throwing 500.
      return callback(null, false);
    },
  })
);
app.use(express.json());

// Import models BEFORE syncing - this registers them with Sequelize
const User = require("./models/User");
const DailyLog = require("./models/DailyLog");
const StudySession = require("./models/StudySession");
const ParentUser = require("./models/ParentUser");
const ParentLinkRequest = require("./models/ParentLinkRequest");
const LiveSessionActivity = require("./models/LiveSessionActivity");
const ParentAlert = require("./models/ParentAlert");
const Assignment = require("./models/Assignment");

async function ensureColumn(tableName, columnName, columnSqlType) {
  const [columns] = await sequelize.query(`PRAGMA table_info(${tableName});`);
  const hasColumn = columns.some((col) => col.name === columnName);

  if (!hasColumn) {
    await sequelize.query(
      `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSqlType};`
    );
    console.log(`✅ Added missing column ${tableName}.${columnName}`);
  }
}

async function runLegacySchemaFixes() {
  await ensureColumn("DailyLogs", "focusMinutes", "INTEGER DEFAULT 0");
  await ensureColumn("DailyLogs", "breakMinutes", "INTEGER DEFAULT 0");
  await ensureColumn("Users", "parentLinkCode", "VARCHAR(255)");
  await ensureColumn("Users", "parentLinkCodeExpiresAt", "DATETIME");
  await ensureColumn("ParentUsers", "notifyByEmail", "BOOLEAN DEFAULT 1");
  await ensureColumn("ParentUsers", "notifyByDashboard", "BOOLEAN DEFAULT 1");
  await ensureColumn("ParentUsers", "notifyByPush", "BOOLEAN DEFAULT 0");
}

async function ensureTestUserIfEmpty() {
  const userCount = await User.count();
  console.log(`ℹ️ User count in database: ${userCount}`);

  const existingTestUser = await User.findOne({ where: { email: "test@example.com" } });
  if (existingTestUser) {
    console.log("ℹ️ Test user already exists", {
      id: existingTestUser.id,
      email: existingTestUser.email,
    });
    return;
  }

  const passwordHash = await bcrypt.hash("123456", 10);
  const testUser = await User.create({
    name: "Test User",
    studentId: "TEST001",
    email: "test@example.com",
    password: passwordHash,
  });

  console.log("✅ Seeded test user for login verification", {
    id: testUser.id,
    email: testUser.email,
    studentId: testUser.studentId,
  });
}

// Test database connection and sync models
sequelize
  .authenticate()
  .then(() => {
    console.log("✅ SQLite database connected successfully");
    console.log(`ℹ️ SQLite storage path: ${sequelize.options.storage}`);
    return Promise.all([
      sequelize.query("PRAGMA journal_mode = WAL;"),
      sequelize.query("PRAGMA busy_timeout = 5000;"),
      sequelize.query("PRAGMA synchronous = NORMAL;"),
    ]);
  })
  .then(() => {
    // Create missing tables only; avoid SQLite table rebuilds on older DB files.
    return sequelize.sync({ alter: false });
  })
  .then(() => {
    return runLegacySchemaFixes();
  })
  .then(() => {
    return ensureTestUserIfEmpty();
  })
  .then(() => {
    console.log("✅ Database tables synchronized");
    console.log("✅ Models registered: User, DailyLog, StudySession, ParentUser, ParentLinkRequest, LiveSessionActivity, ParentAlert, Assignment");
  })
  .catch((err) => {
    console.error("❌ Database error:", err);
  });

// Routes
const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const parentRoutes = require("./routes/parent");
const chatRoutes = require("./routes/chat");

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/parent", parentRoutes);
app.use("/api/chat", chatRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Student Wellness Backend API is running" });
});

// Start server
initializeRealtimeServer(httpServer, allowedOrigins);

function startServer(port = process.env.PORT || 3001) {
  const PORT = Number(port) || 3001;

  httpServer.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use. Set PORT in backend/.env to another value.`);
      return;
    }
    console.error("❌ Server error:", error);
  });

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, httpServer, sequelize, startServer };
