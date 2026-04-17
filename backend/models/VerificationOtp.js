const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const VerificationOtp = sequelize.define(
  "VerificationOtp",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    channel: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    target: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ["channel", "target"] },
      { fields: ["channel", "target", "createdAt"] },
    ],
  }
);

module.exports = VerificationOtp;