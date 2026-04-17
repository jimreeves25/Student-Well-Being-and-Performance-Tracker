const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const ContactVerification = sequelize.define(
  "ContactVerification",
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
    otpHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    newValue: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ["userId", "type", "used"] },
      { fields: ["userId", "expiresAt"] },
    ],
  }
);

module.exports = ContactVerification;