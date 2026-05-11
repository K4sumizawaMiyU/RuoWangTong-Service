const ChangeLog = require('../models/change_log');
const User = require('../models/user');

const fieldsToLogMap = {
    material_acceptances: [
        'materialName', 'specification', 'quantity', 'unit',
        'supplierName', 'certificateNumber', 'inspectorName', 'acceptanceTime'
    ],
    construction_logs: [
        'teamName', 'recorderName', 'workContent', 'equipmentUsage',
        'materialUsage', 'weather', 'abnormalSituation'
    ],
    inspection_records: [
        'inspectorName', 'inspectionArea', 'inspectionItem',
        'inspectionResult', 'problemDescription'
    ],
    safety_hazards: [
        'hazardDescription', 'hazardPhotos', 'riskLevel',
        'responsiblePerson', 'rectificationStatus', 'rectificationPhotos'
    ],
    equipment_logs: [
        'equipmentId', 'equipmentName', 'operationHours',
        'fuelConsumption', 'failureRecord', 'operatorName'
    ],
    quality_acceptances: [
        'location', 'standardCode', 'measuredData', 'acceptanceResult',
        'supervisorName', 'contractorName', 'electronicSignature'
    ]
};


async function getUserInfo(userId) {
    if (!userId) return null;
    const user = await User.findByPk(userId, { attributes: ['id', 'name', 'eid'] });
    return user ? { operatorId: user.id, operatorName: user.name, operatorEid: user.eid } : null;
}

function addLoggingHooks(Model, tableName) {
    const fieldsToLog = fieldsToLogMap[tableName];
    if (!fieldsToLog) {
        console.warn(`[ChangeLog] 未配置表 ${tableName} 的日志字段，跳过钩子`);
        return;
    }

    // 创建钩子
    Model.addHook('afterCreate', async (instance, options) => {
        try {
            const userId = instance.userId;
            if (!userId) {
                console.warn(`[ChangeLog] 缺少 userId，表 ${tableName}, clientId ${instance.clientId}`);
                return;
            }
            const userInfo = await getUserInfo(userId);
            if (!userInfo) {
                console.warn(`[ChangeLog] 未找到用户信息，userId ${userId}`);
                return;
            }
            await ChangeLog.create({
                tableName,
                recordId: instance.clientId,
                fieldName: '__create__',
                oldValue: null,
                newValue: 'created',
                operatorId: userInfo.operatorId,
                operatorName: userInfo.operatorName,
                operatorEid: userInfo.operatorEid,
                createdAt: new Date()
            });
        } catch (err) {
            console.error(`[ChangeLog] 创建日志异常 (表 ${tableName}):`, err);
        }
    });

    // 更新钩子
    Model.addHook('afterUpdate', async (instance, options) => {
        try {
            const changedFields = instance.changed();
            if (!changedFields || changedFields.length === 0) return;

            const userId = instance.userId;
            if (!userId) {
                console.warn(`[ChangeLog] 缺少 userId，表 ${tableName}, clientId ${instance.clientId}`);
                return;
            }
            const userInfo = await getUserInfo(userId);
            if (!userInfo) {
                console.warn(`[ChangeLog] 未找到用户信息，userId ${userId}`);
                return;
            }

            // 软删除检测
            if (changedFields.includes('isDeleted')) {
                const oldDeleted = instance.previous('isDeleted');
                const newDeleted = instance.get('isDeleted');
                if (oldDeleted === false && newDeleted === true) {
                    await ChangeLog.create({
                        tableName,
                        recordId: instance.clientId,
                        fieldName: '__soft_delete__',
                        oldValue: 'false',
                        newValue: 'true',
                        operatorId: userInfo.operatorId,
                        operatorName: userInfo.operatorName,
                        operatorEid: userInfo.operatorEid,
                        createdAt: new Date()
                    });
                }
            }

            // 业务字段变更
            const targetFields = changedFields.filter(field => fieldsToLog.includes(field));
            if (targetFields.length === 0) return;

            const logEntries = [];
            for (const field of targetFields) {
                const oldValue = instance.previous(field);
                const newValue = instance.get(field);
                const oldStr = (oldValue === null || oldValue === undefined) ? '' : JSON.stringify(oldValue);
                const newStr = (newValue === null || newValue === undefined) ? '' : JSON.stringify(newValue);
                if (oldStr !== newStr) {
                    logEntries.push({
                        tableName,
                        recordId: instance.clientId,
                        fieldName: field,
                        oldValue: oldStr,
                        newValue: newStr,
                        operatorId: userInfo.operatorId,
                        operatorName: userInfo.operatorName,
                        operatorEid: userInfo.operatorEid,
                        createdAt: new Date()
                    });
                }
            }

            if (logEntries.length) {
                await ChangeLog.bulkCreate(logEntries);
            }
        } catch (err) {
            console.error(`[ChangeLog] 更新日志写入失败 (表 ${tableName}):`, err);
        }
    });
}

module.exports = addLoggingHooks;