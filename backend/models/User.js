const { DataTypes } = require("sequelize");
const sequelize = global.sequelize;

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
