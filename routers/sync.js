const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { authToken } = require('../utils/auth');
const { success, fail, CustomError } = require('../utils/response');
const SyncRecord = require('../models/sync_record');
const User = require('../models/user');
const Project = require('../models/projects');
const ProjectInspector = require('../models/project_inspectors');

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

function sanitizeRecordByRole(record, userRole, userId) {
    const allowedFields = { ...record };
    if (userRole !== '检查员' && userRole !== '主管') {
        delete allowedFields.reviewStatus;
        delete allowedFields.reviewerId;
        delete allowedFields.reviewTime;
        delete allowedFields.reviewComment;
    } else if (userRole === '检查员') {
        allowedFields.reviewerId = userId;
        allowedFields.reviewTime = new Date();
    }
    return allowedFields;
}

async function getAccessibleProjectIds(userId, role) {
    if (role === '主管') {
        const projects = await Project.findAll({
            where: { supervisor_id: userId, isDeleted: false },
            attributes: ['id']
        });
        return projects.map(p => p.id);
    } else if (role === '检查员') {
        const assignments = await ProjectInspector.findAll({
            where: { inspectorId: userId },
            attributes: ['projectId']
        });
        return assignments.map(a => a.projectId);
    }
    return [];
}

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
        const currentUser = await User.findByPk(userId, { attributes: ['role'] });
        const userRole = currentUser.role;
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
                // 权限校验：如果是安全隐患表且当前用户是整改责任人，则允许绕过 userId 校验
                const isSafetyHazardWithResponsible = (tableName === 'safetyHazard' && clientRecord.responsiblePerson === user.eid);
                if (clientRecord.userId !== userId && !isSafetyHazardWithResponsible) {
                    tableResults.push({ clientId: clientRecord.clientId, status: 'rejected', reason: 'userId mismatch' });
                    continue;
                }
                if (!clientRecord.clientId) {
                    tableResults.push({ clientId: clientRecord.clientId || 'unknown', status: 'failed', reason: 'missing clientId' });
                    continue;
                }
                const cleanedRecord = sanitizeRecordByRole(clientRecord, userRole, userId);
                const existing = await Model.findOne({ where: { clientId: cleanedRecord.clientId } });
                //冲突检测与时间戳决定冲突解决
                if (!existing) {
                    if (userRole === '工人' && !cleanedRecord.reviewStatus) {
                        cleanedRecord.reviewStatus = 'pending';
                    }
                    await Model.create(cleanedRecord);
                    tableResults.push({ clientId: cleanedRecord.clientId, status: 'created' });
                } else if (isClientWinner(cleanedRecord, existing)) {
                    await existing.update(cleanedRecord);
                    tableResults.push({ clientId: cleanedRecord.clientId, status: 'updated', conflictNote: '用户端胜出' });
                } else {
                    tableResults.push({ clientId: cleanedRecord.clientId, status: 'ignored', conflictNote: '服务端胜出' });
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
        attributes: ['id', 'eid', 'name', 'role']
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

        const cleanedRecord = sanitizeRecordByRole(clientRecord, user.role, userId);
        const existing = await Model.findOne({ where: { clientId: cleanedRecord.clientId } });
        let result;
        if (!existing) {
            if (user.role === '工人' && !cleanedRecord.reviewStatus) {
                cleanedRecord.reviewStatus = 'pending';
            }
            await Model.create(cleanedRecord);
            result = { clientId: cleanedRecord.clientId, status: 'created' };
        } else if (isClientWinner(cleanedRecord, existing)) {
            await existing.update(cleanedRecord);
            result = { clientId: cleanedRecord.clientId, status: 'updated', conflictNote: '用户端胜出' };
        } else {
            result = { clientId: cleanedRecord.clientId, status: 'ignored', conflictNote: '服务端胜出' };
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

        const user = await User.findByPk(userId, { attributes: ['id', 'role', 'eid'] });
        if (!user) return fail(res, new CustomError('用户不存在'));

        const tables = [
            { name: 'constructionLog', model: ConstructionLog },
            { name: 'equipmentLog', model: EquipmentLog },
            { name: 'qualityAcceptance', model: QualityAcceptance },
            { name: 'safetyHazard', model: SafetyHazard },
            { name: 'materialAcceptance', model: MaterialAcceptance },
            { name: 'inspectionRecord', model: InspectionRecord }
        ];

        let accessibleProjectIds = [];
        if (user.role === '主管' || user.role === '检查员') {
            accessibleProjectIds = await getAccessibleProjectIds(userId, user.role);
        }

        const result = {};

        for (const { name, model } of tables) {
            let where = { isDeleted: false };
            if (sinceTs > 0) {
                where.localUpdatedAt = { [Op.gt]: sinceTs };
            }

            if (user.role === '工人') {
                if (name === 'safetyHazard') {
                    where[Op.or] = [
                        { userId: userId },
                        { responsiblePerson: user.eid }
                    ];
                } else {
                    where.userId = userId;
                }
            } else if (user.role === '主管' || user.role === '检查员') {
                if (accessibleProjectIds.length === 0) {
                    result[name] = [];
                    continue;
                }
                where.projectId = { [Op.in]: accessibleProjectIds };
            } else {
                result[name] = [];
                continue;
            }

            const records = await model.findAll({
                where,
                order: [['localUpdatedAt', 'ASC']]
            });
            result[name] = records;
        }

        if (user.role === '主管' || user.role === '检查员') {
            const projects = await Project.findAll({
                where: {
                    id: { [Op.in]: accessibleProjectIds },
                    isDeleted: false,
                    status: '进行中'   // 只返回进行中的项目
                },
                attributes: ['id', 'code', 'name', 'supervisor_id']
            });
            result.projects = projects;
        }

        if (user.role === '检查员') {
            result.projectInspectors = await ProjectInspector.findAll({
                where: { inspectorId: userId },
                attributes: ['id', 'projectId', 'inspectorId', 'assignedBy', 'assignedAt']
            });
        }

        success(res, '批量拉取成功', result);
    } catch (err) {
        console.error('批量拉取接口错误:', err);
        fail(res, err);
    }
});

// 单表拉取（支持角色感知，区分不同表）
router.get('/:tableName', authToken, async (req, res) => {
    try {
        const { tableName } = req.params;
        const { since = 0, limit = 500 } = req.query;
        const Model = modelMap[tableName];
        if (!Model) return fail(res, new CustomError(`未知的表名: ${tableName}`));

        const userId = req.userId;
        const user = await User.findByPk(userId, { attributes: ['role', 'eid'] });
        if (!user) return fail(res, new CustomError('用户不存在'));

        let where = { isDeleted: false };
        const sinceTs = parseInt(since);
        if (sinceTs > 0) {
            where.localUpdatedAt = { [Op.gt]: sinceTs };
        }

        if (user.role === '工人') {
            if (tableName === 'safetyHazard') {
                where[Op.or] = [
                    { userId: userId },
                    { responsiblePerson: user.eid }
                ];
            } else {
                where.userId = userId;
            }
        } else if (user.role === '主管' || user.role === '检查员') {
            let accessibleProjectIds = await getAccessibleProjectIds(userId, user.role);
            if (accessibleProjectIds.length === 0) {
                return success(res, '拉取成功', []);
            }
            where.projectId = { [Op.in]: accessibleProjectIds };
        } else {
            return success(res, '拉取成功', []);
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

// 拉取单条记录（仅限用户自己的）
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