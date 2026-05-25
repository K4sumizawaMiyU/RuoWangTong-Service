const express = require('express');
const router = express.Router();
const redisClient = require('../config/redis.js');
const User = require('../models/user.js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const files = multer({ dest: 'files/' });

const { Op } = require('sequelize');
const { CustomError, success, fail } = require('../utils/response.js');
const { generateToken } = require('../utils/jwt.js');
const { authToken, resetPwdToken } = require('../utils/auth.js');
const bcrypt = require('bcryptjs/dist/bcrypt.js');
const Project = require('../models/projects');
const ProjectInspector = require('../models/project_inspectors');


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

const VALID_ROLES = ['主管', '工人', '检查员'];


router.post('/DevBunch/register', files.single('file'), async (req, res) => {
    let workbook = null;
    try {
        if (!req.file) {
            fail(res, new CustomError("请上传 Excel 文件"));
            return;
        }

        const filePath = req.file.path;
        workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
            fail(res, new CustomError("表格中没有数据"));
            return;
        }

        const results = {
            total: rows.length,
            success: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            let { eid, password, phone, name, role } = row;

            try {
                const eidStr = eid != null ? String(eid).trim() : '';
                const passwordStr = password != null ? String(password).trim() : '';
                const phoneStr = phone != null ? String(phone).trim() : '';
                const nameStr = name != null ? String(name).trim() : '';

                if (eidStr === "") throw new CustomError("账号不能为空");
                if (passwordStr === "") throw new CustomError("密码不能为空");
                if (phoneStr === "") throw new CustomError("手机号不能为空");
                if (nameStr === "") throw new CustomError("姓名不能为空");
                if (!/^\d{11}$/.test(phoneStr)) throw new CustomError("手机号必须为11位数字");

                const existingUser = await User.findOne({ where: { eid: eidStr } });
                if (existingUser) throw new CustomError("该账号已被注册");

                let roleValue = undefined;
                if (role !== undefined && role !== null && String(role).trim() !== '') {
                    const roleStr = String(role).trim();
                    if (!VALID_ROLES.includes(roleStr)) {
                        throw new CustomError(`角色值无效，必须是 ${VALID_ROLES.join('、')} 之一`);
                    }
                    roleValue = roleStr;
                }

                await User.create({
                    eid: eidStr,
                    password: passwordStr,
                    phone: phoneStr,
                    name: nameStr,
                    ...(roleValue !== undefined && { role: roleValue })
                });
                console.log(`注册成功！：用户名：${name} 密码：${password}`)
                results.success++;
            } catch (err) {
                results.failed++;
                results.errors.push({
                    row: i + 1,
                    data: row,
                    message: err.message || String(err)
                });
            }
        }

        if (results.failed === 0) {
            success(res, `批量注册成功，共 ${results.success} 条`);
        } else {
            fail(res, new CustomError(
                `批量注册完成，成功 ${results.success} 条，失败 ${results.failed} 条`,
                results.errors
            ));
        }

    } catch (err) {
        fail(res, err);
    } finally {
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("删除临时文件失败:", unlinkErr);
            });
        }
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
        console.log(`${new Date()}: [用户:${user.eid} 登陆成功]`);
    } catch (err) {
        fail(res, new CustomError("账号或密码错误"));
    }
});

router.put('/change_password', authToken, async (req, res) => {
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
        await user.save();
        success(res, "密码修改成功");
        console.log(`${new Date()}: [用户:${user.eid} 修改了密码]`);
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
        await user.save();
        success(res, "密码修改成功", { eid: user.eid });
        console.log(`${new Date()}: [用户:${user.eid} 通过手机号${req.phone} 找回了账号并修改了密码]`);
    } catch (err) {
        fail(res, err);
    }
});

router.post('/logout', authToken, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findByPk(userId);
        const deleted = await redisClient.del(`token:${userId}`);
        if (deleted === 0) {
            return success(res, "您已经登出，无需重复操作");
        }
        success(res, "退出登录成功");
        console.log(`${new Date()}: [用户:${user.eid} 退出登录]`);
    } catch (err) {
        fail(res, err);
    }
});

router.get('/myInfo', authToken, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await User.findByPk(userId, {
            attributes: ['id', 'eid', 'name', 'avatar', 'role', 'role_weight', 'project_id']
        });
        if (!user) {
            return fail(res, new CustomError("用户不存在"));
        }

        const result = {
            id: user.id,
            eid: user.eid,
            name: user.name,
            role: user.role,
            role_weight: user.role_weight,
            avatar: user.avatar
        };
        if (user.role === '工人' && user.project_id) {
            const project = await Project.findByPk(user.project_id, {
                attributes: ['id', 'code', 'name']
            });
            if (project) {
                result.project = {
                    id: project.id,
                    code: project.code,
                    name: project.name,
                };
            } else {
                result.project = null;
            }
        } else {
            result.project = null;
        }

        console.log(`${new Date()}: [用户: ${user.eid} 请求访问个人资料]`);
        success(res, "获取用户信息成功", result);
    } catch (err) {
        console.error(err);
        fail(res, err);
    }
});

router.post('/myPhoto', authToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ code: 400, message: '请上传图片文件' });
        }
        const fileUrl = `/uploads/avatars/${req.file.filename}`;

        const user = await User.findByPk(req.userId);
        user.avatar = fileUrl;
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