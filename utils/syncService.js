const sequelize = require('../database/db');
const ConstructionLog = require('../models/construction_log');
const EquipmentLog = require('../models/equipment_log');
const InspectionRecord = require('../models/inspection_record');
const MaterialAcceptance = require('../models/material_acceptance');
const QualityAcceptance = require('../models/quality_acceptance');
const ChangeLog = require('../models/change_log');
const SafetyHazard = require('../models/safety_hazard');
const SyncLog = require('../models/sync_log');
const { buildCreateLog, buildUpdateLog, buildDeleteLog } = require('./syncUtils.js');

// 辅助函数：计算 payload 中所有表格的记录总数
function countTotalRecords(payload) {
    let total = 0;
    const tables = ['constructionLogs', 'equipmentLogs', 'inspectionRecords',
        'materialAcceptances', 'qualityAcceptances', 'safetyHazards'];
    for (const table of tables) {
        if (Array.isArray(payload[table])) total += payload[table].length;
    }
    if (payload.deletedIds) {
        for (const key in payload.deletedIds) {
            if (Array.isArray(payload.deletedIds[key])) total += payload.deletedIds[key].length;
        }
    }
    return total;
}

/**
 * 根据模型名称获取模型对象
 */
function getModelByName(name) {
    const models = {
        ConstructionLog,
        EquipmentLog,
        InspectionRecord,
        MaterialAcceptance,
        QualityAcceptance,
        SafetyHazard
    };
    const model = models[name];
    if (!model) throw new Error(`未找到模型: ${name}`);
    return model;
}

/**
 * 处理单张表的批量 upsert（带乐观锁冲突检测）
 */
// 辅助函数：安全地将客户端时间戳转为 Date 对象
function parseClientUpdatedAt(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
}

async function processTableUpsert(model, items, operatorId, transaction, changeLogsArr, conflictsArr) {
    if (!items || items.length === 0) return;

    for (const item of items) {
        // 1. 没有 id 的记录视为新增（不冲突，直接创建）
        if (!item.id) {
            const newRecord = await model.create(item, { transaction, user: { id: operatorId } });
            changeLogsArr.push(buildCreateLog(model.name, newRecord.id, newRecord.toJSON(), operatorId));
            continue;
        }

        // 2. 有 id：查询当前数据库记录（包含软删除的）
        const currentRecord = await model.findByPk(item.id, { transaction, paranoid: false });

        // 2.1 记录不存在 => 视为新增
        if (!currentRecord) {
            const newRecord = await model.create(item, { transaction, user: { id: operatorId } });
            changeLogsArr.push(buildCreateLog(model.name, newRecord.id, newRecord.toJSON(), operatorId));
            continue;
        }

        // 2.2 记录存在：基于 updatedAt 时间戳进行冲突检测
        const clientUpdatedAt = parseClientUpdatedAt(item.updatedAt);
        const serverUpdatedAt = currentRecord.updatedAt; // Sequelize 自动维护的时间戳

        // 客户端未提供 updatedAt → 降级处理（直接更新，不推荐）
        if (!clientUpdatedAt) {
            console.warn(`记录 ${item.id} 未提供 updatedAt，跳过冲突检测直接更新`);
            const oldData = currentRecord.toJSON();
            // 注意：这里 updatedAt 会被 Sequelize 自动更新为当前时间
            await currentRecord.update(item, { transaction, user: { id: operatorId } });
            const newData = (await model.findByPk(item.id, { transaction, paranoid: false })).toJSON();
            changeLogsArr.push(buildUpdateLog(model.name, item.id, oldData, newData, operatorId));
            continue;
        }

        // 时间戳比较：客户端时间戳 严格大于 服务端时间戳 → 允许更新
        // 若小于或等于，视为冲突（表示客户端数据已过期）
        if (clientUpdatedAt > serverUpdatedAt) {
            // 允许更新，Sequelize 会自动将 updatedAt 设为当前数据库时间
            const oldData = currentRecord.toJSON();
            await currentRecord.update(item, { transaction, user: { id: operatorId } });
            const newData = (await model.findByPk(item.id, { transaction, paranoid: false })).toJSON();
            changeLogsArr.push(buildUpdateLog(model.name, item.id, oldData, newData, operatorId));
        } else {
            // 冲突：客户端时间戳 <= 服务端时间戳，说明数据已被他人更新
            conflictsArr.push({
                table: model.name,
                recordId: item.id,
                clientUpdatedAt: clientUpdatedAt.toISOString(),
                serverUpdatedAt: serverUpdatedAt.toISOString(),
                serverData: currentRecord.toJSON(),
                clientData: item
            });
        }
    }
}

// 删除处理（保持原样）
async function processTableDeletes(model, ids, hardDelete, operatorId, transaction, changeLogsArr) {
    if (!ids || ids.length === 0) return;
    for (const id of ids) {
        const record = await model.findByPk(id, { transaction, paranoid: false });
        if (!record) continue;
        const oldData = record.toJSON();
        if (hardDelete) {
            await record.destroy({ transaction, force: true, user: { id: operatorId } });
        } else {
            await record.destroy({ transaction, user: { id: operatorId } });
        }
        changeLogsArr.push(buildDeleteLog(model.name, id, oldData, operatorId));
    }
}

/**
 * 主同步入口（增加 clientId, clientIp 用于日志）
 */
