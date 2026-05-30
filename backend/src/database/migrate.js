/**
 * migrate.js — Neon/PostgreSQL migration runner
 *
 * Usage:
 *   node src/database/migrate.js
 *   npm run migrate
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const SCHEMA_FILE = path.join(__dirname, 'schema.pg.sql');

function buildClientConfig() {
  const rawUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!rawUrl) {
    console.error('❌  NEON_DATABASE_URL (or DATABASE_URL) is not set in .env');
    process.exit(1);
  }

  // Strip SSL params from the URL — configure SSL programmatically instead
  const connectionString = rawUrl
    .replace(/[?&]sslmode=[^&]*/g, '')
    .replace(/[?&]channel_binding=[^&]*/g, '')
    .replace(/\?&/, '?')
    .replace(/\?$/, '');

  const isNeon = rawUrl.includes('neon.tech');

  return {
    connectionString,
    ...(isNeon && { ssl: { rejectUnauthorized: false } }),
  };
}

async function migrate() {
  const client = new Client(buildClientConfig());

  try {
    console.log('📡 Connecting to Neon PostgreSQL...');
    await client.connect();
    console.log('✅ Connected\n');

    // ── Run entire schema as one query (all statements already idempotent) ──
    const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
    console.log('⚙️  Applying schema (CREATE IF NOT EXISTS — safe to re-run)...');

    await client.query(sql);

    console.log('✅ Schema applied successfully\n');

    // ── Seed admin users from ADMIN_TELEGRAM_IDS env var ───────────────────
    const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (adminIds.length > 0) {
      console.log(`👤 Seeding ${adminIds.length} admin user(s)...`);
      for (const tgId of adminIds) {
        await client.query(
          `INSERT INTO users (telegram_id, first_name, is_admin)
           VALUES ($1, 'Admin', 1)
           ON CONFLICT (telegram_id) DO UPDATE SET is_admin = 1`,
          [BigInt(tgId)]
        );
        console.log(`   ✓ telegram_id=${tgId}`);
      }
      console.log('✅ Admin users seeded\n');
    }

    console.log('🎉 Migration complete — your Neon database is ready!\n');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
