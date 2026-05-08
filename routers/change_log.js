const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { CustomError, success, fail } = require('../utils/response.js');
const ChangeLog = require('../models/change_log');
const { authToken } = require('../utils/auth.js');

/**
 * 查询变更记录（支持多条件筛选 + 分页）
 * GET /api/change-logs?tableName=User&recordId=xxx&fieldName=name&operatorId=xxx&startDate=2025-01-01&endDate=2025-12-31&page=1&pageSize=20
 */
router.get('/', authToken, async (req, res) => {
    try {
        const {
            tableName,
            recordId,
            fieldName,
            operatorId,
            startDate,
            endDate,
            page = 1,
            pageSize = 20
        } = req.query;

        const where = {};
        if (tableName) where.tableName = tableName;
        if (recordId) where.recordId = recordId;
        if (fieldName) where.fieldName = fieldName;
        if (operatorId) where.operatorId = operatorId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt[Op.gte] = new Date(startDate);
            if (endDate) where.createdAt[Op.lte] = new Date(endDate);
        }

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        const { count, rows } = await ChangeLog.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            offset,
            limit,
            include: [{
                association: 'operator',
                attributes: ['id', 'name', 'eid']  // 只返回必要字段
            }]
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
 * 查询某个记录的完整变更历史（便捷接口）
 * GET /api/change-logs/record/:tableName/:recordId
 */
router.get('/record/:tableName/:recordId', authToken, async (req, res) => {
    try {
        const { tableName, recordId } = req.params;
        const { page = 1, pageSize = 50 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        const { count, rows } = await ChangeLog.findAndCountAll({
            where: { tableName, recordId },
            order: [['createdAt', 'DESC']],
            offset,
            limit,
            include: [{
                association: 'operator',
                attributes: ['id', 'name', 'eid']
            }]
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

module.exports = router;