const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');
const ChangeLog = require('./change_log');

const InspectionRecord = sequelize.define('InspectionRecord', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID, allowNull: true, comment: '移动端记录ID' },
    inspectorName: { type: DataTypes.STRING(64), allowNull: false },
    inspectorId: { type: DataTypes.STRING(32) },
    inspectionTime: { type: DataTypes.DATE, allowNull: false },
    inspectionArea: { type: DataTypes.STRING(128), allowNull: false },
    inspectionItem: { type: DataTypes.STRING(64), allowNull: false },
    inspectionResult: { type: DataTypes.ENUM('合格', '不合格', '待复核'), allowNull: false },
    problemDescription: { type: DataTypes.TEXT },
    rectificationDeadline: { type: DataTypes.DATEONLY },
    photos: { type: DataTypes.JSON, comment: '照片路径数组' },
    syncVersion: { type: DataTypes.INTEGER, defaultValue: 1 },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'inspection_records',
    timestamps: true,
    indexes: [{ fields: ['inspectorId'] }, { fields: ['inspectionTime'] }],
    paranoid: true

});


module.exports = InspectionRecord;