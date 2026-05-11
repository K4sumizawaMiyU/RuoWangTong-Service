
const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { authToken } = require('../utils/auth');
const { success, fail, CustomError } = require('../utils/response');
const SyncRecord = require('../models/sync_record');
const User = require('../models/user.js');

const ConstructionLog = require('../models/construction_log');
const EquipmentLog = require('../models/equipment_log');
const QualityAcceptance = require('../models/quality_acceptance');
const SafetyHazard = require('../models/safety_hazard');
const MaterialAcceptance = require('../models/material_acceptance');
const InspectionRecord = require('../models/inspection_record');

const modelMap = {
    constructionLog: ConstructionLog,
    equipmentLog: EquipmentLog,
    qualityAcceptance: QualityAcceptance,
    safetyHazard: SafetyHazard,
    materialAcceptance: MaterialAcceptance,
    inspectionRecord: InspectionRecord
};

function getClientIp(req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || '';
}

function isClientWinner(clientRecord, serverRecord) {
    const clientWeight = clientRecord.operatorRoleWeight;
    const serverWeight = serverRecord.operatorRoleWeight;
    if (clientWeight > serverWeight) return true;
    if (clientWeight < serverWeight) return false;
    return clientRecord.localUpdatedAt > serverRecord.localUpdatedAt;
}

// 批量多表同步接口
router.post('/', authToken, async (req, res) => {
    const startTime = new Date();
    const clientIp = getClientIp(req);
    let syncError = null;
    let overallResult = 'success';
    let totalRecords = 0;
    const user = await User.findByPk(req.userId, { attributes: ['eid', 'name'] });

    try {
        const tablesData = req.body;
        if (!tablesData || typeof tablesData !== 'object') {
            return fail(res, new CustomError('请求体必须是一个对象，键为表名，值为记录数组'));
        }

        const userId = req.userId;
        const results = {};

        for (const [tableName, records] of Object.entries(tablesData)) {
            if (!Array.isArray(records)) {
                results[tableName] = { error: 'records 不是数组' };
                overallResult = 'partial';
                continue;
            }
            totalRecords += records.length;
            const Model = modelMap[tableName];
            if (!Model) {
                results[tableName] = { error: `未知的表名: ${tableName}` };
                overallResult = 'partial';
                continue;
            }

            const tableResults = [];
            for (const clientRecord of records) {
                if (clientRecord.userId !== userId) {
                    tableResults.push({ clientId: clientRecord.clientId, status: 'rejected', reason: 'userId mismatch' });
                    continue;
                }
                if (!clientRecord.clientId) {
                    tableResults.push({ clientId: clientRecord.clientId || 'unknown', status: 'failed', reason: 'missing clientId' });
                    continue;
                }
                const existing = await Model.findOne({ where: { clientId: clientRecord.clientId } });
                if (!existing) {
                    await Model.create(clientRecord);
                    tableResults.push({ clientId: clientRecord.clientId, status: 'created' });
                } else if (isClientWinner(clientRecord, existing)) {
                    await existing.update(clientRecord);
                    tableResults.push({ clientId: clientRecord.clientId, status: 'updated', conflictNote: '用户端胜出' });
                } else {
                    tableResults.push({ clientId: clientRecord.clientId, status: 'ignored', conflictNote: '服务端胜出' });
                }
            }
            results[tableName] = tableResults;
            const hasFail = tableResults.some(r => r.status === 'failed' || r.status === 'rejected');
            if (hasFail) overallResult = 'partial';
        }

        success(res, '多表同步完成', { overallResult, results });
    } catch (err) {
        console.error('多表同步接口错误:', err);
        overallResult = 'failed';
        syncError = err.message;
        fail(res, err);
    } finally {
        if (user) {
            SyncRecord.create({
                userId: req.userId,
                userName: user.name,
                userEid: user.eid,
                tableName: 'batch',
                recordCount: totalRecords,
                syncResult: overallResult === 'success' ? 'success' : 'partial',
                errorMessage: syncError,
                clientIp: clientIp,
                startedAt: startTime,
                completedAt: new Date()
            }).catch(err => console.error('同步日志写入失败:', err));
        }
    }
});

