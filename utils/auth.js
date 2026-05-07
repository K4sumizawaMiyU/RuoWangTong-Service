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

const resetPwdToken = (req, res, next) => {
    const { resetPwdToken } = req.body;
    if (!resetPwdToken) {
        return fail(res, new CustomError("缺少重置令牌", 401));
    }
    try {
        const decoded = jwt.verify(resetPwdToken, process.env.JWT_RESET_SECRET);
        if (decoded.purpose !== 'reset_password') {
            return fail(res, new CustomError("无效的重置令牌", 401));
        }
        req.phone = decoded.phone;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return fail(res, new CustomError("重置令牌已过期，请重新获取验证码", 401));
        }
        return fail(res, new CustomError("无效的重置令牌", 401));
    }
};

module.exports = { authToken, resetPwdToken };