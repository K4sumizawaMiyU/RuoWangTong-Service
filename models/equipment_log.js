const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');

const EquipmentLog = sequelize.define('EquipmentLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    clientId: { type: DataTypes.UUID },
    equipmentId: { type: DataTypes.STRING(32), allowNull: false },
    equipmentName: { type: DataTypes.STRING(64), allowNull: false },
    operationHours: { type: DataTypes.DECIMAL(10, 2) },
    fuelConsumption: { type: DataTypes.DECIMAL(10, 2) },
    failureRecord: { type: DataTypes.TEXT },
    operatorName: { type: DataTypes.STRING(64) },
    recordTime: { type: DataTypes.DATE, allowNull: false },
    syncVersion: { type: DataTypes.INTEGER, defaultValue: 1 },
    isDeleted: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'equipment_logs',
    timestamps: true,
    indexes: [{ fields: ['equipmentId'] }]
});

module.exports = EquipmentLog;