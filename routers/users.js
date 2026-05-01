const express = require('express');
const router = express.Router();
const redisClient = require('../config/redis.js');
const User = require('../models/user.js');
const Profile = require('../models/profile.js');

const { Op } = require('sequelize');
const { CustomError, success, fail } = require('../utils/response.js');
const { generateToken } = require('../utils/jwt.js');
const { authToken } = require('../utils/auth.js');

router.post('/login', async (req, res) => {
    try {
        const { eid, password } = req.body;
        const user = await User.findOne({
            where: {
                eid: eid,
                password: password
            }
        });
        if (!user) {
            fail(res, new CustomError("账号或密码错误"));
            return;
        }
        const token = generateToken(user);
        await redisClient.set(`token:${user.id}`, token, 'EX', 7 * 24 * 60 * 60);
        const result = { token: token };
        success(res, "登录成功", result);
    } catch (err) {
        fail(res, err);
    }
});

router.post('/logout', authToken, async (req, res) => {
    try {
        const userId = req.userId;
        const deleted = await redisClient.del(`token:${userId}`);
        if (deleted === 0) {
            // 已登出或 token 不存在，仍然返回成功，但提示信息不同
            return success(res, "您已经登出，无需重复操作");
        }
        success(res, "退出登录成功");
    } catch (err) {
        fail(res, err);
    }
});

module.exports = router;