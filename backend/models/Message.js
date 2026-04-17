const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const Message = sequelize.define("Message", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  chatId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Chats",
      key: "id",
    },
    onDelete: "CASCADE",
  },
  role: {
    type: DataTypes.ENUM("user", "assistant"),
    allowNull: false,
    validate: {
      isIn: [["user", "assistant"]],
    },
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = Message;
