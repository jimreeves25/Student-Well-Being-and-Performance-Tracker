const { DataTypes } = require("sequelize");
const sequelize = global.sequelize;

const ParentLinkRequest = sequelize.define(
  "ParentLinkRequest",
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
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "ParentUsers",
        key: "id",
      },
    },
    verificationCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: [["pending", "approved", "rejected"]],
      },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    indexes: [{ fields: ["studentId", "status"] }, { fields: ["parentId", "status"] }],
  }
);

module.exports = ParentLinkRequest;
