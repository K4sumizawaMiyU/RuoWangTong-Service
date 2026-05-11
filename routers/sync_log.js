const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { CustomError, success, fail } = require('../utils/response.js');
const SyncLog = require('../models/sync_record');
const { authToken } = require('../utils/auth.js');

/**
 * 查询同步日志（支持多条件筛选 + 分页）
 * GET /api/sync-log?clientId=...&tableName=...&syncResult=...&startDate=...&endDate=...&page=1&pageSize=20
 */
router.get('/', authToken, async (req, res) => {
    try {
        const {
            clientId,
            tableName,
            syncResult,
            startDate,
            endDate,
            page = 1,
            pageSize = 20
        } = req.query;

        const where = {};
        if (clientId) where.clientId = clientId;
        if (tableName) where.tableName = tableName;
        if (syncResult) where.syncResult = syncResult;
        if (startDate || endDate) {
            where.startedAt = {};
            if (startDate) where.startedAt[Op.gte] = new Date(startDate);
            if (endDate) where.startedAt[Op.lte] = new Date(endDate);
        }

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        const { count, rows } = await SyncLog.findAndCountAll({
            where,
            order: [['startedAt', 'DESC']],
            offset,
            limit
        });

        success(res, '查询成功', {
            total: count,
            page: parseInt(page),
            pageSize: limit,
            data: rows
        });
    } catch (err) {
        fail(res, err);
    }
});

router.get('/client/:clientId', authToken, async (req, res) => {
    try {
        const { clientId } = req.params;
        const { page = 1, pageSize = 20 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        const { count, rows } = await SyncLog.findAndCountAll({
            where: { clientId },
            order: [['startedAt', 'DESC']],
            offset,
            limit
        });

        success(res, '查询成功', {
            total: count,
            page: parseInt(page),
            pageSize: limit,
            data: rows
        });
    } catch (err) {
        fail(res, err);
    }
});

/**
 * 获取某张表的同步记录
 * GET /api/sync-log/table/:tableName
 */
router.get('/table/:tableName', authToken, async (req, res) => {
    try {
        const { tableName } = req.params;
        const { page = 1, pageSize = 20 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        const { count, rows } = await SyncLog.findAndCountAll({
            where: { tableName },
            order: [['startedAt', 'DESC']],
            offset,
            limit
        });

        success(res, '查询成功', {
            total: count,
            page: parseInt(page),
            pageSize: limit,
            data: rows
        });
    } catch (err) {
        fail(res, err);
    }
});

/**
 * 获取单条同步记录详情
 * GET /api/sync-log/:id
 */
router.get('/:id', authToken, async (req, res) => {
    try {
        const { id } = req.params;
        const log = await SyncLog.findByPk(id);
        if (!log) {
            return fail(res, new CustomError('同步记录不存在', 404));
        }
        success(res, '查询成功', log);
    } catch (err) {
        fail(res, err);
    }
});

module.exports = router;