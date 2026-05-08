const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');

const SyncLog = sequelize.define('SyncRecord', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false },
    tableName: { type: DataTypes.STRING(64), allowNull: false },
    recordCount: { type: DataTypes.INTEGER },
    syncVersion: { type: DataTypes.INTEGER },
    syncResult: { type: DataTypes.ENUM('success', 'failed', 'partial') },
    errorMessage: { type: DataTypes.TEXT },
    clientIp: { type: DataTypes.STRING(45) },
    startedAt: { type: DataTypes.DATE },
    completedAt: { type: DataTypes.DATE }
}, {
    tableName: 'sync_records',
    timestamps: false,
    indexes: [{ fields: ['clientId', 'startedAt'] }]
});

module.exports = SyncLog;