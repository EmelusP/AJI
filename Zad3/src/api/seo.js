const express = require('express');
const { getPool, sql } = require('../common/db');
const { StatusCodes, sendError } = require('../common/http');
const { idParamSchema } = require('../common/validation');
const { generateSeoDescription } = require('../services/seo');

const router = express.Router();

router.get('/:id/seo-description', async (req, res) => {
  const { error, value } = idParamSchema.validate(req.params.id);
  if (error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid product id');
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.Int, value).query(
      `SELECT p.id, p.name, p.description, p.unit_price, p.unit_weight, p.category_id, c.name AS category_name
       FROM dbo.products p JOIN dbo.categories c ON c.id=p.category_id WHERE p.id=@id`
    );
    if (result.recordset.length === 0) return sendError(res, StatusCodes.NOT_FOUND, 'Product not found');
    const product = result.recordset[0];
    const html = await generateSeoDescription(product);
    res.type('text/html').send(html);
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to generate SEO description', err.message);
  }
});

module.exports = router;
