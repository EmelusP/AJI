// Główna konfiguracja aplikacji Express: middleware, trasy, obsługa błędów
const express = require('express');
const dotenv = require('dotenv');
const { StatusCodes, sendError } = require('./common/http');

dotenv.config();

const app = express();

// Middlewares – JSON body, ograniczenie rozmiaru
app.use(express.json({ limit: '1mb' }));
app.use(express.text({ type: 'text/csv' })); // Obsługa CSV

// Rejestracja tras API
app.use('/', require('./api/auth')); // /login, /refresh
app.use('/', require('./api/init')); // /init

const { authenticateToken, requireRole } = require('./common/middleware');

app.use('/categories', require('./api/categories'));
app.use('/status', require('./api/statuses'));

// Publiczny odczyt produktów, ale zabezpieczony zapis
app.use('/products', (req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    return authenticateToken(req, res, next);
  }
  next();
}, require('./api/products'));

app.use('/products', require('./api/seo')); // SEO description
app.use('/orders', require('./api/orders'));

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// 404 – brak dopasowanej trasy
app.use((req, res) => sendError(res, StatusCodes.NOT_FOUND, 'Route not found'));

// Globalny handler błędów – minimalne logowanie (bez PII), ujednolicona odpowiedź
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err); // minimal logging, no PII
  sendError(res, StatusCodes.INTERNAL_SERVER_ERROR, 'Internal server error');
});

module.exports = app;
