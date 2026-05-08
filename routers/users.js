const express = require('express');
const router = express.Router();
const redisClient = require('../config/redis.js');
const User = require('../models/user.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { Op } = require('sequelize');
const { CustomError, success, fail } = require('../utils/response.js');
const { generateToken } = require('../utils/jwt.js');
const { authToken, resetPwdToken } = require('../utils/auth.js');
const bcrypt = require('bcryptjs/dist/bcrypt.js');

const uploadDir = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}



const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `${req.userId}${ext}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('只允许上传图片格式 (jpeg, png, jpg, gif, webp)'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: fileFilter
});


//用户注册/用户登录/密码更改/退出登录/用户资料查询接口

router.post('/register', async (req, res) => {
    try {
        const { eid, password, phone, name } = req.body;
        const existingUser = await User.findOne({
            where: {
                eid: eid,
            }
        });
        if (existingUser) {
            fail(res, new CustomError("该账号已被注册"));
            return;
        }
        if (phone.trim() === "") {
            fail(res, new CustomError("手机号不能为空"));
            return;
        }
        if (password.trim() === "") {
            fail(res, new CustomError("密码不能为空"));
            return;
        }
        if (eid.trim() === "") {
            fail(res, new CustomError("账号不能为空"));
            return;
        }
        if (name.trim() === "") {
            fail(res, new CustomError("姓名不能为空"));
            return;
        }
        if (!/^\d{11}$/.test(phone)) {
            fail(res, new CustomError("手机号必须为11位数字"));
            return;
        }
        const newUser = await User.create({
            eid: eid,
            password: password,
            phone: phone,
            name: name || null,
            createdAt: new Date(),
        });
        success(res, "注册成功");
    } catch (err) {
        fail(res, err);
    }
});

router.post('/login', async (req, res) => {
    try {
        const { eid, password } = req.body;
        const user = await User.findOne({
            where: {
                eid: eid,
            }
        });
        if (!user) {
            console.log(`登录失败：账号 ${eid} 不存在`);
            fail(res, new CustomError("账号或密码错误"));
            return;
        }
        const isValid = await user.validatePassword(password);
        if (!isValid) {
            console.log(
                `登录失败：账号 ${eid} 密码错误
                输入密码：${password}
                正确密码：${user.password}`
            );
            fail(res, new CustomError("账号或密码错误"));
            return;
        }
        user.lastLoginAt = new Date();
        await user.save();
        const token = generateToken(user);

        await redisClient.set(`token:${user.id}`, token, 'EX', 7 * 24 * 60 * 60);

        const result = {
            token: token
        };

        success(res, "登录成功", result);
        console.log(`${new Date()}_用户:${user.id} 登陆成功`);
    } catch (err) {
        fail(res, new CustomError("账号或密码错误"));
    }
});

router.put('/change-password', authToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { oldPassword, newPassword } = req.body;
        const user = await User.findByPk(userId);
        if (!user) {
            fail(res, new CustomError("用户不存在"));
            return;
        }
        if (!await user.validatePassword(oldPassword)) {
            fail(res, new CustomError("原密码错误"));
            return;
        }
        if (oldPassword === newPassword) {
            fail(res, new CustomError("新密码不能与原密码相同"));
            return;
        }
        if (newPassword.trim() === "") {
            fail(res, new CustomError("新密码不能为空"));
            return;
        }
        user.password = newPassword;
        user.updatedAt = new Date();
        await user.save();
        success(res, "密码修改成功");
        console.log(`${new Date()}_用户:${user.id} 修改了密码`);
        const deleted = await redisClient.del(`token:${userId}`);
    } catch (err) {
        fail(res, err);
    }
});

router.put('/account_found', resetPwdToken, async (req, res) => {
    try {
        const { newPwd } = req.body;
        const user = await User.findOne({
            where: {
                phone: req.phone,
            }
        });
        if (!user) {
            fail(res, new CustomError("该手机号未绑定账号"));
            return;
        }
        user.password = newPwd;
        user.updatedAt = new Date();
        await user.save();
        success(res, "密码修改成功", { eid: user.eid });
        console.log(`${new Date()}_用户:${user.eid} 通过手机号${req.phone} 找回了账号并修改了密码`);
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
        console.log(`${new Date()}_用户:${userId} 退出登录`);
    } catch (err) {
        fail(res, err);
    }
});

router.get('/myInfo', authToken, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findByPk(userId, {
            attributes: ['eid', 'name', 'avatar']
        });
        if (!user) {
            fail(res, new CustomError("用户不存在"));
            return;
        }
        let avatarUrl = null;
        if (user.avatar) {
            if (user.avatar.startsWith('http')) {
                avatarUrl = user.avatar;
            } else {
                const baseUrl = process.env.BASE_URL;
                avatarUrl = `${baseUrl}/uploads/avatars/${user.avatar}`;
            }
        }

        const userData = {
            eid: user.eid,
            name: user.name,
            avatar: user.avatar,
        }

        res.setHeader('Cache-Control', 'private, max-age=86400');
        const crypto = require('crypto');
        const etag = crypto.createHash('md5').update(JSON.stringify(userData)).digest('hex');
        res.setHeader('ETag', etag);

        success(res, "获取用户信息成功", user);
    } catch (err) {
        fail(res, err);
    }
});

router.post('/myPhoto', authToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ code: 400, message: '请上传图片文件' });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const fileUrl = `${baseUrl}/uploads/avatars/${req.file.filename}`;

        const user = await User.findByPk(req.userId);
        user.avatar = fileUrl;
        user.updatedAt = new Date();
        user.save();

        res.json({
            code: 200,
            message: '上传成功',
            data: {
                url: fileUrl,
                filename: req.file.filename,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });
    } catch (error) {
        console.error('上传失败:', error);
        res.status(500).json({ code: 500, message: '服务器错误' });
    }
});



module.exports = router;