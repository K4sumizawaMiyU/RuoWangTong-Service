const { DataTypes } = require('sequelize');
const sequelize = require('../database/db');
const ChangeLog = require('./change_log');
const User = require('./user')
const Project = require('./projects');


const ProjectInspector = sequelize.define('ProjectInspector', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    projectId: { type: DataTypes.UUID, allowNull: false },
    inspectorId: { type: DataTypes.UUID, allowNull: false },
    assignedBy: { type: DataTypes.UUID, allowNull: false },
    assignedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
    tableName: 'project_inspectors',
    timestamps: false,
    indexes: [
        { fields: ['projectId'] },
        { fields: ['inspectorId'] }
    ]
});
ProjectInspector.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

module.exports = ProjectInspector;