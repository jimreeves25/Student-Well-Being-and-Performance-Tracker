const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const NotificationLog = sequelize.define(
  "NotificationLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "student",
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    channel: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    messagePreview: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "sent",
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ["userId", "type", "channel", "sentAt"] },
      { fields: ["userId", "readAt"] },
    ],
  }
);

module.exports = NotificationLog;