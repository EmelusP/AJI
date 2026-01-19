const express = require('express');
const { getPool, sql } = require('../common/db');
const { StatusCodes, sendError } = require('../common/http');
const { idParamSchema, orderCreateSchema, orderStatusUpdateSchema } = require('../common/validation');
const { authenticateToken, requireRole } = require('../common/middleware');
const { canTransition } = require('../common/statusTransitions');

const router = express.Router();

async function fetchOrder(pool, id) {
  const header = await pool.request().input('id', sql.Int, id)
    .query(`SELECT o.id, o.approved_at, o.status_id, s.name AS status_name, o.user_name, o.email, o.phone, o.created_at
            FROM dbo.orders o JOIN dbo.order_statuses s ON s.id=o.status_id WHERE o.id=@id`);
  if (header.recordset.length === 0) return null;

  const items = await pool.request().input('id', sql.Int, id)
    .query(`SELECT oi.id, oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price, oi.vat, oi.discount
            FROM dbo.order_items oi JOIN dbo.products p ON p.id=oi.product_id WHERE oi.order_id=@id ORDER BY oi.id`);

  const opinions = await pool.request().input('id', sql.Int, id)
    .query(`SELECT id, rating, content, created_at FROM dbo.order_opinions WHERE order_id=@id`);

  return {
    ...header.recordset[0],
    items: items.recordset,
    opinions: opinions.recordset
  };
}

// LIST ALL: PRACOWNIK ONLY
router.get('/', authenticateToken, requireRole('PRACOWNIK'), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(
      `SELECT o.id, o.approved_at, o.status_id, s.name AS status_name, o.user_name, o.email, o.phone, o.created_at
       FROM dbo.orders o JOIN dbo.order_statuses s ON s.id=o.status_id
       ORDER BY o.id DESC`
    );
    res.json(result.recordset);
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch orders', err.message);
  }
});

// GET SINGLE: Authentication required. Owner or PRACOWNIK.
router.get('/:id', authenticateToken, async (req, res) => {
  const { error, value } = idParamSchema.validate(req.params.id);
  if (error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid order id');
  try {
    const pool = await getPool();
    const order = await fetchOrder(pool, value);
    if (!order) return sendError(res, StatusCodes.NOT_FOUND, 'Order not found');

    // Authorization check
    if (req.user.role !== 'PRACOWNIK' && req.user.username !== order.user_name) {
      return sendError(res, StatusCodes.FORBIDDEN, 'Access denied');
    }

    res.json(order);
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch order', err.message);
  }
});

// GET USER ORDERS: Authentication required. Owner or PRACOWNIK.
router.get('/user/:username', authenticateToken, async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) return sendError(res, StatusCodes.BAD_REQUEST, 'Username is required');

  // Authorization check
  if (req.user.role !== 'PRACOWNIK' && req.user.username !== username) {
    return sendError(res, StatusCodes.FORBIDDEN, 'Access denied');
  }

  try {
    const pool = await getPool();
    const result = await pool.request().input('username', sql.NVarChar(255), username)
      .query(`SELECT o.id, o.approved_at, o.status_id, s.name AS status_name, o.user_name, o.email, o.phone, o.created_at
              FROM dbo.orders o JOIN dbo.order_statuses s ON s.id=o.status_id
              WHERE o.user_name=@username ORDER BY o.id DESC`);
    res.json(result.recordset);
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch orders for user', err.message);
  }
});

