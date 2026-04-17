const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const Chat = sequelize.define("Chat", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Users",
      key: "id",
    },
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "New Conversation",
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = Chat;