router.post('/:tableName', authToken, async (req, res) => {
    const startTime = new Date();
    const clientIp = getClientIp(req);
    const user = await User.findByPk(req.userId, {
        attributes: ['id', 'eid', 'name']
    });
    let syncError = null;
    let syncResult = 'success';
    const tableName = req.params.tableName;

    try {
        const clientRecord = req.body;
        const Model = modelMap[tableName];
        if (!Model) {
            syncResult = 'failed';
            syncError = `未知的表名: ${tableName}`;
            return fail(res, new CustomError(syncError));
        }

        const userId = req.userId;
        if (clientRecord.userId !== userId) {
            syncResult = 'failed';
            syncError = 'userId 不匹配';
            return fail(res, new CustomError(syncError, 403));
        }
        if (!clientRecord.clientId) {
            syncResult = 'failed';
            syncError = '缺少 clientId';
            return fail(res, new CustomError(syncError, 400));
        }

        const existing = await Model.findOne({ where: { clientId: clientRecord.clientId } });
        let result;
        if (!existing) {
            await Model.create(clientRecord);
            result = { clientId: clientRecord.clientId, status: 'created' };
        } else if (isClientWinner(clientRecord, existing)) {
            await existing.update(clientRecord);
            result = { clientId: clientRecord.clientId, status: 'updated', conflictNote: '用户端胜出' };
        } else {
            result = { clientId: clientRecord.clientId, status: 'ignored', conflictNote: '服务端胜出' };
            syncResult = 'partial';
        }
        success(res, '单条同步完成', { result });
    } catch (err) {
        console.error('单条同步接口错误:', err);
        syncResult = 'failed';
        syncError = err.message;
        fail(res, err);
    } finally {
        SyncRecord.create({
            userId: req.userId,
            userName: user.name,
            userEid: user.eid,
            clientId: req.userId || 'unknown',
            tableName: tableName,
            recordCount: 1,
            syncVersion: 1,
            syncResult: syncResult,
            errorMessage: syncError,
            clientIp: clientIp,
            startedAt: startTime,
            completedAt: new Date()
        }).catch(err => console.error('同步日志写入失败:', err));
    }
});

router.get('/all', authToken, async (req, res) => {
    try {
        const { since = 0 } = req.query;
        const userId = req.userId;
        const sinceTs = parseInt(since);

        // 定义要拉取的表（key：返回给前端使用的名称，value：对应的Model）
        const tables = [
            { name: 'constructionLog', model: ConstructionLog },
            { name: 'equipmentLog', model: EquipmentLog },
            { name: 'qualityAcceptance', model: QualityAcceptance },
            { name: 'safetyHazard', model: SafetyHazard },
            { name: 'materialAcceptance', model: MaterialAcceptance },
            { name: 'inspectionRecord', model: InspectionRecord }
        ];

        const result = {};

        for (const { name, model } of tables) {
            const where = { userId, isDeleted: false };
            if (sinceTs > 0) {
                where.localUpdatedAt = { [Op.gt]: sinceTs };
            }
            const records = await model.findAll({
                where,
                order: [['localUpdatedAt', 'ASC']]
            });
            result[name] = records;
        }

        success(res, '批量拉取成功', result);
    } catch (err) {
        console.error('批量拉取接口错误:', err);
        fail(res, err);
    }
});

router.get('/:tableName', authToken, async (req, res) => {
    try {
        const { tableName } = req.params;
        const { since = 0, limit = 500 } = req.query;

        const Model = modelMap[tableName];
        if (!Model) return fail(res, new CustomError(`未知的表名: ${tableName}`));

        const userId = req.userId;
        const where = { userId, isDeleted: false };
        const sinceTs = parseInt(since);
        if (sinceTs > 0) {
            where.localUpdatedAt = { [Op.gt]: sinceTs };
        }

        const records = await Model.findAll({
            where,
            order: [['localUpdatedAt', 'ASC']],
            limit: parseInt(limit)
        });
        success(res, '拉取成功', records);
    } catch (err) {
        console.error('拉取列表接口错误:', err);
        fail(res, err);
    }
});

router.get('/:tableName/:clientId', authToken, async (req, res) => {
    try {
        const { tableName, clientId } = req.params;
        const Model = modelMap[tableName];
        if (!Model) return fail(res, new CustomError(`未知的表名: ${tableName}`));

        const userId = req.userId;
        const record = await Model.findOne({
            where: { clientId, userId, isDeleted: false }
        });
        if (!record) return fail(res, new CustomError('记录不存在或无权限', 404));
        success(res, '拉取成功', record);
    } catch (err) {
        console.error('拉取单条接口错误:', err);
        fail(res, err);
    }
});
module.exports = router;