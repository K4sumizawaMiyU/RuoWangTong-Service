const jwt = require('jsonwebtoken');

const generateToken = (user) => {
    const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    return token;
};

const resetToken = (phone) => {
    const token = jwt.sign(
        { phone: phone, purpose: 'reset_password' },
        process.env.JWT_RESET_SECRET,
        { expiresIn: '5m' }   // 5 分钟
    )
    return token;
};

module.exports = {
    generateToken,
    resetToken,
};