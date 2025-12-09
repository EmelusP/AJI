const express = require('express');
const { getPool, sql } = require('../common/db');
const { StatusCodes, sendError } = require('../common/http');
const { authenticateToken, requireRole } = require('../common/middleware');

const router = express.Router();

function parseCsvLine(line) {
    const parts = line.split(',');
    if (parts.length < 5) return null;
    return {
        name: parts[0].trim(),
        description: parts[1].trim(),
        unit_price: parseFloat(parts[2]),
        unit_weight: parseFloat(parts[3]),
        category_id: parseInt(parts[4])
    };
}

router.post('/init', authenticateToken, requireRole('PRACOWNIK'), async (req, res) => {
    try {
        const pool = await getPool();

        const countRes = await pool.query('SELECT COUNT(*) as c FROM dbo.products');
        if (countRes.recordset[0].c > 0) {
            return sendError(res, StatusCodes.BAD_REQUEST, 'Database already initialized (products exist).');
        }

        let products = [];

        const contentType = req.headers['content-type'];
        if (contentType === 'application/json') {
            if (!Array.isArray(req.body)) {
                return sendError(res, StatusCodes.BAD_REQUEST, 'JSON body must be an array of products.');
            }
            products = req.body;
        } else if (contentType === 'text/csv') {
            if (typeof req.body !== 'string') {
                return sendError(res, StatusCodes.BAD_REQUEST, 'CSV payload must be sent as text/csv. ensure appropriate middleware.');
            }

            const lines = req.body.split('\n');
            let startIndex = 0;
            if (lines[0].toLowerCase().includes('name')) startIndex = 1;

            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const p = parseCsvLine(line);
                if (p) products.push(p);
            }
        } else {
            return sendError(res, StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Supported formats: application/json, text/csv');
        }

        if (products.length === 0) {
            return sendError(res, StatusCodes.BAD_REQUEST, 'No valid products found to import.');
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (const p of products) {
                const catCheck = await transaction.request()
                    .input('cid', sql.Int, p.category_id)
                    .query('SELECT id FROM dbo.categories WHERE id=@cid');

                if (catCheck.recordset.length === 0) {
                    throw new Error(`Category ID ${p.category_id} does not exist.`);
                }

                await transaction.request()
                    .input('name', sql.NVarChar(255), p.name)
                    .input('idx_desc', sql.NVarChar(sql.MAX), p.description)
                    .input('price', sql.Decimal(18, 2), p.unit_price)
                    .input('weight', sql.Decimal(18, 3), p.unit_weight)
                    .input('cid', sql.Int, p.category_id)
                    .query(`INSERT INTO dbo.products (name, description, unit_price, unit_weight, category_id)
                  VALUES (@name, @idx_desc, @price, @weight, @cid)`);
            }

            await transaction.commit();
            res.json({ success: true, count: products.length });
        } catch (err) {
            await transaction.rollback();
            throw err;
        }

    } catch (err) {
        sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to initialize products', err.message);
    }
});

module.exports = router;
