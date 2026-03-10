const express = require("express");
const { Sequelize } = require("sequelize");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow tools like curl/postman with no origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

// SQLite Database Connection
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite", // Database file
  logging: false, // Disable SQL query logging
  retry: {
    match: [/SQLITE_BUSY/],
    max: 5,
  },
  pool: {
    max: 1,
    min: 0,
    idle: 10000,
  },
});

// Export sequelize for models BEFORE importing them
global.sequelize = sequelize;

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
}

// Test database connection and sync models
sequelize
  .authenticate()
  .then(() => {
    console.log("✅ SQLite database connected successfully");
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

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/parent", parentRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ message: "Student Wellness Backend API is running" });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
