const express = require('express');
const { getPool, sql } = require('../common/db');
const { StatusCodes, sendError } = require('../common/http');
const { authenticateToken, requireRole } = require('../common/middleware');

const router = express.Router();

// Helper: Parse CSV line
function parseCsvLine(line) {
    // Simple CSV parser: split by comma, handling quotes optionally?
    // User req didn't specify complex CSV. Let's assume standard "val,val,val"
    // If we need robustness we'd add 'csv-parse' lib.
    // Format assumption: name,description,unit_price,unit_weight,category_id
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

        // 1. Check if products exist
        const countRes = await pool.query('SELECT COUNT(*) as c FROM dbo.products');
        if (countRes.recordset[0].c > 0) {
            return sendError(res, StatusCodes.BAD_REQUEST, 'Database already initialized (products exist).');
        }

        let products = [];

        // 2. Parse Body
        const contentType = req.headers['content-type'];
        if (contentType === 'application/json') {
            if (!Array.isArray(req.body)) {
                return sendError(res, StatusCodes.BAD_REQUEST, 'JSON body must be an array of products.');
            }
            products = req.body;
        } else if (contentType === 'text/csv') {
            // Body might be a buffer or string depending on parser, assuming text/csv middleware or string conversion
            // Express default json/url encoded might not handle text/csv raw. 
            // We might need `express.text({ type: 'text/csv' })` in app.js or here.
            // For now, let's assume body is string if middleware allows, or we access it differently.
            // If express.json is used globally, we might receive empty body for text/csv.
            // Let's rely on `req.body` being a string (need middleware config) or just buffer.

            // actually, without bodyParser.text(), req.body might be undefined/empty.
            // I will handle this by returning error if body is empty for CSV.
            if (typeof req.body !== 'string') {
                return sendError(res, StatusCodes.BAD_REQUEST, 'CSV payload must be sent as text/csv. ensure appropriate middleware.');
            }

            const lines = req.body.split('\n');
            // Skip header if present? We'll assume first line is header if it contains "name"
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

        // 3. Insert Products
        // We'll use a transaction for safety
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (const p of products) {
                // Validation: verify category exists
                const catCheck = await transaction.request()
                    .input('cid', sql.Int, p.category_id)
                    .query('SELECT id FROM dbo.categories WHERE id=@cid');

                if (catCheck.recordset.length === 0) {
                    throw new Error(`Category ID ${p.category_id} does not exist.`);
                }

                await transaction.request()
                    .input('name', sql.NVarChar(255), p.name)
                    .input('idx_desc', sql.NVarChar(sql.MAX), p.description) // Param name unique
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
            throw err; // Re-throw to catch block
        }

    } catch (err) {
        sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to initialize products', err.message);
    }
});

module.exports = router;
