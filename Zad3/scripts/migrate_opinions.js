const path = require('path');
const { getPool } = require(path.join(__dirname, '../src/common/db'));
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrate() {
    try {
        const pool = await getPool();
        console.log('Connected to DB');

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
        PRINT 'Table order_opinions created';
      END
      ELSE
        PRINT 'Table order_opinions already exists';
    `);

        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
