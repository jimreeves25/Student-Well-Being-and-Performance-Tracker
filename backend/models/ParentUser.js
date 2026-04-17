const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

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
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    emailOtpCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emailOtpTarget: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emailOtpPurpose: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    emailOtpExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    phoneOtpCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phoneOtpTarget: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phoneOtpPurpose: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phoneOtpExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    canChangeEmailUntil: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    canChangePhoneUntil: {
      type: DataTypes.DATE,
      allowNull: true,
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
