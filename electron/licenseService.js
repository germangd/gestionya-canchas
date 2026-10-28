'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const { app } = require('electron');

/** Prioridad: LICENSE_API_BASE (entorno) > licenseApiBase en package.json del build > fallback. */
const LICENSE_API_FALLBACK = 'https://tu-dominio.com/v1';

function getLicenseApiBase() {
  const fromEnv = String(process.env.LICENSE_API_BASE || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const fromPkg = String(pkg.licenseApiBase || '').trim();
      if (fromPkg) return fromPkg.replace(/\/+$/, '');
    }
  } catch (_) {}
  return LICENSE_API_FALLBACK;
}

function getUpdateFeedUrl() {
  const fromEnv = String(process.env.UPDATE_FEED_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  try {
    const pkgPath = path.join(app.getAppPath(), 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const fromPkg = String(pkg.updateFeedUrl || '').trim();
      if (fromPkg) return fromPkg.replace(/\/+$/, '');
    }
  } catch (_) {}
  const apiBase = getLicenseApiBase();
  if (!apiBase || apiBase === LICENSE_API_FALLBACK) return '';
  return `${apiBase}/app-updates`;
}

const LICENSE_FILE_NAME = 'license.json';
const JWT_ISS = 'gestionya-licensing';

let cachedPublicKey = null;

function getLicenseFilePath() {
  return path.join(app.getPath('userData'), LICENSE_FILE_NAME);
}

function getLicenseJwtPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;
  const fromEnv = String(process.env.LICENSE_JWT_PUBLIC_KEY || '')
    .trim()
    .replace(/\\n/g, '\n');
  if (fromEnv) {
    cachedPublicKey = fromEnv;
    return cachedPublicKey;
  }
  try {
    const pemPath = path.join(app.getAppPath(), 'assets', 'license-jwt-public.pem');
    if (fs.existsSync(pemPath)) {
      cachedPublicKey = fs.readFileSync(pemPath, 'utf8');
      return cachedPublicKey;
    }
  } catch (_) {}
  return null;
}

function safeReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function safeWriteJson(filePath, data) {
  const folder = path.dirname(filePath);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function getMachineFingerprint() {
  const raw = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.release(),
    process.env.PROCESSOR_IDENTIFIER || ''
  ].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function base64UrlDecode(value) {
  const b64 = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64');
}

function decodeJwtHeader(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    return JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
  } catch (_) {
    return null;
  }
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    return JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
  } catch (_) {
    return null;
  }
}

function verifyRs256LicenseToken(token, publicKeyPem) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeJwtHeader(token);
  if (!header || header.alg !== 'RS256') return null;

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  if (!verifier.verify(publicKeyPem, base64UrlDecode(signatureB64))) return null;

  const payload = decodeJwtPayload(token);
  if (!payload || payload.iss !== JWT_ISS) return null;
  return payload;
}

/**
 * RS256: verificación criptográfica local (tokens nuevos).
 * HS256 legacy: solo decodifica payload (migración); requiere heartbeat online para RS256.
 */
function verifyLicenseJwtPayload(token) {
  const header = decodeJwtHeader(token);
  if (!header?.alg) return { ok: false, reason: 'INVALID_TOKEN' };

  if (header.alg === 'RS256') {
    const publicKey = getLicenseJwtPublicKey();
    if (!publicKey) return { ok: false, reason: 'NO_VERIFY_KEY' };
    const payload = verifyRs256LicenseToken(token, publicKey);
    if (!payload) return { ok: false, reason: 'INVALID_SIGNATURE' };
    return { ok: true, payload, signatureVerified: true };
  }

  if (header.alg === 'HS256') {
    const payload = decodeJwtPayload(token);
    if (!payload || payload.iss !== JWT_ISS) return { ok: false, reason: 'INVALID_TOKEN' };
    return { ok: true, payload, signatureVerified: false };
  }

  return { ok: false, reason: 'UNSUPPORTED_ALG' };
}

function isTokenExpired(payload, nowMs = Date.now()) {
  if (!payload || typeof payload.exp !== 'number') return true;
  return nowMs >= payload.exp * 1000;
}

function isWithinGrace(payload, nowMs = Date.now()) {
  if (!payload) return false;
  if (typeof payload.grace_until === 'number') {
    return nowMs <= payload.grace_until * 1000;
  }
  if (typeof payload.grace_until === 'string') {
    const parsed = Date.parse(payload.grace_until);
    return !Number.isNaN(parsed) && nowMs <= parsed;
  }
  return false;
}

