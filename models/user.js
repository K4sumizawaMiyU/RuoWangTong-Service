const { DataTypes } = require('sequelize');
const sequelize = require('../database/db.js');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    eid: {
        type: DataTypes.STRING(16),
        allowNull: false,
        unique: true,
    },
    phone: {
        type: DataTypes.STRING(11),
        allowNull: false,
        unique: true,
        validate: {
            isNumeric: { msg: '手机号必须为数字' },
            len: [11, 11]
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    role: {
        type: DataTypes.ENUM('主管', '工人', '检查员'),
        defaultValue: '工人',
    },
    avatar: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: '头像路径或URL'
    },
    lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    role_weight: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        comment: '1:工人, 2:检查员, 3:主管'
    },
    project_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: '施工项目ID'
    }
}, {
    tableName: 'users',
    timestamps: true,
});

User.prototype.validatePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

User.beforeCreate(async (user) => {
    if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
    }
    user.role_weight = { '工人': 1, '检查员': 2, '主管': 3 }[user.role] || 1;
});

User.beforeUpdate(async (user) => {
    if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
    }
    if (user.changed('role')) {
        user.role_weight = { '工人': 1, '检查员': 2, '主管': 3 }[user.role] || 1;
    }
});

module.exports = User;