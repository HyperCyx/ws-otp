module.exports = {
  apps: [
    // ── Backend API ────────────────────────────────────────────
    {
      name: 'otp-api',
      script: './backend/server.js',
      cwd: __dirname,
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      env_file: './backend/.env',
      error_file: './backend/logs/pm2-error.log',
      out_file: './backend/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 10,
    },
    // ── Polling Worker ─────────────────────────────────────────
    {
      name: 'otp-worker',
      script: './backend/src/workers/pollingWorker.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_file: './backend/.env',
      error_file: './backend/logs/worker-error.log',
      out_file: './backend/logs/worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '256M',
      restart_delay: 5000,
      max_restarts: 20,
    },
  ],
};
