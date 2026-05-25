const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');
const addLoggingHooks = require('../utils/addLoggingHooks.js');

const SafetyHazard = sequelize.define('SafetyHazard', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false, unique: true, comment: '客户端唯一ID' },
    userId: { type: DataTypes.UUID, allowNull: false, comment: '创建用户ID' },
    projectId: { type: DataTypes.UUID, allowNull: false, comment: '所属项目ID' },
    projectName: { type: DataTypes.STRING(128), allowNull: false, comment: '项目名称（冗余）' },
    localUpdatedAt: { type: DataTypes.BIGINT, allowNull: false, comment: '客户端最后修改时间戳(ms)' },
    operatorRoleWeight: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1, comment: '1:工人,2:主管,3:检查员' },
    discovererName: { type: DataTypes.STRING(64), allowNull: false },
    discovererId: { type: DataTypes.STRING(32) },
    discoverTime: { type: DataTypes.DATE, allowNull: false },
    hazardType: { type: DataTypes.STRING(32), allowNull: false },
    hazardDescription: { type: DataTypes.TEXT, allowNull: false },
    hazardPhotos: { type: DataTypes.JSON },
    riskLevel: { type: DataTypes.ENUM('高', '中', '低'), allowNull: false },
    responsiblePerson: { type: DataTypes.STRING(64), allowNull: false },
    rectificationStatus: { type: DataTypes.ENUM('未整改', '整改中', '已完成'), defaultValue: '未整改' },
    rectificationPhotos: { type: DataTypes.JSON },
    reviewStatus: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending',
        comment: '审核状态: pending待审核, approved已通过, rejected不通过'
    },
    reviewerId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '审核人(检查员)ID'
    },
    reviewTime: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: '审核时间'
    },
    reviewComment: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '审核意见'
    },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false, comment: '软删除标记' }
}, {
    tableName: 'safety_hazards',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['clientId'] },
        { fields: ['userId'] },
        { fields: ['localUpdatedAt'] },
        { fields: ['rectificationStatus'] }
    ]
});

addLoggingHooks(SafetyHazard, 'safety_hazards')
module.exports = SafetyHazard;