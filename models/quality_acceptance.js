const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');
const addLoggingHooks = require('../utils/addLoggingHooks.js');

const QualityAcceptance = sequelize.define('QualityAcceptance', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false, unique: true, comment: '客户端唯一ID' },
    userId: { type: DataTypes.UUID, allowNull: false, comment: '创建用户ID' },
    localUpdatedAt: { type: DataTypes.BIGINT, allowNull: false, comment: '客户端最后修改时间戳(ms)' },
    operatorRoleWeight: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1, comment: '1:工人,2:主管,3:检查员' },
    location: { type: DataTypes.STRING(128), allowNull: false },
    standardCode: { type: DataTypes.STRING(64) },
    measuredData: { type: DataTypes.JSON },
    acceptanceResult: { type: DataTypes.ENUM('通过', '不通过'), allowNull: false },
    supervisorName: { type: DataTypes.STRING(64), allowNull: false },
    contractorName: { type: DataTypes.STRING(64), allowNull: false },
    electronicSignature: { type: DataTypes.STRING(255) },
    acceptanceTime: { type: DataTypes.DATE, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false, comment: '软删除标记' }
}, {
    tableName: 'quality_acceptances',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['clientId'] },
        { fields: ['userId'] },
        { fields: ['localUpdatedAt'] }
    ]
});
addLoggingHooks(QualityAcceptance, 'quality_acceptances')
module.exports = QualityAcceptance;