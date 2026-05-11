const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');
const addLoggingHooks = require('../utils/addLoggingHooks.js');

const MaterialAcceptance = sequelize.define('MaterialAcceptance', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false, unique: true, comment: '客户端唯一ID' },
    userId: { type: DataTypes.UUID, allowNull: false, comment: '创建用户ID' },
    localUpdatedAt: { type: DataTypes.BIGINT, allowNull: false, comment: '客户端最后修改时间戳(ms)' },
    operatorRoleWeight: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1, comment: '1:工人,2:主管,3:检查员' },
    materialName: { type: DataTypes.STRING(64), allowNull: false },
    specification: { type: DataTypes.STRING(64) },
    quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    unit: { type: DataTypes.STRING(16), allowNull: false },
    supplierName: { type: DataTypes.STRING(128) },
    certificateNumber: { type: DataTypes.STRING(64) },
    certificatePhoto: { type: DataTypes.STRING(255) },
    inspectorName: { type: DataTypes.STRING(64), allowNull: false },
    acceptanceTime: { type: DataTypes.DATE, allowNull: false },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false, comment: '软删除标记' }
}, {
    tableName: 'material_acceptances',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['clientId'] },
        { fields: ['userId'] },
        { fields: ['localUpdatedAt'] }
    ]
});
addLoggingHooks(MaterialAcceptance, 'material_acceptances')
module.exports = MaterialAcceptance;