async function syncData(payload, operatorId, clientId, clientIp) {
    const startedAt = new Date();
    let syncLog = null;
    const totalRecords = countTotalRecords(payload);

    // 立即创建一条同步日志（状态 partial，避免因后续异常而丢失日志）
    try {
        syncLog = await SyncLog.create({
            clientId,
            tableName: 'multiple',   // 可改为涉及的所有表名，为简化统一用 'multiple'
            recordCount: totalRecords,
            syncVersion: payload.syncVersion || 1,
            syncResult: 'partial',
            clientIp,
            startedAt
        });
    } catch (err) {
        console.error('创建同步日志失败', err);
        // 日志失败不应阻断业务，但会影响审计，可以继续
    }

    const transaction = await sequelize.transaction();
    const allChangeLogs = [];
    const allConflicts = [];

    try {
        // 处理各表 upsert（省略重复代码，同原版）
        if (payload.constructionLogs) {
            await processTableUpsert(ConstructionLog, payload.constructionLogs, operatorId, transaction, allChangeLogs, allConflicts);
        }
        if (payload.equipmentLogs) {
            await processTableUpsert(EquipmentLog, payload.equipmentLogs, operatorId, transaction, allChangeLogs, allConflicts);
        }
        if (payload.inspectionRecords) {
            await processTableUpsert(InspectionRecord, payload.inspectionRecords, operatorId, transaction, allChangeLogs, allConflicts);
        }
        if (payload.materialAcceptances) {
            await processTableUpsert(MaterialAcceptance, payload.materialAcceptances, operatorId, transaction, allChangeLogs, allConflicts);
        }
        if (payload.qualityAcceptances) {
            await processTableUpsert(QualityAcceptance, payload.qualityAcceptances, operatorId, transaction, allChangeLogs, allConflicts);
        }
        if (payload.safetyHazards) {
            await processTableUpsert(SafetyHazard, payload.safetyHazards, operatorId, transaction, allChangeLogs, allConflicts);
        }

        // 处理删除
        if (payload.deletedIds) {
            const { ConstructionLog: cnIds, EquipmentLog: eqIds, InspectionRecord: insIds,
                MaterialAcceptance: matIds, QualityAcceptance: quaIds, SafetyHazard: safIds } = payload.deletedIds;
            if (cnIds) await processTableDeletes(ConstructionLog, cnIds, false, operatorId, transaction, allChangeLogs);
            if (eqIds) await processTableDeletes(EquipmentLog, eqIds, false, operatorId, transaction, allChangeLogs);
            if (insIds) await processTableDeletes(InspectionRecord, insIds, false, operatorId, transaction, allChangeLogs);
            if (matIds) await processTableDeletes(MaterialAcceptance, matIds, false, operatorId, transaction, allChangeLogs);
            if (quaIds) await processTableDeletes(QualityAcceptance, quaIds, false, operatorId, transaction, allChangeLogs);
            if (safIds) await processTableDeletes(SafetyHazard, safIds, false, operatorId, transaction, allChangeLogs);
        }

        if (allConflicts.length > 0) {
            await transaction.rollback();
            // 更新同步日志为失败
            if (syncLog) {
                await syncLog.update({
                    syncResult: 'failed',
                    errorMessage: `存在 ${allConflicts.length} 条冲突`,
                    completedAt: new Date()
                });
            }
            return {
                success: false,
                code: 'CONFLICT',
                conflicts: allConflicts,
                message: '部分数据存在版本冲突，请解决后重新提交'
            };
        }

        // 无冲突，提交业务数据
        if (allChangeLogs.length > 0) {
            await ChangeLog.bulkCreate(allChangeLogs, { transaction });
        }
        await transaction.commit();

        // 更新同步日志为成功
        if (syncLog) {
            await syncLog.update({
                syncResult: 'success',
                completedAt: new Date()
            });
        }
        return { success: true, message: `同步成功，共处理 ${allChangeLogs.length} 条变更记录` };
    } catch (error) {
        await transaction.rollback();
        console.error('同步失败', error);
        if (syncLog) {
            await syncLog.update({
                syncResult: 'failed',
                errorMessage: error.message,
                completedAt: new Date()
            });
        }
        throw new Error(`同步失败: ${error.message}`);
    }
}

/**
 * 强制覆盖冲突记录（保持不变）
 */
async function forceOverwrite(tableName, recordId, clientData, operatorId) {
    const transaction = await sequelize.transaction();
    try {
        const model = getModelByName(tableName);
        const record = await model.findByPk(recordId, { transaction, paranoid: false });
        if (!record) throw new Error('记录不存在');

        // 强制覆盖时，直接使用客户端数据，不比较时间戳
        // 注意：updatedAt 会被 Sequelize 自动更新为当前时间
        const oldData = record.toJSON();
        await record.update(clientData, { transaction, user: { id: operatorId } });
        const newData = (await model.findByPk(recordId, { transaction, paranoid: false })).toJSON();

        const changeLog = buildUpdateLog(tableName, recordId, oldData, newData, operatorId);
        await ChangeLog.create(changeLog, { transaction });
        await transaction.commit();
        return { success: true, message: '覆盖成功' };
    } catch (err) {
        await transaction.rollback();
        console.error('强制覆盖失败', err);
        throw new Error(`强制覆盖失败: ${err.message}`);
    }
}

module.exports = { syncData, forceOverwrite };