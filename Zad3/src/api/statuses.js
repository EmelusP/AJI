// Endpointy statusów zamówienia – odczyt listy statusów
const express = require('express');
const { getPool } = require('../common/db');
const { StatusCodes, sendError } = require('../common/http');

const router = express.Router();

// GET /status – zwraca słownik statusów (id, name)
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT id, name FROM dbo.order_statuses ORDER BY id');
    res.json(result.recordset);
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch statuses', err.message);
  }
});

module.exports = router;
