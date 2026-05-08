const sequelize = require('../database/db.js');

require('../models/user');
require('../models/inspection_Record');
require('../models/construction_log');
require('../models/quality_acceptance');
require('../models/safety_hazard');
require('../models/equipment_log');
require('../models/material_acceptance');
require('../models/sync_log');
require('../models/change_log.js')

const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('MySQL 连接成功');
        await sequelize.sync({ alter: false });
        console.log('所有数据表已就绪（若不存在则自动创建）');
    } catch (error) {
        console.error('数据库初始化失败:', error);
        process.exit(1);
    }
};

module.exports = initDB;