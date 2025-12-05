// Endpointy produktów – lista, szczegóły, tworzenie, aktualizacja
const express = require('express');
const { getPool, sql } = require('../common/db');
const { StatusCodes, sendError } = require('../common/http');
const {
  idParamSchema,
  productCreateSchema,
  productUpdateSchema,
} = require('../common/validation');

const router = express.Router();

// GET /products – pełna lista produktów wraz z nazwą kategorii
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT p.id, p.name, p.description, p.unit_price, p.unit_weight,
              p.category_id, c.name AS category_name
       FROM dbo.products p
       JOIN dbo.categories c ON c.id = p.category_id
       ORDER BY p.id DESC`
    );
    res.json(result.recordset);
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch products', err.message);
  }
});

// GET /products/:id – pojedynczy produkt (404 gdy brak)
router.get('/:id', async (req, res) => {
  const { error, value } = idParamSchema.validate(req.params.id);
  if (error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid product id');
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, value)
      .query(
        `SELECT p.id, p.name, p.description, p.unit_price, p.unit_weight,
                p.category_id, c.name AS category_name
         FROM dbo.products p
         JOIN dbo.categories c ON c.id = p.category_id
         WHERE p.id = @id`
      );
    if (result.recordset.length === 0)
      return sendError(res, StatusCodes.NOT_FOUND, 'Product not found');
    res.json(result.recordset[0]);
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch product', err.message);
  }
});

// POST /products – dodanie nowego produktu (walidacja danych + istnienie kategorii)
router.post('/', async (req, res) => {
  const { error, value } = productCreateSchema.validate(req.body);
  if (error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid product data', error.details);
  try {
    const pool = await getPool();
    // Ensure category exists
    const cat = await pool.request().input('cid', sql.Int, value.category_id).query('SELECT id FROM dbo.categories WHERE id=@cid');
    if (cat.recordset.length === 0) return sendError(res, StatusCodes.BAD_REQUEST, 'Category does not exist');

    const result = await pool
      .request()
      .input('name', sql.NVarChar(255), value.name)
      .input('description', sql.NVarChar(sql.MAX), value.description)
      .input('price', sql.Decimal(18, 2), value.unit_price)
      .input('weight', sql.Decimal(18, 3), value.unit_weight)
      .input('category_id', sql.Int, value.category_id)
      .query(
        `INSERT INTO dbo.products (name, description, unit_price, unit_weight, category_id)
         OUTPUT INSERTED.id
         VALUES (@name, @description, @price, @weight, @category_id)`
      );
    const id = result.recordset[0].id;
    res.status(StatusCodes.CREATED).json({ id, ...value });
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create product', err.message);
  }
});

// PUT /products/:id – aktualizacja pól produktu (bez zmiany id)
router.put('/:id', async (req, res) => {
  const idCheck = idParamSchema.validate(req.params.id);
  if (idCheck.error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid product id');
  const { error, value } = productUpdateSchema.validate(req.body);
  if (error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid product data', error.details);
  if (Object.keys(value).length === 0) return sendError(res, StatusCodes.BAD_REQUEST, 'No fields to update');
  const id = idCheck.value;
  try {
    const pool = await getPool();
    // Check existence
    const exists = await pool.request().input('id', sql.Int, id).query('SELECT id FROM dbo.products WHERE id=@id');
    if (exists.recordset.length === 0) return sendError(res, StatusCodes.NOT_FOUND, 'Product not found');

    if (value.category_id) {
      const cat = await pool.request().input('cid', sql.Int, value.category_id).query('SELECT id FROM dbo.categories WHERE id=@cid');
      if (cat.recordset.length === 0) return sendError(res, StatusCodes.BAD_REQUEST, 'Category does not exist');
    }

    // Budowa zapytania UPDATE dynamicznie tylko dla przekazanych pól
    const fields = [];
    const reqSql = pool.request().input('id', sql.Int, id);
    if (value.name !== undefined) { fields.push('name=@name'); reqSql.input('name', sql.NVarChar(255), value.name); }
    if (value.description !== undefined) { fields.push('description=@description'); reqSql.input('description', sql.NVarChar(sql.MAX), value.description); }
    if (value.unit_price !== undefined) { fields.push('unit_price=@price'); reqSql.input('price', sql.Decimal(18, 2), value.unit_price); }
    if (value.unit_weight !== undefined) { fields.push('unit_weight=@weight'); reqSql.input('weight', sql.Decimal(18, 3), value.unit_weight); }
    if (value.category_id !== undefined) { fields.push('category_id=@category_id'); reqSql.input('category_id', sql.Int, value.category_id); }

    const query = `UPDATE dbo.products SET ${fields.join(', ')} WHERE id=@id`; 
    await reqSql.query(query);
    res.json({ id, ...value });
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to update product', err.message);
  }
});

module.exports = router;
