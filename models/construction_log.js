const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');;

const ConstructionLog = sequelize.define('ConstructionLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID },
    teamName: { type: DataTypes.STRING(64), allowNull: false },
    recorderName: { type: DataTypes.STRING(64), allowNull: false },
    recorderId: { type: DataTypes.STRING(32) },
    logDate: { type: DataTypes.DATEONLY, allowNull: false },
    workContent: { type: DataTypes.TEXT, allowNull: false },
    equipmentUsage: { type: DataTypes.JSON },
    materialUsage: { type: DataTypes.JSON },
    weather: { type: DataTypes.STRING(128) },
    abnormalSituation: { type: DataTypes.TEXT },
    attachments: { type: DataTypes.JSON },
    syncVersion: { type: DataTypes.INTEGER, defaultValue: 1 },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'construction_logs',
    timestamps: true,
    indexes: [{ fields: ['logDate'] }]
});

module.exports = ConstructionLog;