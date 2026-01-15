const express = require('express');
const dotenv = require('dotenv');
const { StatusCodes, sendError } = require('./common/http');

dotenv.config();

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type,Authorization'
  );
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: 'text/csv' }));

app.use('/', require('./api/auth'));
app.use('/', require('./api/init'));

const { authenticateToken, requireRole } = require('./common/middleware');

app.use('/categories', require('./api/categories'));
app.use('/status', require('./api/statuses'));

app.use('/products', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    return authenticateToken(req, res, next);
  }
  next();
}, require('./api/products'));

app.use('/products', require('./api/seo'));
app.use('/orders', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'PATCH') {
    return authenticateToken(req, res, () =>
      requireRole('PRACOWNIK')(req, res, next)
    );
  }
  return next();
}, require('./api/orders'));

app.get('/migrate-d4', async (req, res) => {
  try {
    const { getPool } = require('./common/db');
    const pool = await getPool();
    await pool.query(`
      IF OBJECT_ID('dbo.order_opinions', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.order_opinions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          order_id INT NOT NULL,
          rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
          content NVARCHAR(MAX),
          created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
          CONSTRAINT fk_opinions_order FOREIGN KEY (order_id) REFERENCES dbo.orders(id) ON DELETE CASCADE
        );
      END
    `);
    res.send('Migration D4 OK');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => sendError(res, StatusCodes.NOT_FOUND, 'Route not found'));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error');
});

module.exports = app;
