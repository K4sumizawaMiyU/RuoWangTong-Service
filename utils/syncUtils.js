function buildCreateLog(tableName, recordId, newData, operatorEid) {
    return {
        tableName,
        recordId,
        fieldName: '*CREATE*',
        oldValue: null,
        newValue: JSON.stringify(newData),
        operatorId: operatorEid,
        createdAt: new Date()
    };
}

function buildUpdateLog(tableName, recordId, oldData, newData, operatorEid) {
    return {
        tableName,
        recordId,
        fieldName: '*UPDATE*',
        oldValue: JSON.stringify(oldData),
        newValue: JSON.stringify(newData),
        operatorId: operatorEid,
        createdAt: new Date()
    };
}

function buildDeleteLog(tableName, recordId, deletedData, operatorEid) {
    return {
        tableName,
        recordId,
        fieldName: '*DELETE*',
        oldValue: JSON.stringify(deletedData),
        newValue: null,
        operatorId: operatorEid,
        createdAt: new Date()
    };
}

module.exports = {
    buildCreateLog,
    buildUpdateLog,
    buildDeleteLog
};