const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  studentId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
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
  isContactSetup: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  phoneVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
  profilePicture: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  themeMode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notificationsEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  notificationPrefs: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  parentLinkCode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  parentLinkCodeExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  allowWellnessShare: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  timestamps: true,
});

module.exports = User;
