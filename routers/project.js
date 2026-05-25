const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { Op } = require('sequelize');
const Project = require('../models/projects');
const ProjectInspector = require('../models/project_inspectors.js');
const User = require('../models/user');
const { authToken } = require('../utils/auth.js');
const { CustomError, success, fail } = require('../utils/response.js');

const requireSupervisor = async (req, res, next) => {
    const user = await User.findByPk(req.userId);
    if (!user || user.role !== '主管') {
        return fail(res, new CustomError('仅主管可操作', 403));
    }
    next();
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (ext === 'xlsx' || ext === 'xls') {
            cb(null, true);
        } else {
            cb(new Error('只允许上传 Excel 文件'), false);
        }
    }
});

function validateProjectRow(row, rowIndex) {
    if (!row['项目编码'] || !row['项目名称'] || !row['负责主管工号']) {
        throw new Error(`第 ${rowIndex} 行缺少必填字段：项目编码、项目名称、负责主管工号`);
    }

    const projectData = {
        code: String(row['项目编码']).trim(),
        name: String(row['项目名称']).trim(),
        description: row['项目描述'] ? String(row['项目描述']).trim() : null,
        supervisor_id: null,
        startDate: row['开始日期'] ? new Date(row['开始日期']) : null,
        endDate: row['结束日期'] ? new Date(row['结束日期']) : null,
        status: row['状态'] || '规划中',
        location: row['地点'] ? String(row['地点']).trim() : null,
    };

    const validStatus = ['进行中', '已完成', '暂停', '规划中'];
    if (!validStatus.includes(projectData.status)) {
        throw new Error(`第 ${rowIndex} 行状态值无效，必须是：${validStatus.join('、')}`);
    }

    if (projectData.startDate && projectData.endDate && projectData.startDate > projectData.endDate) {
        throw new Error(`第 ${rowIndex} 行开始日期不能晚于结束日期`);
    }

    return projectData;
}

// 批量关联工人与项目
router.post('/assign_project', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ code: 400, message: '请上传 Excel 文件' });
    }

    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
            return res.status(400).json({ code: 400, message: 'Excel 中无数据' });
        }

        // 预加载所有项目编码 -> ID
        const allProjects = await Project.findAll({
            where: { isDeleted: false },
            attributes: ['code', 'id']
        });
        const codeToId = new Map();
        allProjects.forEach(p => codeToId.set(p.code, p.id));

        let successCount = 0;
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNum = i + 2;
            const eid = row['工号'] ? String(row['工号']).trim() : '';
            const projectCode = row['项目编码'] ? String(row['项目编码']).trim() : '';

            if (!eid || !projectCode) {
                errors.push({ row: rowNum, message: '工号或项目编码为空' });
                continue;
            }

            const projectId = codeToId.get(projectCode);
            if (!projectId) {
                errors.push({ row: rowNum, message: `项目编码 ${projectCode} 不存在` });
                continue;
            }

            const worker = await User.findOne({ where: { eid, role: '工人' } });
            if (!worker) {
                errors.push({ row: rowNum, message: `工号 ${eid} 不存在或不是工人` });
                continue;
            }

            await worker.update({ project_id: projectId });
            successCount++;
        }

        if (errors.length === 0) {
            res.json({ code: 200, message: `成功关联 ${successCount} 名工人` });
        } else {
            res.status(400).json({
                code: 400,
                message: `成功 ${successCount} 条，失败 ${errors.length} 条`,
                errors
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, message: err.message });
    }
});

router.post('/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ code: 400, message: '请上传 Excel 文件' });
        }

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rows || rows.length === 0) {
            return res.status(400).json({ code: 400, message: 'Excel 文件无数据' });
        }

        // 查询现有项目
        const existingProjects = await Project.findAll({
            attributes: ['code', 'id'],
            where: { isDeleted: false }
        });
        const codeToExistingId = new Map();
        existingProjects.forEach(p => codeToExistingId.set(p.code, p.id));

        // 查询主管用户
        const supervisorEids = [...new Set(rows.map(row => String(row['负责主管工号']).trim()))];
        const users = await User.findAll({
            attributes: ['eid', 'id'],
            where: { eid: { [Op.in]: supervisorEids } }
        });
        const eidToUserId = new Map();
        users.forEach(u => eidToUserId.set(u.eid, u.id));

        const toCreate = [];
        const toUpdate = [];
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowIndex = i + 2;
            try {
                const projectData = validateProjectRow(row, rowIndex);
                const supervisorEid = String(row['负责主管工号']).trim();
                const supervisorUserId = eidToUserId.get(supervisorEid);
                if (!supervisorUserId) {
                    throw new Error(`主管工号 ${supervisorEid} 不存在于系统中`);
                }
                projectData.supervisor_id = supervisorUserId;

                const existingId = codeToExistingId.get(projectData.code);
                if (existingId) {
                    toUpdate.push({ id: existingId, ...projectData });
                } else {
                    toCreate.push(projectData);
                }
            } catch (err) {
                errors.push({ row: rowIndex, message: err.message });
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({ code: 400, message: `存在 ${errors.length} 行校验失败`, data: { errors } });
        }

        const sequelize = require('../database/db');
        const transaction = await sequelize.transaction();
        try {
            let createdCount = 0, updatedCount = 0;
            if (toCreate.length) {
                const created = await Project.bulkCreate(toCreate, { transaction });
                createdCount = created.length;
            }
            if (toUpdate.length) {
                for (const item of toUpdate) {
                    const { id, ...updateData } = item;
                    await Project.update(updateData, { where: { id }, transaction });
                    updatedCount++;
                }
            }
            await transaction.commit();
            res.json({ code: 200, message: '导入成功', data: { created: createdCount, updated: updatedCount, total: rows.length } });
        } catch (dbErr) {
            await transaction.rollback();
            console.error(dbErr);
            res.status(500).json({ code: 500, message: '数据库写入失败' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ code: 500, message: err.message || '服务器内部错误' });
    }
});

