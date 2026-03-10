const { Sequelize } = require('sequelize');

console.log('=== CHECKING OLD DATABASE ===\n');
const oldDb = new Sequelize({
  dialect: 'sqlite',
  storage: 'C:\\Users\\ADMIN\\Downloads\\backend-StudentPerformancetracker\\database.sqlite',
  logging: false
});

async function checkOldDb() {
  try {
    const users = await oldDb.query('SELECT * FROM Users;', { type: Sequelize.QueryTypes.SELECT });
    console.log('OLD DB Users:', users.length);
    users.forEach(u => console.log(`  - ${u.name} (${u.email})`));
  } catch (error) {
    console.log('Error:', error.message);
  }
  await oldDb.close();
}

console.log('\n=== CHECKING NEW DATABASE ===\n');
const newDb = new Sequelize({
  dialect: 'sqlite',
  storage: 'C:\\Users\\ADMIN\\Downloads\\frontend\\backend\\database.sqlite',
  logging: false
});

async function checkNewDb() {
  try {
    const users = await newDb.query('SELECT * FROM Users;', { type: Sequelize.QueryTypes.SELECT });
    console.log('NEW DB Users:', users.length);
    users.forEach(u => console.log(`  - ${u.name} (${u.email})`));
  } catch (error) {
    console.log('Error:', error.message);
  }
  await newDb.close();
}

(async () => {
  await checkOldDb();
  await checkNewDb();
})();