const REQUEST_TIMEOUT_MS = 30000;

function httpPostJson(url, body) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(new Error(`URL inválida del servidor de licencias: ${url}`));
      return;
    }

    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const transport = parsed.protocol === 'http:' ? http : https;
    const options = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    };

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode || 0, raw });
      });
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Tiempo de espera agotado contactando al servidor de licencias (${REQUEST_TIMEOUT_MS / 1000}s).`));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function postJson(url, body) {
  const { status, raw } = await httpPostJson(url, body);

  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    data = { ok: false, error: { code: 'INVALID_JSON_RESPONSE', message: 'Respuesta inválida del servidor.' } };
  }

  const ok = status >= 200 && status < 300;
  if (!ok) {
    const err = new Error(data?.error?.message || `HTTP ${status}`);
    err.code = data?.error?.code || `HTTP_${status}`;
    err.status = status;
    err.payload = data;
    throw err;
  }
  return data;
}

function loadLocalLicense() {
  return safeReadJson(getLicenseFilePath());
}

function saveLocalLicense(data) {
  safeWriteJson(getLicenseFilePath(), data);
}

function clearLocalLicense() {
  const fp = getLicenseFilePath();
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

function evaluateLocalLicense() {
  const local = loadLocalLicense();
  if (!local?.license_token) return { valid: false, mode: 'blocked', reason: 'NO_LOCAL_LICENSE' };

  const verification = verifyLicenseJwtPayload(local.license_token);
  if (!verification.ok) {
    return { valid: false, mode: 'blocked', reason: verification.reason || 'INVALID_TOKEN' };
  }
  const payload = verification.payload;

  const fingerprint = getMachineFingerprint();
  if (payload.device && payload.device !== fingerprint) {
    return { valid: false, mode: 'blocked', reason: 'DEVICE_MISMATCH' };
  }

  const base = { signatureVerified: !!verification.signatureVerified };

  if (!isTokenExpired(payload)) {
    return { valid: true, mode: 'full', reason: null, payload, ...base };
  }
  if (isWithinGrace(payload)) {
    return { valid: true, mode: 'grace', reason: 'TOKEN_EXPIRED_IN_GRACE', payload, ...base };
  }
  return { valid: false, mode: 'read_only', reason: 'TOKEN_EXPIRED_OUT_OF_GRACE', payload, ...base };
}

async function activateLicense(licenseKey, meta = {}) {
  const fingerprint = getMachineFingerprint();
  const data = await postJson(`${getLicenseApiBase()}/license/activate`, {
    license_key: licenseKey,
    fingerprint,
    device_name: meta.device_name || os.hostname(),
    os: `${os.platform()}-${os.release()}`,
    app_version: app.getVersion()
  });

  const local = {
    license_token: data.license_token,
    expires_at: data.expires_at || null,
    grace_until: data.grace_until || null,
    status: data.status || 'active',
    features: Array.isArray(data.features) ? data.features : [],
    fingerprint,
    updated_at: new Date().toISOString()
  };
  saveLocalLicense(local);
  return local;
}

async function validateOnline() {
  const local = loadLocalLicense();
  if (!local?.license_token) return { ok: true, valid: false, reason: 'NO_LOCAL_LICENSE' };
  return postJson(`${getLicenseApiBase()}/license/validate`, {
    license_token: local.license_token,
    fingerprint: getMachineFingerprint(),
    app_version: app.getVersion()
  });
}

async function heartbeat() {
  const local = loadLocalLicense();
  if (!local?.license_token) return { ok: true, valid: false, reason: 'NO_LOCAL_LICENSE' };

  const data = await postJson(`${getLicenseApiBase()}/license/heartbeat`, {
    license_token: local.license_token,
    fingerprint: getMachineFingerprint(),
    app_version: app.getVersion()
  });

  if (data?.ok && data?.valid && data?.rotated && data?.license_token) {
    saveLocalLicense({
      ...local,
      license_token: data.license_token,
      expires_at: data.expires_at || local.expires_at || null,
      grace_until: data.grace_until || local.grace_until || null,
      updated_at: new Date().toISOString()
    });
  }
  return data;
}

module.exports = {
  getMachineFingerprint,
  getLicenseApiBase,
  getUpdateFeedUrl,
  loadLocalLicense,
  saveLocalLicense,
  clearLocalLicense,
  evaluateLocalLicense,
  activateLicense,
  validateOnline,
  heartbeat
};
