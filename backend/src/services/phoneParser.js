const { parsePhoneNumber, isValidPhoneNumber, AsYouType } = require('libphonenumber-js');

/**
 * Parse and validate a phone number string.
 *
 * @param {string} rawNumber - e.g. "+79183957013" or "79183957013"
 * @returns {{
 *   valid: boolean,
 *   cc: string|null,         // Country calling code, e.g. "7"
 *   localNumber: string|null, // Without country code, e.g. "9183957013"
 *   phoneFull: string|null,  // E.164 format, e.g. "+79183957013"
 *   isoCountry: string|null, // ISO 3166-1 alpha-2, e.g. "RU"
 *   error: string|null
 * }}
 */
function parsePhone(rawNumber) {
  if (!rawNumber || typeof rawNumber !== 'string') {
    return { valid: false, cc: null, localNumber: null, phoneFull: null, isoCountry: null, error: 'No number provided' };
  }

  // Normalize: keep only digits and leading +
  let normalized = rawNumber.trim();

  // Remove spaces, dashes, parentheses
  normalized = normalized.replace(/[\s\-().]/g, '');

  // Must start with + for international parsing
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }

  try {
    const parsed = parsePhoneNumber(normalized);

    if (!parsed) {
      return { valid: false, cc: null, localNumber: null, phoneFull: null, isoCountry: null, error: 'Unable to parse number' };
    }

    if (!parsed.isValid()) {
      return { valid: false, cc: null, localNumber: null, phoneFull: null, isoCountry: null, error: 'Invalid phone number' };
    }

    const cc = String(parsed.countryCallingCode);
    const phoneFull = parsed.format('E.164'); // e.g. +79183957013
    // Remove +cc from the front to get local number
    const localNumber = phoneFull.replace(`+${cc}`, '');

    return {
      valid: true,
      cc,
      localNumber,
      phoneFull,
      isoCountry: parsed.country || null,
      error: null,
    };
  } catch (err) {
    return {
      valid: false,
      cc: null,
      localNumber: null,
      phoneFull: null,
      isoCountry: null,
      error: `Parse error: ${err.message}`,
    };
  }
}

/**
 * Validate that a number belongs to a country we support (has an active price).
 * Accepts an array of active country codes from DB.
 */
function isSupportedCountry(cc, activeCountryCodes) {
  return activeCountryCodes.includes(String(cc));
}

module.exports = { parsePhone, isSupportedCountry };
