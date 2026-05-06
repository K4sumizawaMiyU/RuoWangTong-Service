const redisClient = require('../config/redis.js');
const jwt = require('jsonwebtoken');

const authToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided or invalid format' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const storedToken = await redisClient.get(`token:${decoded.id}`);
        if (storedToken !== token) {
            return res.status(401).json({ message: '无效的token' });
        }
        req.userId = decoded.id;
        next();
    } catch (err) {
        console.error('Auth error:', err.message);
        return res.status(401).json({ message: '无效的token' });
    }
};

const resetPwdToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided or invalid format' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);
        if (decoded.purpose !== 'reset_password') {
            return res.status(401).json({ message: 'Invalid token purpose' });
        }
        req.phone = decoded.phone;
        next();
    } catch (err) {
        console.error('Reset password token error:', err.message);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports = { authToken, resetPwdToken };