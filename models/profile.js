const { Sequelize } = require('sequelize');
const sequelize = require('../database/db.js');
const User = require('./user.js');

const Profile = sequelize.define('Profile', {
    id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        autoIncrement: true,
    },
    employeeId: {
        type: Sequelize.STRING(16),
        allowNull: false,
        unique: true,
    },
    name: {
        type: Sequelize.STRING(50),
        allowNull: true,
    },
}, {
    sequelize,
    tableName: 'profiles',
    timestamps: true,
});

// 一个用户对应一个资料
User.hasOne(Profile, {
    foreignKey: 'user_id'
});
Profile.belongsTo(User, {
    foreignKey: 'user_id'
});

module.exports = Profile;