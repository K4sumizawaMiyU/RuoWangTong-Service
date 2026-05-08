const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');
const User = require('./user');

const ChangeLog = sequelize.define('ChangeLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        comment: '变更记录ID'
    },
    tableName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '被修改的表名（如 User, Material）'
    },
    recordId: {
        type: DataTypes.STRING(36),
        allowNull: false,
        comment: '被修改记录的ID（UUID）'
    },
    fieldName: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: '修改的字段名'
    },
    oldValue: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '修改前的值（可存储JSON字符串）'
    },
    newValue: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: '修改后的值'
    },
    operatorId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: '操作人用户ID',
        references: {
            model: User,
            key: 'id'
        }
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
        comment: '变更时间'
    }
}, {
    tableName: 'change_logs',
    timestamps: false,
    comment: '资料修改历史记录表（只读，不可修改）',

    indexes: [
        { fields: ['tableName', 'recordId'] },
        { fields: ['operatorId'] },
        { fields: ['createdAt'] }
    ],

    hooks: {
        beforeUpdate: (log, options) => {
            throw new Error('ChangeLog 记录禁止修改，只能新增历史记录');
        },
        beforeDestroy: (log, options) => {
            throw new Error('ChangeLog 记录禁止删除，历史不可抹除');
        },
        beforeBulkUpdate: (options) => {
            throw new Error('ChangeLog 记录禁止批量更新');
        },
        beforeBulkDestroy: (options) => {
            throw new Error('ChangeLog 记录禁止批量删除');
        }
    }
});

ChangeLog.belongsTo(User, { foreignKey: 'operatorId', as: 'operator' });
User.hasMany(ChangeLog, { foreignKey: 'operatorId', as: 'changeLogs' });

module.exports = ChangeLog;