const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authToken } = require('../utils/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {

        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        const uniqueName = `${Date.now()}_${uuidv4().slice(0, 8)}_${basename}${ext}`;
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
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: fileFilter
});


router.post('/image', authToken, upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ code: 400, message: '请上传图片文件' });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

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

router.post('/images', authToken, upload.array('images', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ code: 400, message: '请至少上传一个图片文件' });
        }

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const filesInfo = req.files.map(file => ({
            url: `${baseUrl}/uploads/${file.filename}`,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype
        }));

        res.json({
            code: 200,
            message: '上传成功',
            data: filesInfo
        });
    } catch (error) {
        console.error('上传失败:', error);
        res.status(500).json({ code: 500, message: '服务器错误' });
    }
});

router.delete('/image/:filename', authToken, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ code: 400, message: '非法文件名' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ code: 404, message: '文件不存在' });
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('删除失败:', err);
            return res.status(500).json({ code: 500, message: '删除失败' });
        }
        res.json({ code: 200, message: '删除成功' });
    });
});

module.exports = router;