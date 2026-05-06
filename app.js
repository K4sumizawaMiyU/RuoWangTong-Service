const express = require('express');

require('dotenv').config();

const cor = require('cors');

const jwt = require('jsonwebtoken');

const redisClient = require('./config/redis.js');

const initDB = require('./config/dbInit.js');

const path = require('path');

const uploadRouter = require('./routers/img_upload.js');

const app = express();

const constructionLogRouter = require('./routers/construction_log');
const equipmentLogRouter = require('./routers/equipment_log');
const inspectionRecordRouter = require('./routers/inspection_record');
const materialAcceptanceRouter = require('./routers/material_acceptance');
const qualityAcceptanceRouter = require('./routers/quality_acceptance');
const safetyHazardRouter = require('./routers/safety_hazard');
const syncLogRouter = require('./routers/sync_log');


app.use(cor());

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', require('./routers/users.js'));
app.use('/api', require('./routers/sms.js'));
app.use('/api', require('./routers/img_upload.js'))
app.use('/api/construction-log', constructionLogRouter);
app.use('/api/equipment-log', equipmentLogRouter);
app.use('/api/inspection', inspectionRecordRouter);
app.use('/api/material-acceptance', materialAcceptanceRouter);
app.use('/api/quality-acceptance', qualityAcceptanceRouter);
app.use('/api/safety-hazard', safetyHazardRouter);
app.use('/api/sync-log', syncLogRouter);
const PORT = 3000;

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`服务在 ${PORT} 端口上成功运行。`);
    });
}).catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
});