// GET BY STATUS: PRACOWNIK ONLY
router.get('/status/:statusId', authenticateToken, requireRole('PRACOWNIK'), async (req, res) => {
  const { error, value } = idParamSchema.validate(req.params.statusId);
  if (error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid status id');
  try {
    const pool = await getPool();
    const result = await pool.request().input('status_id', sql.Int, value)
      .query(`SELECT o.id, o.approved_at, o.status_id, s.name AS status_name, o.user_name, o.email, o.phone, o.created_at
              FROM dbo.orders o JOIN dbo.order_statuses s ON s.id=o.status_id
              WHERE o.status_id=@status_id ORDER BY o.id DESC`);
    res.json(result.recordset);
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch orders by status', err.message);
  }
});

router.post('/', async (req, res) => {
  const { error, value } = orderCreateSchema.validate(req.body);
  if (error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid order data', error.details);

  const { user_name, email, phone, approved_at = null, items } = value;
  try {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const request = new sql.Request(tx);

      const productIds = items.map(i => i.product_id);
      const uniqueIds = [...new Set(productIds)];
      if (uniqueIds.length === 0) throw new Error('No items');
      const inParams = uniqueIds.map((_, idx) => `@p${idx}`).join(',');
      const reqWithParams = uniqueIds.reduce((r, id, idx) => r.input(`p${idx}`, sql.Int, id), new sql.Request(tx));
      const productsRes = await reqWithParams.query(`SELECT id, unit_price FROM dbo.products WHERE id IN (${inParams})`);
      const priceMap = new Map(productsRes.recordset.map(r => [r.id, r.unit_price]));
      for (const it of items) {
        if (!priceMap.has(it.product_id)) throw new Error(`Product ${it.product_id} does not exist`);
        if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new Error(`Invalid quantity for product ${it.product_id}`);
      }

      const status_id = approved_at ? 2 : 1;

      const headerRes = await request
        .input('approved_at', approved_at ? sql.DateTime : sql.VarChar, approved_at)
        .input('status_id', sql.Int, status_id)
        .input('user_name', sql.NVarChar(255), user_name)
        .input('email', sql.NVarChar(255), email)
        .input('phone', sql.NVarChar(50), phone)
        .query(`INSERT INTO dbo.orders (approved_at, status_id, user_name, email, phone)
                OUTPUT INSERTED.id VALUES (@approved_at, @status_id, @user_name, @email, @phone)`);
      const orderId = headerRes.recordset[0].id;

      for (const it of items) {
        const unitPrice = priceMap.get(it.product_id);
        const reqItem = new sql.Request(tx);
        await reqItem
          .input('order_id', sql.Int, orderId)
          .input('product_id', sql.Int, it.product_id)
          .input('quantity', sql.Int, it.quantity)
          .input('unit_price', sql.Decimal(18, 2), unitPrice)
          .input('vat', it.vat != null ? sql.Decimal(5, 2) : sql.VarChar, it.vat)
          .input('discount', it.discount != null ? sql.Decimal(5, 2) : sql.VarChar, it.discount)
          .query(`INSERT INTO dbo.order_items (order_id, product_id, quantity, unit_price, vat, discount)
                  VALUES (@order_id, @product_id, @quantity, @unit_price, @vat, @discount)`);
      }

      await tx.commit();
      res.status(StatusCodes.CREATED).json({ id: orderId, status_id });
    } catch (inner) {
      await tx.rollback();
      return sendError(res, StatusCodes.BAD_REQUEST, 'Failed to create order', inner.message);
    }
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create order', err.message);
  }
});

// UPDATE STATUS: PRACOWNIK ONLY
router.patch('/:id', authenticateToken, requireRole('PRACOWNIK'), async (req, res) => {
  const idCheck = idParamSchema.validate(req.params.id);
  if (idCheck.error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid order id');
  const bodyCheck = orderStatusUpdateSchema.validate(req.body);
  if (bodyCheck.error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid status payload', bodyCheck.details);

  const id = idCheck.value;
  const nextStatus = bodyCheck.value.status_id;
  try {
    const pool = await getPool();
    const current = await pool.request().input('id', sql.Int, id)
      .query('SELECT status_id FROM dbo.orders WHERE id=@id');
    if (current.recordset.length === 0) return sendError(res, StatusCodes.NOT_FOUND, 'Order not found');
    const from = current.recordset[0].status_id;
    if (from === 3) return sendError(res, StatusCodes.CONFLICT, 'Cannot change status of a canceled order');
    if (from === nextStatus) return sendError(res, StatusCodes.BAD_REQUEST, 'Order already has the requested status');
    if (!canTransition(from, nextStatus)) return sendError(res, StatusCodes.CONFLICT, `Invalid status transition from ${from} to ${nextStatus}`);

    const reqSql = pool.request().input('id', sql.Int, id).input('status_id', sql.Int, nextStatus);
    let update = 'UPDATE dbo.orders SET status_id=@status_id';
    if (nextStatus === 2) update += ', approved_at = ISNULL(approved_at, SYSUTCDATETIME())';
    update += ' WHERE id=@id';
    await reqSql.query(update);
    res.json({ id, status_id: nextStatus });
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to update order status', err.message);
  }
});

router.post('/:id/opinions', authenticateToken, async (req, res) => {
  const idCheck = idParamSchema.validate(req.params.id);
  if (idCheck.error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid order id');

  const { rating, content } = req.body;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return sendError(res, StatusCodes.BAD_REQUEST, 'Rating must be an integer between 1 and 5');
  }

  const orderId = idCheck.value;
  try {
    const pool = await getPool();
    const orderRes = await pool.request().input('id', sql.Int, orderId)
      .query('SELECT user_name, status_id FROM dbo.orders WHERE id=@id');

    if (orderRes.recordset.length === 0) return sendError(res, StatusCodes.NOT_FOUND, 'Order not found');
    const order = orderRes.recordset[0];

    if (order.user_name !== req.user.username) {
      return sendError(res, StatusCodes.FORBIDDEN, 'You can only rate your own orders');
    }

    if (![3, 4].includes(order.status_id)) {
      return sendError(res, StatusCodes.BAD_REQUEST, 'Order must be FULFILLED or CANCELED to leave an opinion');
    }

    const existing = await pool.request().input('oid', sql.Int, orderId)
      .query('SELECT id FROM dbo.order_opinions WHERE order_id=@oid');
    if (existing.recordset.length > 0) {
      return sendError(res, StatusCodes.CONFLICT, 'Opinion for this order already exists');
    }

    await pool.request()
      .input('oid', sql.Int, orderId)
      .input('rating', sql.Int, rating)
      .input('content', sql.NVarChar(sql.MAX), content || '')
      .query('INSERT INTO dbo.order_opinions (order_id, rating, content) VALUES (@oid, @rating, @content)');

    res.status(StatusCodes.CREATED).json({ success: true, order_id: orderId });
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to add opinion', err.message);
  }
});

router.get('/:id/opinions', async (req, res) => {
  const idCheck = idParamSchema.validate(req.params.id);
  if (idCheck.error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid order id');

  try {
    const pool = await getPool();
    const result = await pool.request().input('oid', sql.Int, idCheck.value)
      .query('SELECT id, rating, content, created_at FROM dbo.order_opinions WHERE order_id=@oid');
    res.json({ opinions: result.recordset });
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch opinions', err.message);
  }
});

module.exports = router;
