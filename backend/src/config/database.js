const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

function buildPoolConfig() {
  // Prefer NEON_DATABASE_URL (external Neon DB) over the Replit-managed DATABASE_URL
  const connStr = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';
  const cfg = {
    connectionString: connStr,
    max: parseInt(process.env.DB_CONNECTION_LIMIT || '20'),
  };
  // Enable SSL for Neon / any sslmode=require connection string
  if (connStr.includes('sslmode=require') || connStr.includes('neon.tech')) {
    cfg.ssl = { rejectUnauthorized: false };
  }
  return cfg;
}

async function connectDB() {
  pool = new Pool(buildPoolConfig());

  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  return pool;
}

function getPool() {
  if (!pool) throw new Error('Database not initialized. Call connectDB() first.');
  return pool;
}

/**
 * Execute a query. Converts MySQL ? placeholders to PostgreSQL $1, $2, ...
 * Returns rows array directly (like mysql2 did).
 */
async function query(sql, params = []) {
  const pgSql = convertPlaceholders(sql);
  const result = await getPool().query(pgSql, params ?? []);
  return result.rows;
}

/**
 * Execute multiple operations in a transaction.
 * Automatically commits or rolls back.
 * The conn object exposes .execute() that mirrors mysql2 conn.execute().
 */
async function withTransaction(callback) {
  const client = await getPool().connect();
  await client.query('BEGIN');
  try {
    // Wrap client to mimic mysql2 conn interface used by walletService
    const conn = {
      execute: async (sql, params) => {
        const pgSql = convertPlaceholders(sql);
        const result = await client.query(pgSql, params ?? []);
        // mysql2 returns [rows, fields]; walletService uses [rows][0] or rows.length
        return [result.rows, result.fields];
      },
      query: async (sql, params) => {
        const pgSql = convertPlaceholders(sql);
        const result = await client.query(pgSql, params ?? []);
        return [result.rows, result.fields];
      },
    };
    const result = await callback(conn);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Convert MySQL ? placeholders to PostgreSQL $1, $2, ...
 * Also strips MySQL backtick identifiers.
 */
function convertPlaceholders(sql) {
  let index = 0;
  return sql
    .replace(/`([^`]*)`/g, '"$1"')
    .replace(/\?/g, () => `$${++index}`);
}

module.exports = { connectDB, getPool, query, withTransaction, convertPlaceholders };
