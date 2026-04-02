const { Sequelize } = require("sequelize");
const path = require("path");

require("dotenv").config();

const dbStoragePath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, "database.sqlite");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: dbStoragePath,
  logging: false,
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

module.exports = sequelize;