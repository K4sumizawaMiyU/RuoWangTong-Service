const express = require('express');
const { success } = require('../utils/response');
const router = express.Router();

router.get('/ping', async (req, res) => {
    res.status(200).json({ pong: true, timestamp: Date.now() });
})

module.exports = router;