const { DataTypes } = require("sequelize");
const sequelize = global.sequelize;

const LiveSessionActivity = sequelize.define(
  "LiveSessionActivity",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    studentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
    },
    studySessionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "StudySessions",
        key: "id",
      },
    },
    joinTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    lastActiveAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    leaveTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    activeSeconds: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    inactiveSeconds: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "active",
      validate: {
        isIn: [["active", "ended", "inactive"]],
      },
    },
  },
  {
    timestamps: true,
    indexes: [{ fields: ["studentId", "createdAt"] }],
  }
);

module.exports = LiveSessionActivity;
