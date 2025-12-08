const express = require('express');
const { getPool, sql } = require('../common/db');
const { StatusCodes, sendError } = require('../common/http');
const { verifyPassword, generateTokens, verifyRefreshToken } = require('../common/auth');
const Joi = require('joi');

const router = express.Router();

const loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

const refreshSchema = Joi.object({
    refreshToken: Joi.string().required()
});

// POST /login
router.post('/login', async (req, res) => {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid credentials format');

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('username', sql.NVarChar(50), value.username)
            .query('SELECT * FROM dbo.users WHERE username = @username');

        if (result.recordset.length === 0) {
            return sendError(res, StatusCodes.UNAUTHORIZED, 'Invalid username or password');
        }

        const user = result.recordset[0];
        const match = await verifyPassword(value.password, user.password_hash);
        if (!match) {
            return sendError(res, StatusCodes.UNAUTHORIZED, 'Invalid username or password');
        }

        const tokens = generateTokens(user);
        res.json(tokens);
    } catch (err) {
        sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Login failed', err.message);
    }
});

// POST /refresh
router.post('/refresh', async (req, res) => {
    const { error, value } = refreshSchema.validate(req.body);
    if (error) return sendError(res, StatusCodes.BAD_REQUEST, 'Refresh token required');

    const decoded = verifyRefreshToken(value.refreshToken);
    if (!decoded) {
        return sendError(res, StatusCodes.FORBIDDEN, 'Invalid or expired refresh token');
    }

    // Opcjonalnie: można sprawdzić czy user nadal istnieje w bazie
    // Na razie ufamy tokenowi (stateless)
    const tokens = generateTokens({
        id: decoded.id,
        username: decoded.username,
        role: decoded.role
    });

    res.json(tokens);
});

module.exports = router;
