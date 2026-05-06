const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');
const SafetyHazard = sequelize.define('SafetyHazard', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID },
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
    syncVersion: { type: DataTypes.INTEGER, defaultValue: 1 },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'safety_hazards',
    timestamps: true,
    indexes: [{ fields: ['rectificationStatus'] }]
});

module.exports = SafetyHazard; 