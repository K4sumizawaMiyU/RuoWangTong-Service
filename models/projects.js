const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');

const Project = sequelize.define('Project', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: '项目ID'
    },
    code: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true,
        comment: '项目编码，唯一'
    },
    name: {
        type: DataTypes.STRING(128),
        allowNull: false,
        comment: '项目名称'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '项目描述'
    },
    supervisor_id: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: '负责主管ID，关联 users.id'
    },
    startDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '项目开始日期'
    },
    endDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: '项目结束日期'
    },
    status: {
        type: DataTypes.ENUM('进行中', '已完成', '暂停', '规划中'),
        defaultValue: '规划中',
        comment: '项目状态'
    },
    location: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '项目地点'
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: '软删除标记'
    }
}, {
    tableName: 'projects',
    timestamps: true,
    paranoid: false,
    indexes: [
        { fields: ['code'] },
        { fields: ['supervisor_id'] },
        { fields: ['status'] }
    ]
});

module.exports = Project;