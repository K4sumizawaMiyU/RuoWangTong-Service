const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');

const MaterialAcceptance = sequelize.define('MaterialAcceptance', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID },
    materialName: { type: DataTypes.STRING(64), allowNull: false },
    specification: { type: DataTypes.STRING(64) },
    quantity: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    unit: { type: DataTypes.STRING(16), allowNull: false },
    supplierName: { type: DataTypes.STRING(128) },
    certificateNumber: { type: DataTypes.STRING(64) },
    certificatePhoto: { type: DataTypes.STRING(255) },
    inspectorName: { type: DataTypes.STRING(64), allowNull: false },
    acceptanceTime: { type: DataTypes.DATE, allowNull: false },
    syncVersion: { type: DataTypes.INTEGER, defaultValue: 1 },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'material_acceptances',
    timestamps: true,
});

module.exports = MaterialAcceptance;