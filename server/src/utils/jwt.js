const jwt = require('jsonwebtoken');
require('dotenv').config();

const accessSecret = process.env.JWT_SECRET || 'oems_secret';
const accessExpires = process.env.JWT_EXPIRES || '7d';
const refreshSecret = process.env.JWT_REFRESH_SECRET || accessSecret;
const refreshExpires = process.env.JWT_REFRESH_EXPIRES || '30d';

exports.sign = (payload) => jwt.sign(payload, accessSecret, { expiresIn: accessExpires });
exports.verify = (token) => jwt.verify(token, accessSecret);
exports.signRefresh = (payload) => jwt.sign(payload, refreshSecret, { expiresIn: refreshExpires });
exports.verifyRefresh = (token) => jwt.verify(token, refreshSecret);
