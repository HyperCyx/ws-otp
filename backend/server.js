require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const { validateEnv } = require('./src/config/env');
const { connectDB } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');
const { initSocketServer } = require('./src/services/socketService');
const { startTokenRefresher } = require('./src/services/externalApi');
const { resumePollingOnStartup } = require('./src/workers/pollingWorker');
const logger = require('./src/utils/logger');
const { morganStream } = require('./src/utils/logger');

// Routes
const authRoutes = require('./src/routes/auth');
const activationRoutes = require('./src/routes/activations');
const walletRoutes = require('./src/routes/wallet');
const withdrawalRoutes = require('./src/routes/withdrawals');
const countryRoutes = require('./src/routes/countries');
const adminRoutes = require('./src/routes/admin');

// Validate environment
validateEnv();

const app = express();
const server = http.createServer(app);

// ── Socket.IO ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});
initSocketServer(io);

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://telegram.org'],
      frameSrc: ['https://telegram.org'],
    },
  },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(morgan('combined', { stream: morganStream }));

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/activations', activationRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/countries', countryRoutes);
app.use('/api/admin', adminRoutes);

// ── Public settings (language, min withdrawal) ─────────────────────────────
app.get('/api/settings', require('./src/middleware/auth').requireAuth, async (req, res, next) => {
  try {
    const { query: dbQuery } = require('./src/config/database');
    const rows = await dbQuery(`SELECT key, value FROM app_settings WHERE key IN ('default_language','min_withdrawal_amount')`);
    const result = {};
    rows.forEach((r) => { result[r.key] = r.value; });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── Public payment methods (enabled only) ──────────────────────────────────
app.get('/api/payment-methods', require('./src/middleware/auth').requireAuth, async (req, res, next) => {
  try {
    const { query: dbQuery } = require('./src/config/database');
    const rows = await dbQuery(
      `SELECT method_id, label FROM payment_methods WHERE is_enabled = TRUE ORDER BY id`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// ── 404 Handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global Error Handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message;

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ── Startup ────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await connectDB();
    logger.info('✅ PostgreSQL (Neon) connected');

    await connectRedis();
    logger.info('✅ Redis connected');

    await startTokenRefresher();
    logger.info('✅ External API token refresher started');

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📡 WebSocket server ready`);
    });

    // Resume polling for any activations that were in-flight before restart
    await resumePollingOnStartup();
  } catch (err) {
    logger.error('Fatal startup error', { error: err.message });
    process.exit(1);
  }
}

// ── Graceful Shutdown ──────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    message: reason?.message || reason,
    stack: reason?.stack,
  });
  process.exit(1);
});

startServer();

module.exports = { app, server, io };
