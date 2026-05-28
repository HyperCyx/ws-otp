const axios = require('axios');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { get: redisGet, set: redisSet, del: redisDel } = require('../config/redis');
const { logApiCall } = require('../utils/apiLogger');
const querystring = require('querystring');

const BASE_URL = process.env.EXTERNAL_API_BASE;
const TOKEN_TTL_MS = parseInt(process.env.TOKEN_TTL_MS || '18000000');
const REFRESH_BUFFER_MS = parseInt(process.env.TOKEN_REFRESH_BUFFER_MS || '600000');

const GLOBAL_TOKEN_KEY = 'ext_api_token';

let globalTokenStore = { token: null, expiresAt: null };

const countryTokenStores = new Map();

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValid(store) {
  return store?.token && store?.expiresAt > Date.now() + REFRESH_BUFFER_MS;
}

async function loginWith(account, password, identity = 'Member') {
  const start = Date.now();
  const payload = { account, password, identity };

  async function attemptLoginRequest(requestConfig) {
    return apiClient.request(requestConfig);
  }

  async function tryLoginVariants() {
    const attempts = [
      { method: 'POST', url: '/user/login', data: payload, headers: { 'Content-Type': 'application/json' } },
      {
        method: 'POST',
        url: '/user/login',
        data: querystring.stringify(payload),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
      { method: 'GET', url: '/user/login', params: payload },
    ];

    let lastError;
    for (const config of attempts) {
      try {
        return await attemptLoginRequest(config);
      } catch (err) {
        lastError = err;
        if (err.response?.status !== 405) throw err;
        logger.warn('Login attempt returned 405, trying compatibility fallback', {
          account,
          method: config.method,
          contentType: config.headers?.['Content-Type'],
        });
      }
    }

    throw lastError;
  }

  try {
    const response = await tryLoginVariants();

    if (!response.data?.success || !response.data?.data?.token) {
      throw new Error('Login API returned invalid response: ' + JSON.stringify(response.data));
    }

    const token = response.data.data.token;
    const expiresAt = Date.now() + TOKEN_TTL_MS;

    await logApiCall('/user/login', 'POST', { account, identity }, { success: true }, 200, Date.now() - start);
    logger.info(`External API login successful for account: ${account}`);
    return { token, expiresAt };
  } catch (err) {
    const errMsg = err.response?.data || err.message;
    await logApiCall('/user/login', 'POST', { account, identity }, null, err.response?.status, Date.now() - start, String(errMsg));
    logger.error(`External API login failed for account: ${account}`, { error: errMsg });
    throw err;
  }
}

async function login() {
  const result = await loginWith(
    process.env.EXTERNAL_API_ACCOUNT,
    process.env.EXTERNAL_API_PASSWORD,
    process.env.EXTERNAL_API_IDENTITY || 'Member'
  );
  const { token, expiresAt } = result;

  globalTokenStore = { token, expiresAt };

  await redisSet(GLOBAL_TOKEN_KEY, { token, expiresAt }, Math.floor(TOKEN_TTL_MS / 1000) - 60);

  await query(
    `INSERT INTO token_cache (key_name, value, expires_at)
     VALUES (?, ?, ?)
     ON CONFLICT (key_name) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
    [GLOBAL_TOKEN_KEY, JSON.stringify({ token, expiresAt }), new Date(expiresAt)]
  );

  return token;
}

async function getToken() {
  if (isValid(globalTokenStore)) return globalTokenStore.token;

  const cached = await redisGet(GLOBAL_TOKEN_KEY);
  if (isValid(cached)) {
    globalTokenStore = cached;
    return cached.token;
  }

  const [dbRow] = await query(
    `SELECT value, expires_at FROM token_cache WHERE key_name = ? AND expires_at > ?`,
    [GLOBAL_TOKEN_KEY, new Date(Date.now() + REFRESH_BUFFER_MS)]
  );
  if (dbRow) {
    const parsed = JSON.parse(dbRow.value);
    globalTokenStore = parsed;
    return parsed.token;
  }

  return login();
}

async function getCountryCreds(cc) {
  const [row] = await query(
    `SELECT api_account, api_password, api_identity FROM country_prices
     WHERE cc = ? AND api_account IS NOT NULL AND api_password IS NOT NULL`,
    [cc]
  );
  return row || null;
}

async function loginForCountry(cc, account, password, identity = 'Member') {
  const { token, expiresAt } = await loginWith(account, password, identity);
  const redisKey = `ext_api_token:${cc}`;

  countryTokenStores.set(cc, { token, expiresAt });

  await redisSet(redisKey, { token, expiresAt }, Math.floor(TOKEN_TTL_MS / 1000) - 60);

  await query(
    `INSERT INTO country_token_cache (cc, token, expires_at)
     VALUES (?, ?, ?)
     ON CONFLICT (cc) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
    [cc, token, new Date(expiresAt)]
  );

  logger.info(`Token refreshed for country cc=${cc}`);
  return token;
}

async function getTokenForCountry(cc) {
  const memStore = countryTokenStores.get(cc);
  if (isValid(memStore)) return memStore.token;

  const redisKey = `ext_api_token:${cc}`;
  const cached = await redisGet(redisKey);
  if (isValid(cached)) {
    countryTokenStores.set(cc, cached);
    return cached.token;
  }

  const [dbRow] = await query(
    `SELECT token, expires_at FROM country_token_cache
     WHERE cc = ? AND expires_at > ?`,
    [cc, new Date(Date.now() + REFRESH_BUFFER_MS)]
  );
  if (dbRow) {
    const store = { token: dbRow.token, expiresAt: new Date(dbRow.expires_at).getTime() };
    countryTokenStores.set(cc, store);
    return store.token;
  }

  const creds = await getCountryCreds(cc);
  if (creds) {
    return loginForCountry(cc, creds.api_account, creds.api_password, creds.api_identity || 'Member');
  }

  const err = new Error(`No API credentials configured for country +${cc}. Admin must add credentials in the panel before this country can be used.`);
  err.statusCode = 503;
  throw err;
}

async function clearCountryToken(cc) {
  countryTokenStores.delete(cc);
  await redisDel(`ext_api_token:${cc}`);
  await query(`DELETE FROM country_token_cache WHERE cc = ?`, [cc]);
  logger.info(`Token cache cleared for country cc=${cc}`);
}

async function makeRequest(method, endpoint, { params, data, retries = 3 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const start = Date.now();
    try {
      const token = await getToken();
      const resp = await apiClient.request({
        method, url: endpoint,
        headers: { 'admin-token': token },
        params, data,
      });
      await logApiCall(endpoint, method.toUpperCase(), data || params, resp.data, resp.status, Date.now() - start);
      return resp.data;
    } catch (err) {
      const status = err.response?.status;
      await logApiCall(endpoint, method.toUpperCase(), data || params, err.response?.data, status, Date.now() - start, err.message);

      if (status === 401) {
        logger.warn(`Global 401 on attempt ${attempt}, forcing re-login`);
        globalTokenStore = { token: null, expiresAt: null };
        await login();
        lastError = err;
        continue;
      }

      if (attempt < retries) {
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        logger.warn(`API request failed (attempt ${attempt}/${retries}), retrying in ${delay}ms`, { endpoint, error: err.message });
        await sleep(delay);
        lastError = err;
        continue;
      }
      lastError = err;
    }
  }
  if (lastError?.response?.status === 405) {
    const origMethod = method.toUpperCase();
    const altMethod = origMethod === 'POST' ? 'GET' : 'POST';

    try {
      const start = Date.now();
      const token = await getToken();
      const resp = await apiClient.request({ method: altMethod, url: endpoint, headers: { 'admin-token': token }, params, data });
      await logApiCall(endpoint, altMethod.toUpperCase(), data || params, resp.data, resp.status, Date.now() - start);
      logger.info(`Retried API request with ${altMethod} after 405 and it succeeded`, { endpoint });
      return resp.data;
    } catch (err2) {
      logger.warn('Alternate-method retry failed, trying compatibility fallbacks', { endpoint, error: err2.message });
    }

    const payload = data && Object.keys(data).length ? data : params || {};

    try {
      const start = Date.now();
      const token = await getToken();
      const resp = await apiClient.request({ method: 'POST', url: endpoint, headers: { 'admin-token': token, 'Content-Type': 'application/json' }, data: payload });
      await logApiCall(endpoint, 'POST', payload, resp.data, resp.status, Date.now() - start);
      logger.info('Compatibility fallback: POST with JSON body succeeded', { endpoint });
      return resp.data;
    } catch (err3) {
      logger.warn('POST JSON fallback failed', { endpoint, error: err3.message });
    }

    try {
      const start = Date.now();
      const token = await getToken();
      const formBody = querystring.stringify(payload);
      const resp = await apiClient.request({ method: 'POST', url: endpoint, headers: { 'admin-token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, data: formBody });
      await logApiCall(endpoint, 'POST', payload, resp.data, resp.status, Date.now() - start);
      logger.info('Compatibility fallback: POST form-encoded body succeeded', { endpoint });
      return resp.data;
    } catch (err4) {
      logger.warn('POST form-encoded fallback failed', { endpoint, error: err4.message });
    }

    const altAuthHeaders = ['token', 'Token', 'authorization', 'Authorization'];
    for (const hdr of altAuthHeaders) {
      try {
        const start = Date.now();
        const token = await getToken();
        const headers = { [hdr]: token };
        const reqOpts = origMethod === 'GET' ? { method: 'GET', url: endpoint, headers, params } : { method: origMethod, url: endpoint, headers, data: payload };
        const resp = await apiClient.request(reqOpts);
        await logApiCall(endpoint, reqOpts.method.toUpperCase(), payload, resp.data, resp.status, Date.now() - start);
        logger.info(`Compatibility fallback: request succeeded using auth header '${hdr}'`, { endpoint, hdr });
        return resp.data;
      } catch (err5) {
        logger.debug(`Auth-header fallback '${hdr}' failed`, { endpoint, hdr, error: err5.message });
      }
    }

    logger.error('All compatibility fallbacks failed after 405', { endpoint });
    throw lastError;
  }

  throw lastError;
}

async function makeRequestForCountry(cc, method, endpoint, { params, data, retries = 3 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const start = Date.now();
    try {
      const token = await getTokenForCountry(cc);
      const resp = await apiClient.request({
        method, url: endpoint,
        headers: { 'admin-token': token },
        params, data,
      });
      await logApiCall(endpoint, method.toUpperCase(), data || params, resp.data, resp.status, Date.now() - start);
      return resp.data;
    } catch (err) {
      const status = err.response?.status;
      await logApiCall(endpoint, method.toUpperCase(), data || params, err.response?.data, status, Date.now() - start, err.message);

      if (status === 401) {
        logger.warn(`Country cc=${cc} 401 on attempt ${attempt}, forcing re-login`);
        await clearCountryToken(cc);
        const creds = await getCountryCreds(cc);
        if (creds) {
          await loginForCountry(cc, creds.api_account, creds.api_password, creds.api_identity || 'Member');
        } else {
          globalTokenStore = { token: null, expiresAt: null };
          await login();
        }
        lastError = err;
        continue;
      }

      if (attempt < retries) {
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        logger.warn(`Country cc=${cc} request failed (attempt ${attempt}/${retries}), retrying in ${delay}ms`, { endpoint, error: err.message });
        await sleep(delay);
        lastError = err;
        continue;
      }
      lastError = err;
    }
  }
  if (lastError?.response?.status === 405) {
    const origMethod = method.toUpperCase();
    const altMethod = origMethod === 'POST' ? 'GET' : 'POST';

    try {
      const start = Date.now();
      const token = await getTokenForCountry(cc);
      const resp = await apiClient.request({ method: altMethod, url: endpoint, headers: { 'admin-token': token }, params, data });
      await logApiCall(endpoint, altMethod.toUpperCase(), data || params, resp.data, resp.status, Date.now() - start);
      logger.info(`Retried country request cc=${cc} with ${altMethod} after 405 and it succeeded`, { endpoint, cc });
      return resp.data;
    } catch (err2) {
      logger.warn('Alternate-method retry failed for country, trying compatibility fallbacks', { endpoint, cc, error: err2.message });
    }

    const payload = data && Object.keys(data).length ? data : params || {};

    try {
      const start = Date.now();
      const token = await getTokenForCountry(cc);
      const resp = await apiClient.request({ method: 'POST', url: endpoint, headers: { 'admin-token': token, 'Content-Type': 'application/json' }, data: payload });
      await logApiCall(endpoint, 'POST', payload, resp.data, resp.status, Date.now() - start);
      logger.info('Country compatibility fallback: POST with JSON body succeeded', { endpoint, cc });
      return resp.data;
    } catch (err3) {
      logger.warn('Country POST JSON fallback failed', { endpoint, cc, error: err3.message });
    }

    try {
      const start = Date.now();
      const token = await getTokenForCountry(cc);
      const formBody = querystring.stringify(payload);
      const resp = await apiClient.request({ method: 'POST', url: endpoint, headers: { 'admin-token': token, 'Content-Type': 'application/x-www-form-urlencoded' }, data: formBody });
      await logApiCall(endpoint, 'POST', payload, resp.data, resp.status, Date.now() - start);
      logger.info('Country compatibility fallback: POST form-encoded succeeded', { endpoint, cc });
      return resp.data;
    } catch (err4) {
      logger.warn('Country POST form-encoded fallback failed', { endpoint, cc, error: err4.message });
    }

    const altAuthHeaders = ['token', 'Token', 'authorization', 'Authorization'];
    for (const hdr of altAuthHeaders) {
      try {
        const start = Date.now();
        const token = await getTokenForCountry(cc);
        const headers = { [hdr]: token };
        const reqOpts = origMethod === 'GET' ? { method: 'GET', url: endpoint, headers, params } : { method: origMethod, url: endpoint, headers, data: payload };
        const resp = await apiClient.request(reqOpts);
        await logApiCall(endpoint, reqOpts.method.toUpperCase(), payload, resp.data, resp.status, Date.now() - start);
        logger.info(`Country compatibility fallback succeeded using auth header '${hdr}'`, { endpoint, cc, hdr });
        return resp.data;
      } catch (err5) {
        logger.debug(`Country auth-header fallback '${hdr}' failed`, { endpoint, cc, hdr, error: err5.message });
      }
    }

    logger.error('All country compatibility fallbacks failed after 405', { endpoint, cc });
    throw lastError;
  }

  throw lastError;
}

async function getCountries() {
  return makeRequest('GET', '/user/getCountry');
}

async function addNumber(cc, phoneNum) {
  return makeRequestForCountry(cc, 'POST', `/z-number-base/addNum`, {
    params: { cc, phoneNum, smsStatus: 2 },
  });
}

async function getNumberList(page = 1, pageSize = 100) {
  return makeRequest('GET', '/z-number-base/getAullNum', {
    params: { page, pageSize },
  });
}

async function getNumberListForCountry(cc, page = 1, pageSize = 100) {
  return makeRequestForCountry(cc, 'GET', '/z-number-base/getAullNum', {
    params: { page, pageSize },
  });
}

async function uploadOtp(phoneNum, code) {
  return makeRequest('GET', '/z-number-base/allNum/uploadCode', {
    params: { phoneNum, code },
  });
}

async function uploadOtpForCountry(cc, phoneNum, code) {
  return makeRequestForCountry(cc, 'GET', '/z-number-base/allNum/uploadCode', {
    params: { phoneNum, code },
  });
}

// Extract the records array from whatever shape the API returns
function extractRecordList(response) {
  const candidates = [response, response?.data, response?.list, response?.rows, response?.records, response?.items];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    if (Array.isArray(c?.data))    return c.data;
    if (Array.isArray(c?.records)) return c.records;
    if (Array.isArray(c?.list))    return c.list;
    if (Array.isArray(c?.rows))    return c.rows;
    if (Array.isArray(c?.items))   return c.items;
  }
  return [];
}

async function deleteNumberForCountry(cc, phoneLocal) {
  const normalizeDigits = (v) => String(v || '').replace(/\D/g, '');
  const localNorm = normalizeDigits(phoneLocal);

  // Step 1: fetch the number list and locate the record by phoneNum → get its id
  let recordId = null;
  try {
    const response = await getNumberListForCountry(cc, 1, 200);
    const list = extractRecordList(response);
    const match = list.find((item) => {
      const providerNorm = normalizeDigits(item.phoneNum ?? item.phone ?? item.phoneNumber ?? item.msisdn ?? '');
      return (
        providerNorm === localNorm ||
        providerNorm.endsWith(localNorm) ||
        localNorm.endsWith(providerNorm)
      );
    });
    if (match?.id) {
      recordId = match.id;
      // Use the cc from the API record itself — guarantees the right country token
      const recordCc = String(match.cc || cc);
      logger.info(`deleteNumberForCountry: found record id=${recordId} cc=${recordCc} for phoneLocal=${phoneLocal}`);
      // Correct endpoint: DELETE /z-number-base/deleteNum/{id}  (id in path, HTTP DELETE)
      return makeRequestForCountry(recordCc, 'DELETE', `/z-number-base/deleteNum/${recordId}`, {});
    }
    logger.warn(`deleteNumberForCountry: no record found for phoneLocal=${phoneLocal} in list of ${list.length}`, { cc });
  } catch (lookupErr) {
    logger.warn('deleteNumberForCountry: list lookup failed, will try phoneNum fallback', { cc, phoneLocal, error: lookupErr.message });
  }

  // Fallback — delete by phone number using the original cc (best-effort)
  logger.warn('deleteNumberForCountry: falling back to phoneNum delete', { cc, phoneLocal });
  return makeRequestForCountry(cc, 'DELETE', `/z-number-base/deleteNum/${phoneLocal}`, {});
}

// ── Per-country scheduled token refreshers ─────────────────────────────────
const countryRefreshIntervals = new Map(); // cc -> intervalHandle

async function startCountryTokenRefresher(cc, account, password, identity = 'Member') {
  // Stop any existing refresher for this country first
  if (countryRefreshIntervals.has(cc)) {
    clearInterval(countryRefreshIntervals.get(cc));
    countryRefreshIntervals.delete(cc);
  }

  // Login immediately to get a fresh token right now
  try {
    await loginForCountry(cc, account, password, identity);
    logger.info(`Token generated for country cc=${cc}, account=${account}`);
  } catch (err) {
    logger.error(`Initial token generation failed for cc=${cc}`, { error: err.message });
  }

  // Schedule proactive refresh before the token expires
  const intervalMs = TOKEN_TTL_MS - REFRESH_BUFFER_MS;
  const handle = setInterval(async () => {
    try {
      await loginForCountry(cc, account, password, identity);
      logger.info(`Token auto-refreshed for country cc=${cc}`);
    } catch (err) {
      logger.error(`Scheduled token refresh failed for cc=${cc}`, { error: err.message });
    }
  }, intervalMs);

  countryRefreshIntervals.set(cc, handle);
  logger.info(`Token refresher scheduled for cc=${cc} every ${Math.round(intervalMs / 60000)} minutes`);
}

function stopCountryTokenRefresher(cc) {
  if (countryRefreshIntervals.has(cc)) {
    clearInterval(countryRefreshIntervals.get(cc));
    countryRefreshIntervals.delete(cc);
    logger.info(`Token refresher stopped for country cc=${cc}`);
  }
}

async function startTokenRefresher() {
  // Start scheduled refreshers for every country that has credentials configured
  try {
    const countries = await query(
      `SELECT cc, api_account, api_password, api_identity
       FROM country_prices
       WHERE api_account IS NOT NULL AND api_password IS NOT NULL`
    );

    if (!countries.length) {
      logger.info('No country credentials configured yet — add them via the admin panel');
      return;
    }

    for (const c of countries) {
      await startCountryTokenRefresher(c.cc, c.api_account, c.api_password, c.api_identity || 'Member');
    }

    logger.info(`Per-country token refreshers started for ${countries.length} country/countries`);
  } catch (err) {
    logger.error('Failed to start country token refreshers on startup', { error: err.message });
  }
}

function stopTokenRefresher() {
  for (const [cc, handle] of countryRefreshIntervals.entries()) {
    clearInterval(handle);
    logger.info(`Token refresher stopped for country cc=${cc}`);
  }
  countryRefreshIntervals.clear();
}

module.exports = {
  login,
  getToken,
  loginForCountry,
  getTokenForCountry,
  clearCountryToken,
  getCountryCreds,
  getCountries,
  addNumber,
  getNumberList,
  getNumberListForCountry,
  uploadOtp,
  uploadOtpForCountry,
  deleteNumberForCountry,
  startTokenRefresher,
  stopTokenRefresher,
  startCountryTokenRefresher,
  stopCountryTokenRefresher,
};
