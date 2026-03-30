const { Sequelize } = require("sequelize");

require("dotenv").config();

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.sqlite",
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