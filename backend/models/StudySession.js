const { DataTypes } = require("sequelize");
const sequelize = global.sequelize;

const StudySession = sequelize.define("StudySession", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "Users",
      key: "id",
    },
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  scheduledDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  completed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  notes: {
    type: DataTypes.TEXT,
    defaultValue: "",
  },
}, {
  timestamps: true,
});

module.exports = StudySession;
