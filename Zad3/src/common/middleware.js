const { StatusCodes, sendError } = require('./http');
const { verifyAccessToken } = require('./auth');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return sendError(res, StatusCodes.UNAUTHORIZED, 'Access token required');
    }

    const user = verifyAccessToken(token);
    if (!user) {
        return sendError(res, StatusCodes.FORBIDDEN, 'Invalid or expired access token');
    }

    req.user = user;
    next();
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return sendError(res, StatusCodes.FORBIDDEN, `Access denied. Requires role: ${role}`);
        }
        next();
    };
}

module.exports = {
    authenticateToken,
    requireRole
};
