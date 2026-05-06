const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');

const QualityAcceptance = sequelize.define('QualityAcceptance', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID },
    location: { type: DataTypes.STRING(128), allowNull: false },
    standardCode: { type: DataTypes.STRING(64) },
    measuredData: { type: DataTypes.JSON },
    acceptanceResult: { type: DataTypes.ENUM('通过', '不通过'), allowNull: false },
    supervisorName: { type: DataTypes.STRING(64), allowNull: false },
    contractorName: { type: DataTypes.STRING(64), allowNull: false },
    electronicSignature: { type: DataTypes.STRING(255) },
    acceptanceTime: { type: DataTypes.DATE, allowNull: false },
    syncVersion: { type: DataTypes.INTEGER, defaultValue: 1 },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'quality_acceptances',
    timestamps: true,
});

module.exports = QualityAcceptance;