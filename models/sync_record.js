const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');

const SyncRecord = sequelize.define('SyncRecord', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, comment: '操作用户ID' },
    userName: { type: DataTypes.STRING(50), allowNull: false, comment: '操作用户姓名' },
    userEid: { type: DataTypes.STRING(16), allowNull: false, comment: '操作用工号' },
    tableName: { type: DataTypes.STRING(64), allowNull: false },
    recordCount: { type: DataTypes.INTEGER },
    syncResult: { type: DataTypes.ENUM('success', 'failed', 'partial') },
    errorMessage: { type: DataTypes.TEXT },
    clientIp: { type: DataTypes.STRING(45) },
    startedAt: { type: DataTypes.DATE },
    completedAt: { type: DataTypes.DATE }
}, {
    tableName: 'sync_records',
    timestamps: false,
    indexes: [{ fields: ['userId', 'startedAt'] }]
});

module.exports = SyncRecord;