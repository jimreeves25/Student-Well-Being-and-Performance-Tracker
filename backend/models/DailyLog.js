const { DataTypes } = require("sequelize");
const sequelize = require("../sequelize");

const DailyLog = sequelize.define("DailyLog", {
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
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  // Study tracking
  studyHours: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: { min: 0, max: 24 },
  },
  focusMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: 0 },
  },
  breakMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: 0 },
  },
  screenTime: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: { min: 0, max: 24 },
  },
  // Sleep tracking
  sleepHours: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: { min: 0, max: 24 },
  },
  sleepQuality: {
    type: DataTypes.STRING,
    defaultValue: "Fair",
    validate: {
      isIn: [["Poor", "Fair", "Good", "Excellent"]],
    },
  },
  // Nutrition tracking
  mealsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: 0, max: 10 },
  },
  waterIntake: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    validate: { min: 0 },
  },
  // Exercise tracking
  exerciseMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    validate: { min: 0 },
  },
  exerciseType: {
    type: DataTypes.STRING,
    defaultValue: "",
  },
  // Stress tracking
  stressLevel: {
    type: DataTypes.STRING,
    defaultValue: "Low",
    validate: {
      isIn: [["Low", "Medium", "High"]],
    },
  },
  moodRating: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    validate: { min: 1, max: 10 },
  },
  // Notes
  notes: {
    type: DataTypes.TEXT,
    defaultValue: "",
  },
}, {
  timestamps: true,
  indexes: [
    {
      fields: ["userId", "date"],
    },
  ],
});

module.exports = DailyLog;
