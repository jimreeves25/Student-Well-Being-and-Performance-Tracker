const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const NotificationPreference = sequelize.define(
  "NotificationPreference",
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
    emailOn: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    smsOn: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    pushOn: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    reminderLeadTime: {
      type: DataTypes.INTEGER,
      defaultValue: 15,
    },
    dailyLogReminderTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    weeklyDigestOn: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    alertSensitivity: {
      type: DataTypes.STRING,
      defaultValue: "all",
    },
  },
  {
    timestamps: true,
    indexes: [{ unique: true, fields: ["userId", "role"] }],
  }
);

module.exports = NotificationPreference;