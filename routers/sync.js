const express = require('express');
const router = express.Router();
const { syncData, forceOverwrite } = require('../utils/syncService');

/**
 * 同步接口
 * POST /api/sync
 * Body: { constructionLogs, equipmentLogs, ... , deletedIds }
 * Headers: Authorization: Bearer <token> (中间件会解析出 req.user)
 */
router.post('/', async (req, res, next) => {
    try {
        // 假设认证中间件已将用户信息挂载到 req.user，包含 id 字段
        const operatorId = req.user.id;
        const payload = req.body;

        const result = await syncData(payload, operatorId);

        // 根据结果返回不同状态码
        if (result.success) {
            res.status(200).json({ code: 0, data: result });
        } else if (result.code === 'CONFLICT') {
            res.status(409).json({ code: 409, message: result.message, conflicts: result.conflicts });
        } else {
            res.status(500).json({ code: -1, message: result.message });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * 强制覆盖接口
 * POST /api/sync/overwrite
 * Body: { tableName, recordId, clientData }
 */
router.post('/overwrite', async (req, res, next) => {
    try {
        const operatorId = req.user.id;
        const { tableName, recordId, clientData } = req.body;

        if (!tableName || !recordId || !clientData) {
            return res.status(400).json({ code: 400, message: '缺少必要参数: tableName, recordId, clientData' });
        }

        const result = await forceOverwrite(tableName, recordId, clientData, operatorId);
        res.status(200).json({ code: 0, data: result });
    } catch (error) {
        // 区分业务错误和系统错误
        if (error.message === '记录不存在' || error.message.includes('未找到模型')) {
            res.status(404).json({ code: 404, message: error.message });
        } else {
            next(error);
        }
    }
});

module.exports = router;