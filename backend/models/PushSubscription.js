const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const PushSubscription = sequelize.define(
  "PushSubscription",
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
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    p256dh: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    auth: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    indexes: [{ fields: ["userId", "endpoint"], unique: true }],
  }
);

module.exports = PushSubscription;