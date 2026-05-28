const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true,
      charset: 'utf8mb4',
    });

    console.log('📡 Connected to MySQL');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('⚙️  Running migrations...');
    await connection.query(schema);
    console.log('✅ Database schema applied successfully');

    // Seed admin users from environment
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (adminIds.length > 0) {
      console.log(`👤 Seeding ${adminIds.length} admin user(s)...`);
      for (const tgId of adminIds) {
        await connection.query(
          `INSERT INTO otp_activation.users (telegram_id, first_name, is_admin)
           VALUES (?, 'Admin', 1)
           ON DUPLICATE KEY UPDATE is_admin = 1`,
          [BigInt(tgId)]
        );
      }
      console.log('✅ Admin users seeded');
    }

    console.log('🎉 Migration complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