// 获取项目列表（分页，可选条件过滤）
router.get('/', authToken, requireSupervisor, async (req, res) => {
    try {
        const { page = 1, pageSize = 20, code, name, status } = req.query;
        const userId = req.userId;
        const where = { isDeleted: false, supervisor_id: userId, status: "进行中" };
        if (code) where.code = { [Op.like]: `%${code}%` };
        if (name) where.name = { [Op.like]: `%${name}%` };
        if (status) where.status = status;

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const { count, rows } = await Project.findAndCountAll({
            where,
            offset,
            limit: parseInt(pageSize),
            order: [['createdAt', 'DESC']]
        });
        success(res, '查询成功', { total: count, list: rows, page, pageSize });
    } catch (err) {
        fail(res, err);
    }
});

// 获取单个项目详情
router.get('/detail/:id', authToken, requireSupervisor, async (req, res) => {
    try {
        const project = await Project.findOne({ where: { id: req.params.id, isDeleted: false } });
        if (!project) return fail(res, new CustomError('项目不存在', 404));
        success(res, '查询成功', project);
    } catch (err) {
        fail(res, err);
    }
});

router.get('/inspectors', authToken, requireSupervisor, async (req, res) => {
    try {
        const { page = 1, pageSize = 20, code, name } = req.query;
        const where = { role: "检查员" };
        if (code) where.eid = { [Op.like]: `%${code}%` };
        if (name) where.name = { [Op.like]: `%${name}%` };

        const offset = (parseInt(page) - 1) * parseInt(pageSize);
        const { count, rows } = await User.findAndCountAll({
            where,
            offset,
            limit: parseInt(pageSize),
            order: [['createdAt', 'DESC']],
            attributes: ['eid', 'name', 'project_id']
        });
        success(res, '查询成功', { total: count, list: rows, page, pageSize });
    } catch (err) {
        fail(res, err);
    }
});

router.get('/:projectId/inspectors', authToken, requireSupervisor, async (req, res) => {
    const { projectId } = req.params;
    const userId = req.userId;

    try {
        // 校验项目存在且当前主管是其负责人（可选，如果不需要权限校验可去掉）
        const project = await Project.findOne({
            where: { id: projectId, isDeleted: false }
        });
        if (!project) return fail(res, new CustomError('项目不存在', 404));
        if (project.supervisor_id !== userId) {
            return fail(res, new CustomError('无权限查看此项目的检查员', 403));
        }

        // 查询关联关系
        const assignments = await ProjectInspector.findAll({
            where: { projectId },
            attributes: ['inspectorId', 'assignedAt', 'assignedBy']
        });

        if (assignments.length === 0) {
            return success(res, '查询成功', "当前项目未分配检查员");
        }

        const inspectorIds = assignments.map(a => a.inspectorId);
        const inspectors = await User.findAll({
            where: { id: { [Op.in]: inspectorIds } },
            attributes: ['id', 'eid', 'name']
        });

        // 合并信息
        const result = assignments.map(ass => {
            const inspector = inspectors.find(i => i.id === ass.inspectorId);

            return {
                eid: inspector?.eid,
                name: inspector?.name,
            };
        });
        console.info(`用户${userId} 申请查询项目检查员`)
        success(res, '查询成功', result);
    } catch (err) {
        console.error(err);
        fail(res, err);
    }
});

