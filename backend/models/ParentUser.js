const { DataTypes } = require("sequelize");
const sequelize = global.sequelize;

const ParentUser = sequelize.define(
  "ParentUser",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    linkedStudentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
    },
    approvalStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: [["pending", "approved", "rejected"]],
      },
    },
    notifyByEmail: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notifyByDashboard: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notifyByPush: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = ParentUser;
