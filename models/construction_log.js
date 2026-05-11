const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');
const addLoggingHooks = require('../utils/addLoggingHooks.js');


const ConstructionLog = sequelize.define('ConstructionLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false, unique: true, comment: '客户端唯一ID' },
    userId: { type: DataTypes.UUID, allowNull: false, comment: '创建用户ID' },
    localUpdatedAt: { type: DataTypes.BIGINT, allowNull: false, comment: '客户端最后修改时间戳(ms)' },
    operatorRoleWeight: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1, comment: '1:工人,2:主管,3:检查员' },
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
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false, comment: '软删除标记' }
}, {
    tableName: 'construction_logs',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['clientId'] },
        { fields: ['userId'] },
        { fields: ['localUpdatedAt'] },
        { fields: ['logDate'] }
    ]
});
addLoggingHooks(ConstructionLog, 'construction_logs');
module.exports = ConstructionLog;