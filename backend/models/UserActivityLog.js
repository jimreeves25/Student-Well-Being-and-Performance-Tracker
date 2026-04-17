const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const UserActivityLog = sequelize.define(
  "UserActivityLog",
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
    activityType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    metadata: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    indexes: [{ fields: ["userId", "activityType", "occurredAt"] }],
  }
);

module.exports = UserActivityLog;