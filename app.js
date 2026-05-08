const express = require('express');

require('dotenv').config();

const cor = require('cors');

const jwt = require('jsonwebtoken');

const redisClient = require('./config/redis.js');

const initDB = require('./config/dbInit.js');

const path = require('path');

const uploadRouter = require('./routers/img_upload.js');

const app = express();

const syncLogRouter = require('./routers/sync_log');
const changeLogRoutes = require('./routers/change_log');
const syncRouter = require('./routers/sync.js')

app.use(cor());

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/change-logs', changeLogRoutes);
app.use('/api', require('./routers/users.js'));
app.use('/api', require('./routers/sms.js'));
app.use('/api', require('./routers/img_upload.js'))
app.use('/api/sync-log', syncLogRouter);
app.use('/api/sync', syncLogRouter)
const PORT = 3000;

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`服务在 ${PORT} 端口上成功运行。`);
    });
}).catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
});


