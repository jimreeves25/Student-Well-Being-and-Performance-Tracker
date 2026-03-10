const { Sequelize } = require('sequelize');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
console.log('Database path:', dbPath);

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: console.log
});

async function checkDatabase() {
  try {
    await sequelize.authenticate();
    console.log('\n✅ Database connected successfully\n');

    // Get table names
    const tables = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table';",
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log('📋 Tables in database:', tables);

    // Check Users
    const users = await sequelize.query('SELECT * FROM Users;', { 
      type: sequelize.QueryTypes.SELECT 
    });
    console.log('\n👥 Users:', users.length, 'records');
    console.log(users);

    // Check DailyLogs
    const logs = await sequelize.query('SELECT * FROM DailyLogs;', { 
      type: sequelize.QueryTypes.SELECT 
    });
    console.log('\n📝 DailyLogs:', logs.length, 'records');
    console.log(logs);

    // Check StudySessions
    const sessions = await sequelize.query('SELECT * FROM StudySessions;', { 
      type: sequelize.QueryTypes.SELECT 
    });
    console.log('\n📚 StudySessions:', sessions.length, 'records');
    console.log(sessions);

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDatabase();
