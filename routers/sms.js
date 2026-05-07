const express = require('express');
const router = express.Router();
const redisClient = require('../config/redis.js');
const { generateToken, resetToken } = require('../utils/jwt.js');

const { CustomError, success, fail } = require('../utils/response.js');
const { sendVerificationCode, verifyCode } = require('../utils/SmsService.js');
const { sign } = require('jsonwebtoken');

//发送验证码接口
router.post('/sendSms', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone || !/^\d{11}$/.test(phone)) {
            fail(res, new CustomError("请输入有效的11位手机号"));
            return;
        }
        const result = await sendVerificationCode(phone);
        if (result.success) {
            success(res, result.message);
        } else {
            fail(res, new CustomError(result.message));
        }
    } catch (err) {
        console.error('发送验证码接口错误:', err);
        fail(res, new CustomError('发送验证码失败，请稍后再试'));
    }
});
//验证验证码接口
router.post('/verifyCode', async (req, res) => {
    try {
        const { phone, code } = req.body;
        if (!phone || !/^\d{11}$/.test(phone)) {
            fail(res, new CustomError("请输入有效的11位手机号"));
            return;
        }
        if (!code || !/^\d{6}$/.test(code)) {
            fail(res, new CustomError("请输入有效的6位验证码"));
            return;
        }
        const result = await verifyCode(phone, code);
        if (result.success) {

            const token = resetToken(phone);

            const responseData = {
                resetToken: token
            };

            success(res, result.message, responseData);
        } else {
            fail(res, new CustomError(result.message));
        }
    } catch (err) {
        console.error('验证验证码接口错误:', err);
        fail(res, new CustomError('验证码验证失败，请稍后再试'));
    }
});
module.exports = router;