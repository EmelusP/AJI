// Połączenie z bazą Microsoft SQL Server (pool połączeń)
// Czyta konfigurację z zmiennych środowiskowych (.env)
const sql = require('mssql');

// Pojedyncza obietnica z utworzonym połączeniem (singleton)
let poolPromise;

// Buduje obiekt konfiguracyjny klienta mssql na podstawie ENV
function getConfig() {
  const {
    DB_SERVER,
    DB_PORT = '1433',
    DB_USER,
    DB_PASSWORD,
    DB_DATABASE,
    DB_ENCRYPT = 'false',
  } = process.env;

  return {
    server: DB_SERVER,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_DATABASE,
    options: {
      encrypt: String(DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: String(DB_ENCRYPT).toLowerCase() !== 'true',
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

// Zwraca (tworzy leniwie) globalny pool połączeń
async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(getConfig());
  }
  return poolPromise;
}

module.exports = {
  sql,
  getPool,
};
