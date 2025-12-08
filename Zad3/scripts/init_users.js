const { getPool, sql } = require('../src/common/db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initUsers() {
    try {
        const pool = await getPool();
        console.log('Connected to DB');

        // Create table if not exists
        await pool.query(`
      IF OBJECT_ID('dbo.users', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          username NVARCHAR(50) NOT NULL UNIQUE,
          password_hash NVARCHAR(255) NOT NULL,
          role NVARCHAR(20) NOT NULL CHECK (role IN ('KLIENT', 'PRACOWNIK'))
        );
        PRINT 'Table created';
      END
      ELSE
        PRINT 'Table already exists';
    `);

        // Check if users exist
        const count = await pool.query('SELECT COUNT(*) as c FROM dbo.users');
        if (count.recordset[0].c > 0) {
            console.log('Users already exist, skipping seed.');
            process.exit(0);
        }

        // Seed users
        const clientPass = await bcrypt.hash('client123', 10);
        const employeePass = await bcrypt.hash('employee123', 10);

        await pool.request()
            .input('p1', sql.NVarChar, clientPass)
            .input('p2', sql.NVarChar, employeePass)
            .query(`
        INSERT INTO dbo.users (username, password_hash, role) VALUES
        ('jan_nowak', @p1, 'KLIENT'),
        ('admin_sklepu', @p2, 'PRACOWNIK');
      `);

        console.log('Users seeded.');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

initUsers();
