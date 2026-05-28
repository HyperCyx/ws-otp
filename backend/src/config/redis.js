const Redis = require('ioredis');
const logger = require('../utils/logger');

let client;

// ── In-Memory Redis Mock Fallback ───────────────────────────────────────────
class MemoryRedisMock {
  constructor() {
    this.store = new Map();
    this.ttls = new Map();
    this.handlers = {};
  }

  on(event, handler) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(handler);
    return this;
  }

  emit(event, ...args) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(h => h(...args));
    }
  }

  async connect() {
    setTimeout(() => this.emit('ready'), 50);
    return this;
  }

  async get(key) {
    this._checkExpiry(key);
    return this.store.get(key) || null;
  }

  async set(key, value, ...args) {
    this.store.set(key, value);
    if (args[0] === 'EX') {
      const seconds = parseInt(args[1]);
      if (!isNaN(seconds)) {
        this.ttls.set(key, Date.now() + seconds * 1000);
      }
    }
    return 'OK';
  }

  async del(key) {
    const existed = this.store.delete(key);
    this.ttls.delete(key);
    return existed ? 1 : 0;
  }

  async incr(key) {
    this._checkExpiry(key);
    let val = parseInt(this.store.get(key) || '0');
    if (isNaN(val)) val = 0;
    val += 1;
    this.store.set(key, String(val));
    return val;
  }

  async expire(key, seconds) {
    if (this.store.has(key)) {
      this.ttls.set(key, Date.now() + seconds * 1000);
      return 1;
    }
    return 0;
  }

  async call(command, ...args) {
    const cmd = command.toLowerCase();
    if (cmd === 'get') return this.get(args[0]);
    if (cmd === 'set') return this.set(args[0], args[1], ...args.slice(2));
    if (cmd === 'del') return this.del(args[0]);
    if (cmd === 'incr') return this.incr(args[0]);
    if (cmd === 'expire') return this.expire(args[0], args[1]);
    if (cmd === 'script') {
      if (args[0] && args[0].toLowerCase() === 'load') {
        return '2b1a6eb64047a24e930f30501a1d1d30505a5a5a'; // return dummy SHA1 hash
      }
    }
    if (cmd === 'eval' || cmd === 'evalsha') {
      return [1, 900000];
    }
    return null;
  }

  _checkExpiry(key) {
    if (this.ttls.has(key)) {
      if (Date.now() > this.ttls.get(key)) {
        this.store.delete(key);
        this.ttls.delete(key);
      }
    }
  }
}

async function connectRedis() {
  // Support REDIS_URL (used by Render, Railway, Heroku, etc.)
  // OR individual REDIS_HOST / REDIS_PORT / REDIS_PASSWORD variables
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;

  const hasRedisConfig = redisUrl || redisHost || redisPort;

  if (!hasRedisConfig) {
    logger.warn(
      '⚠️ No Redis config found (REDIS_URL / REDIS_HOST not set). ' +
      'Using in-memory mock — data will NOT persist across restarts. ' +
      'Set REDIS_URL in your environment (e.g. on Render: New → Redis → copy Internal URL).'
    );
    client = new MemoryRedisMock();
    await client.connect();
    return client;
  }

  try {
    // Build ioredis options: prefer REDIS_URL, fall back to host/port/password
    const redisOptions = redisUrl
      ? {
          // Parse from URL; ioredis accepts a connection string directly
          // but we still set keyPrefix and retry options
          lazyConnect: true,
          retryStrategy(times) {
            if (times > 1) return null;
            return 50;
          },
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          keyPrefix: process.env.REDIS_PREFIX || 'otp:',
          // If the URL uses rediss:// (TLS), ioredis handles it automatically
          tls: redisUrl.startsWith('rediss://') ? {} : undefined,
        }
      : {
          host: redisHost || 'localhost',
          port: parseInt(redisPort || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          keyPrefix: process.env.REDIS_PREFIX || 'otp:',
          retryStrategy(times) {
            if (times > 1) return null;
            return 50;
          },
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          lazyConnect: true,
        };

    const tempClient = redisUrl
      ? new Redis(redisUrl, redisOptions)
      : new Redis(redisOptions);

    tempClient.on('error', (err) => {
      if (!client || !(client instanceof MemoryRedisMock)) {
        logger.warn('⚠️ Real Redis connection failed, falling back to local in-memory mock', { error: err.message });
        client = new MemoryRedisMock();
        client.connect();
      }
    });

    await tempClient.connect();
    client = tempClient;
    client.on('error', (err) => logger.error('Redis error', { error: err.message }));
    client.on('reconnecting', () => logger.warn('Redis reconnecting...'));
    client.on('ready', () => logger.info('✅ Redis connection ready'));
    logger.info('✅ Redis connected successfully', { via: redisUrl ? 'REDIS_URL' : `${redisHost}:${redisPort}` });
    return client;
  } catch (err) {
    logger.warn('⚠️ Real Redis connection threw error. Falling back to local in-memory mock Redis!', { error: err.message });
    client = new MemoryRedisMock();
    await client.connect();
    return client;
  }
}

function getRedis() {
  if (!client) {
    logger.warn('⚠️ getRedis() called before initialization, returning temporary local memory mock');
    return new MemoryRedisMock();
  }
  return client;
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function get(key) {
  const val = await getRedis().get(key);
  if (!val) return null;
  try { return JSON.parse(val); } catch { return val; }
}

async function set(key, value, ttlSeconds) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (ttlSeconds) {
    return getRedis().set(key, serialized, 'EX', ttlSeconds);
  }
  return getRedis().set(key, serialized);
}

async function del(key) {
  return getRedis().del(key);
}

async function incr(key) {
  return getRedis().incr(key);
}

async function expire(key, seconds) {
  return getRedis().expire(key, seconds);
}

module.exports = { connectRedis, getRedis, get, set, del, incr, expire };
