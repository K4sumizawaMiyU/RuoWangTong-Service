const express = require('express');
const router = express.Router();
const QualityAcceptance = require('../models/quality_acceptance');
const { Op } = require('sequelize');
const { CustomError, success, fail } = require('../utils/response');
const { authToken } = require('../utils/auth');

router.post('/', authToken, async (req, res) => {
    try {
        const record = await QualityAcceptance.create(req.body);
        success(res, '创建成功', record);
    } catch (err) {
        fail(res, err);
    }
});

router.post('/sync', authToken, async (req, res) => {
    try {
        const records = req.body;
        if (!Array.isArray(records)) return fail(res, new CustomError('请求体必须为数组'));
        const results = [];
        for (const item of records) {
            const existing = await QualityAcceptance.findOne({ where: { clientId: item.clientId } });
            if (existing) await existing.update(item);
            else results.push(await QualityAcceptance.create(item));
        }
        success(res, `同步成功，共处理 ${results.length} 条`, results);
    } catch (err) {
        fail(res, err);
    }
});

router.get('/', authToken, async (req, res) => {
    try {
        const { page = 1, pageSize = 20, location, acceptanceResult, startDate, endDate } = req.query;
        const where = {};
        if (location) where.location = { [Op.like]: `%${location}%` };
        if (acceptanceResult) where.acceptanceResult = acceptanceResult;
        if (startDate && endDate) {
            where.acceptanceTime = { [Op.between]: [new Date(startDate), new Date(endDate)] };
        }
        const offset = (page - 1) * pageSize;
        const { count, rows } = await QualityAcceptance.findAndCountAll({
            where,
            order: [['acceptanceTime', 'DESC']],
            offset,
            limit: parseInt(pageSize)
        });
        success(res, '查询成功', { total: count, list: rows, page, pageSize });
    } catch (err) {
        fail(res, err);
    }
});

router.get('/:id', authToken, async (req, res) => {
    try {
        const record = await QualityAcceptance.findByPk(req.params.id);
        if (!record) return fail(res, new CustomError('记录不存在', 404));
        success(res, '查询成功', record);
    } catch (err) {
        fail(res, err);
    }
});

router.put('/:id', authToken, async (req, res) => {
    try {
        const record = await QualityAcceptance.findByPk(req.params.id);
        if (!record) return fail(res, new CustomError('记录不存在', 404));
        await record.update(req.body);
        success(res, '更新成功', record);
    } catch (err) {
        fail(res, err);
    }
});

router.delete('/:id', authToken, async (req, res) => {
    try {
        const record = await QualityAcceptance.findByPk(req.params.id);
        if (!record) return fail(res, new CustomError('记录不存在', 404));
        await record.update({ isDeleted: true });
        success(res, '删除成功');
    } catch (err) {
        fail(res, err);
    }
});

module.exports = router;