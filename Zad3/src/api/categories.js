// Endpointy kategorii – tylko odczyt pełnej listy (kategorie są predefiniowane)
const express = require('express');
const { getPool, sql } = require('../common/db');
const { StatusCodes, sendError } = require('../common/http');

const router = express.Router();

// GET /categories – zwraca wszystkie kategorie
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT id, name FROM dbo.categories ORDER BY name');
    res.json(result.recordset);
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch categories', err.message);
  }
});

module.exports = router;
