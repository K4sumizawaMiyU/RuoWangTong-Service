const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');
const addLoggingHooks = require('../utils/addLoggingHooks.js');

const InspectionRecord = sequelize.define('InspectionRecord', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: false, unique: true, comment: '客户端唯一ID' },
    userId: { type: DataTypes.UUID, allowNull: false, comment: '创建用户ID' },
    projectId: { type: DataTypes.UUID, allowNull: false, comment: '所属项目ID' },
    projectName: { type: DataTypes.STRING(128), allowNull: false, comment: '项目名称（冗余）' },
    localUpdatedAt: { type: DataTypes.BIGINT, allowNull: false, comment: '客户端最后修改时间戳(ms)' },
    operatorRoleWeight: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1, comment: '1:工人,2:主管,3:检查员' },
    inspectorName: { type: DataTypes.STRING(64), allowNull: false },
    inspectorId: { type: DataTypes.STRING(32) },
    inspectionTime: { type: DataTypes.DATE, allowNull: false },
    inspectionArea: { type: DataTypes.STRING(128), allowNull: false },
    inspectionItem: { type: DataTypes.STRING(64), allowNull: false },
    inspectionResult: { type: DataTypes.ENUM('合格', '不合格', '待复核'), allowNull: false },
    problemDescription: { type: DataTypes.TEXT },
    rectificationDeadline: { type: DataTypes.DATEONLY },
    photos: { type: DataTypes.JSON, comment: '照片路径数组' },
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
    tableName: 'inspection_records',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['clientId'] },
        { fields: ['userId'] },
        { fields: ['localUpdatedAt'] },
        { fields: ['inspectorId'] },
        { fields: ['inspectionTime'] }
    ]
});
addLoggingHooks(InspectionRecord, 'inspection_records')
module.exports = InspectionRecord;