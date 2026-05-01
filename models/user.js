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
        validate: { isNumeric: true, len: [11, 11] },
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
        type: DataTypes.ENUM('supervisor', 'worker', 'inspector'),
        defaultValue: 'worker',
    },
    lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'createdAt',
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'updatedAt',
    },
    deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deletedAt',
    },
}, {
    tableName: 'users',
    timestamps: false,
});

User.beforeCreate(async (user) => {
    if (user.password) {
        user.password = await bcrypt.hash(user.password, 12);
    }
});

User.beforeUpdate(async (user) => {
    if (user.changed('password')) {
        user.password = await bcrypt.hash(user.password, 12);
    }
});

User.prototype.validatePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
};

module.exports = User;