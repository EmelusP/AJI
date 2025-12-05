// Endpointy zamówień – lista, wyszukiwanie, szczegóły, tworzenie, zmiana statusu
const express = require('express');
const { getPool, sql } = require('../common/db');
const { StatusCodes, sendError } = require('../common/http');
const { idParamSchema, orderCreateSchema, orderStatusUpdateSchema } = require('../common/validation');
const { canTransition } = require('../common/statusTransitions');

const router = express.Router();

// Pomocniczo: pobiera nagłówek zamówienia oraz pozycje
async function fetchOrder(pool, id) {
  const header = await pool.request().input('id', sql.Int, id)
    .query(`SELECT o.id, o.approved_at, o.status_id, s.name AS status_name, o.user_name, o.email, o.phone, o.created_at
            FROM dbo.orders o JOIN dbo.order_statuses s ON s.id=o.status_id WHERE o.id=@id`);
  if (header.recordset.length === 0) return null;
  const items = await pool.request().input('id', sql.Int, id)
    .query(`SELECT oi.id, oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price, oi.vat, oi.discount
            FROM dbo.order_items oi JOIN dbo.products p ON p.id=oi.product_id WHERE oi.order_id=@id ORDER BY oi.id`);
  return { ...header.recordset[0], items: items.recordset };
}

// GET /orders – lista nagłówków zamówień (bez pozycji)
router.get('/', async (req, res) => {
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

// GET /orders/:id – pełne zamówienie z pozycjami
router.get('/:id', async (req, res) => {
  const { error, value } = idParamSchema.validate(req.params.id);
  if (error) return sendError(res, StatusCodes.BAD_REQUEST, 'Invalid order id');
  try {
    const pool = await getPool();
    const order = await fetchOrder(pool, value);
    if (!order) return sendError(res, StatusCodes.NOT_FOUND, 'Order not found');
    res.json(order);
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch order', err.message);
  }
});

// GET /orders/user/:username – zamówienia dla danego użytkownika
router.get('/user/:username', async (req, res) => {
  const username = String(req.params.username || '').trim();
  if (!username) return sendError(res, StatusCodes.BAD_REQUEST, 'Username is required');
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

// GET /orders/status/:statusId – zamówienia o danym statusie
router.get('/status/:statusId', async (req, res) => {
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

// POST /orders – utworzenie nowego zamówienia
// Waliduje: dane użytkownika, istnienie produktów, dodatnie ilości.
// Ceny pozycji kopiowane są z bieżącej ceny produktu. Operacja w transakcji.
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

      // Walidacja produktów i pobranie bieżących cen (mapa id -> cena)
      const productIds = items.map(i => i.product_id);
      const uniqueIds = [...new Set(productIds)];
      // Build IN clause safely
      if (uniqueIds.length === 0) throw new Error('No items');
      const inParams = uniqueIds.map((_, idx) => `@p${idx}`).join(',');
      const reqWithParams = uniqueIds.reduce((r, id, idx) => r.input(`p${idx}`, sql.Int, id), new sql.Request(tx));
      const productsRes = await reqWithParams.query(`SELECT id, unit_price FROM dbo.products WHERE id IN (${inParams})`);
      const priceMap = new Map(productsRes.recordset.map(r => [r.id, r.unit_price]));
      for (const it of items) {
        if (!priceMap.has(it.product_id)) throw new Error(`Product ${it.product_id} does not exist`);
        if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new Error(`Invalid quantity for product ${it.product_id}`);
      }

      // Status początkowy: 1 (PENDING). Jeżeli approved_at jest podane, ustaw 2 (CONFIRMED).
      const status_id = approved_at ? 2 : 1;

      // Wstawienie nagłówka zamówienia
      const headerRes = await request
        .input('approved_at', approved_at ? sql.DateTime : sql.VarChar, approved_at)
        .input('status_id', sql.Int, status_id)
        .input('user_name', sql.NVarChar(255), user_name)
        .input('email', sql.NVarChar(255), email)
        .input('phone', sql.NVarChar(50), phone)
        .query(`INSERT INTO dbo.orders (approved_at, status_id, user_name, email, phone)
                OUTPUT INSERTED.id VALUES (@approved_at, @status_id, @user_name, @email, @phone)`);
      const orderId = headerRes.recordset[0].id;

      // Wstawianie pozycji zamówienia z ceną z produktu jako unit_price
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

      await tx.commit(); // zatwierdzenie transakcji
      res.status(StatusCodes.CREATED).json({ id: orderId, status_id });
    } catch (inner) {
      await tx.rollback(); // wycofanie transakcji w razie błędu walidacji
      return sendError(res, StatusCodes.BAD_REQUEST, 'Failed to create order', inner.message);
    }
  } catch (err) {
    sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to create order', err.message);
  }
});

// PATCH /orders/:id  { status_id } – zmiana statusu zamówienia
// Sprawdza: istnienie, brak zmian po anulowaniu, brak duplikacji statusu, dozwolone przejście
router.patch('/:id', async (req, res) => {
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

    // Przejście do CONFIRMED (2): ustaw approved_at, jeśli jeszcze puste.
    // CANCELED/ FULFILLED: approved_at pozostaje bez zmian.
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

module.exports = router;