router.post('/:projectId/inspectors', authToken, requireSupervisor, async (req, res) => {
    const { projectId } = req.params;
    const { inspectorEid, inspectorEids } = req.body;
    const userId = req.userId;

    let eids = [];
    if (inspectorEids && Array.isArray(inspectorEids) && inspectorEids.length > 0) {
        eids = inspectorEids;
    } else if (inspectorEid && typeof inspectorEid === 'string' && inspectorEid.trim()) {
        eids = [inspectorEid.trim()];
    } else {
        return fail(res, new CustomError('请提供检查员工号 (inspectorEid 单个 或 inspectorEids 数组)', 400));
    }

    const sequelize = require('../database/db');
    const transaction = await sequelize.transaction();

    try {
        const project = await Project.findOne({
            where: { id: projectId, isDeleted: false },
            transaction
        });
        if (!project) {
            await transaction.rollback();
            return fail(res, new CustomError('项目不存在', 404));
        }
        if (project.supervisor_id !== userId) {
            await transaction.rollback();
            return fail(res, new CustomError('无权限操作此项目', 403));
        }

        const inspectors = await User.findAll({
            where: {
                eid: { [Op.in]: eids },
                role: '检查员'
            },
            attributes: ['id', 'eid', 'name'],
            transaction
        });

        const foundEids = inspectors.map(i => i.eid);
        const notFoundEids = eids.filter(eid => !foundEids.includes(eid));

        const existingAssignments = await ProjectInspector.findAll({
            where: {
                projectId,
                inspectorId: { [Op.in]: inspectors.map(i => i.id) }
            },
            attributes: ['inspectorId'],
            transaction
        });
        const existingInspectorIds = new Set(existingAssignments.map(a => a.inspectorId));

        const toAssign = inspectors.filter(i => !existingInspectorIds.has(i.id));
        const assignedDetails = [];
        for (const inspector of toAssign) {
            await ProjectInspector.create({
                projectId,
                inspectorId: inspector.id,
                assignedBy: userId,
                assignedAt: new Date()
            }, { transaction });
            assignedDetails.push({
                eid: inspector.eid,
                name: inspector.name,
                id: inspector.id
            });
        }

        await transaction.commit();

        const result = {
            total: eids.length,
            assigned: assignedDetails.length,
            alreadyAssigned: inspectors.length - assignedDetails.length,
            notFound: notFoundEids,
            details: assignedDetails
        };

        success(res, '分配成功', result);
    } catch (err) {
        await transaction.rollback();
        console.error('分配检查员失败:', err);
        fail(res, new CustomError('服务器内部错误', 500));
    }
});

router.delete('/:projectId/inspectors', authToken, requireSupervisor, async (req, res) => {
    const { projectId } = req.params;
    const { inspectorEid, inspectorEids } = req.body;
    const userId = req.userId;

    // 1. 解析要删除的工号列表
    let eids = [];
    if (inspectorEids && Array.isArray(inspectorEids) && inspectorEids.length > 0) {
        eids = inspectorEids;
    } else if (inspectorEid && typeof inspectorEid === 'string' && inspectorEid.trim()) {
        eids = [inspectorEid.trim()];
    } else {
        return fail(res, new CustomError('请提供检查员工号 (inspectorEid 单个 或 inspectorEids 数组)', 400));
    }

    try {
        // 2. 校验项目存在且当前主管是其负责人
        const project = await Project.findOne({
            where: { id: projectId, isDeleted: false }
        });
        if (!project) return fail(res, new CustomError('项目不存在', 404));
        if (project.supervisor_id !== userId) {
            return fail(res, new CustomError('无权限操作此项目', 403));
        }

        // 3. 根据工号查询对应的检查员用户ID（只查角色为检查员的）
        const inspectors = await User.findAll({
            where: {
                eid: { [Op.in]: eids },
                role: '检查员'
            },
            attributes: ['id', 'eid']
        });

        const foundEids = inspectors.map(i => i.eid);
        const notFoundEids = eids.filter(eid => !foundEids.includes(eid));
        const inspectorIds = inspectors.map(i => i.id);

        if (inspectorIds.length === 0) {
            return fail(res, new CustomError(`未找到任何有效的检查员，不存在的工号：${notFoundEids.join(', ')}`, 404));
        }

        // 4. 删除关联记录
        const deletedCount = await ProjectInspector.destroy({
            where: {
                projectId,
                inspectorId: { [Op.in]: inspectorIds }
            }
        });

        if (deletedCount === 0) {
            return fail(res, new CustomError('未找到匹配的分配记录', 404));
        }

        const result = {
            total: eids.length,
            deletedCount: deletedCount,
            notFound: notFoundEids
        };
        success(res, `成功移除 ${deletedCount} 名检查员`, result);
    } catch (err) {
        console.error('删除检查员失败:', err);
        fail(res, new CustomError('服务器内部错误', 500));
    }
});

module.exports = router;