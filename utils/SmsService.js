const smsClient = require('../config/SmsClient');
const Dyplsapi = require('@alicloud/dypnsapi20170525');
const redisClient = require('../config/redis.js');
const { CustomError, success, fail } = require('./response.js');

require('dotenv').config();

//验证码发送服务
async function sendVerificationCode(phoneNum) {
    console.log('发送验证码请求:', phoneNum);
    try {
        const request = new Dyplsapi.SendSmsVerifyCodeRequest({
            signName: process.env.ALIYUN_SMS_SIGN_NAME,
            templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
            templateParam: '{"code":"##code##","min":5}',
            phoneNumber: phoneNum,
            returnVerifyCode: true,
            codeLength: 6
        });
        const response = await smsClient.sendSmsVerifyCode(request);
        if (response.body.code === 'OK') {
            console.log(JSON.stringify(response.body));
            const code = response.body.model.verifyCode;
            console.log('生成的验证码:', code);
            const key = `sms:session:${phoneNum}`;
            await redisClient.set(key, code, 'EX', 300);
            return { success: true, message: '验证码发送成功' };
        } else {
            return { success: false, message: `验证码发送失败: ${response.body.message}` };
        }
    } catch (err) {
        console.error('发送验证码失败:', err);
        return { success: false, message: '发送验证码失败，请稍后再试' };
    }
}
async function verifyCode(phoneNum, code) {
    try {
        const key = `sms:session:${phoneNum}`;
        const storedCode = await redisClient.get(key);
        if (storedCode === code) {
            await redisClient.del(key);
            return { success: true, message: '验证码验证成功' };
        } else {
            return { success: false, message: '验证码验证失败' };
        }
    } catch (err) {
        console.error('验证码验证失败:', err);
        return { success: false, message: '验证码验证失败，请稍后再试' };
    }
}
module.exports = {
    sendVerificationCode,
    verifyCode
};