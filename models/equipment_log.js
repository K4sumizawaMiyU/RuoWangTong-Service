const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');
const addLoggingHooks = require('../utils/addLoggingHooks.js');

const EquipmentLog = sequelize.define('EquipmentLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false, unique: true, comment: '客户端唯一ID' },
    userId: { type: DataTypes.UUID, allowNull: false, comment: '创建用户ID' },
    localUpdatedAt: { type: DataTypes.BIGINT, allowNull: false, comment: '客户端最后修改时间戳(ms)' },
    operatorRoleWeight: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1, comment: '1:工人,2:主管,3:检查员' },
    equipmentId: { type: DataTypes.STRING(32), allowNull: false },
    equipmentName: { type: DataTypes.STRING(64), allowNull: false },
    operationHours: { type: DataTypes.DECIMAL(10, 2) },
    fuelConsumption: { type: DataTypes.DECIMAL(10, 2) },
    failureRecord: { type: DataTypes.TEXT },
    operatorName: { type: DataTypes.STRING(64) },
    recordTime: { type: DataTypes.DATE, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false, comment: '软删除标记' }
}, {
    tableName: 'equipment_logs',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['clientId'] },
        { fields: ['userId'] },
        { fields: ['localUpdatedAt'] },
        { fields: ['equipmentId'] }
    ]
});
addLoggingHooks(EquipmentLog, 'equipment_logs')
module.exports = EquipmentLog;