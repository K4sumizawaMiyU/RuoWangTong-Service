const express = require('express');
const router = express.Router();
const SyncRecord = require('../models/sync_log');
const { Op } = require('sequelize');
const { CustomError, success, fail } = require('../utils/response');
const { authToken } = require('../utils/auth');

// 查询同步日志（支持分页和筛选）
router.get('/', authToken, async (req, res) => {
    try {
        const { page = 1, pageSize = 20, clientId, tableName, syncResult, startDate, endDate } = req.query;
        const where = {};
        if (clientId) where.clientId = clientId;
        if (tableName) where.tableName = tableName;
        if (syncResult) where.syncResult = syncResult;
        if (startDate && endDate) {
            where.startedAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
        }
        const offset = (page - 1) * pageSize;
        const { count, rows } = await SyncRecord.findAndCountAll({
            where,
            order: [['startedAt', 'DESC']],
            offset,
            limit: parseInt(pageSize)
        });
        success(res, '查询成功', { total: count, list: rows, page, pageSize });
    } catch (err) {
        fail(res, err);
    }
});

// 获取单条同步详情
router.get('/:id', authToken, async (req, res) => {
    try {
        const record = await SyncRecord.findByPk(req.params.id);
        if (!record) return fail(res, new CustomError('记录不存在', 404));
        success(res, '查询成功', record);
    } catch (err) {
        fail(res, err);
    }
});

// 注：sync_log 一般由系统内部写入，不提供创建/更新/删除接口

module.exports = router;