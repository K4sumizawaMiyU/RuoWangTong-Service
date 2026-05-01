const express = require('express');

require('dotenv').config();

const cor = require('cors');

const jwt = require('jsonwebtoken');

const redisClient = require('./config/redis.js');

const app = express();

app.use(cor());

app.use(express.json());

app.use('/api', require('./routers/users.js'));

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});