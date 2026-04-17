const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "..", "database.sqlite");

const db = new sqlite3.Database(dbPath, (error) => {
  if (error) {
    console.error("[chat-db] SQLite connection error:", error.message);
    return;
  }
  console.log(`[chat-db] Connected to SQLite at ${dbPath}`);
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });
}

async function initChatPersistenceTables() {
  await run(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      title TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chatId INTEGER,
      role TEXT CHECK(role IN ('user', 'assistant')),
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("[chat-db] Ensured chats/messages tables exist");
}

module.exports = {
  db,
  run,
  all,
  initChatPersistenceTables,
};
