/**
 * Shared server-side helpers for the `/api/*` handlers (Vercel functions and
 * the Vite dev middleware both import these).
 *
 * Everything here runs with the Firebase Admin SDK, which bypasses Firestore
 * security rules — so each handler must do its own authorisation.
 */
import fs from 'node:fs'
import path from 'node:path'
import admin from 'firebase-admin'

export function getEnv(name, fallback = '') {
  return (process.env[name] || fallback).trim()
}

function configError(message) {
  const err = new Error(message)
  err.code = 'notconfigured'
  return err
}

function loadServiceAccount() {
  const raw = getEnv('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      throw configError('FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON (use one line, or FIREBASE_SERVICE_ACCOUNT_PATH)')
    }
  }
  const rel = getEnv('FIREBASE_SERVICE_ACCOUNT_PATH')
  if (rel) {
    const file = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel)
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      throw configError(`Cannot read service account file: ${file} (${e.message})`)
    }
  }
  throw configError('Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH')
}

/** Idempotent — other handlers may have initialised the default app already. */
export function initAdmin() {
  if (admin.apps.length) return admin.app()
  const sa = loadServiceAccount()
  return admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: getEnv('VITE_FB_PROJECT_ID') || getEnv('FB_PROJECT_ID') || sa.project_id,
    storageBucket: bucketName(),
  })
}

function bucketName() {
  return getEnv('FIREBASE_STORAGE_BUCKET') || getEnv('VITE_FB_STORAGE_BUCKET')
}

/**
 * Named explicitly rather than relying on the default app's bucket, so this
 * works even when another handler initialised the app without a bucket.
 */
export function storageBucket() {
  const name = bucketName()
  if (!name) throw configError('Set FIREBASE_STORAGE_BUCKET (or VITE_FB_STORAGE_BUCKET)')
  return admin.storage().bucket(name)
}

/** Hard cap so a local Vite middleware cannot buffer a multi-GB body into RAM.
 *  Vercel already stops around 4.5 MB; this matches that on every runtime. */
export const MAX_JSON_BYTES = 4 * 1024 * 1024

function payloadTooLarge() {
  const e = new Error('payload')
  e.status = 413
  e.code = 'payload'
  throw e
}

export async function readJsonBody(req, { maxBytes = MAX_JSON_BYTES } = {}) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body) {
    if (Buffer.byteLength(req.body) > maxBytes) payloadTooLarge()
    try { return JSON.parse(req.body) } catch { return {} }
  }
  // Node IncomingMessage (Vite middleware)
  if (typeof req.on === 'function') {
    const chunks = []
    let n = 0
    for await (const chunk of req) {
      n += chunk.length
      if (n > maxBytes) payloadTooLarge()
      chunks.push(chunk)
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    if (!raw) return {}
    try { return JSON.parse(raw) } catch { return {} }
  }
  return {}
}

/** Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform. */
export function clientIp(req) {
  const xf = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
  if (xf) return xf.slice(0, 64)
  const real = String(req.headers?.['x-real-ip'] || '').trim()
  if (real) return real.slice(0, 64)
  return String(req.socket?.remoteAddress || 'unknown').slice(0, 64)
}

export function rateLimitDocId(prefix, raw) {
  const safe = String(raw || 'unknown').replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 80)
  return `${prefix}_${safe}`
}

/**
 * Cheap Firestore-backed counter. Callers bump after the protected work so a
 * rejected request still costs a slot — that is the point of a throttle.
 */
export async function assertRateLimit(db, id, { limit, windowMs, error = 'too_many' }) {
  const snap = await db.collection('rateLimits').doc(id).get()
  const d = snap.exists ? (snap.data() || {}) : null
  if (!d) return
  if (Date.now() - (d.windowStart || 0) > windowMs) return
  if ((d.count || 0) >= limit) {
    const e = new Error(error)
    e.status = 429
    e.code = error
    throw e
  }
}

export async function bumpRateLimit(db, id, { windowMs }) {
  const ref = db.collection('rateLimits').doc(id)
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const d = snap.exists ? (snap.data() || {}) : null
      const stale = !d || Date.now() - (d.windowStart || 0) > windowMs
      if (stale) tx.set(ref, { windowStart: Date.now(), count: 1 })
      else tx.update(ref, { count: (d.count || 0) + 1 })
    })
  } catch (e) {
    console.error('[rate-limit] bump', e)
  }
}

export function bearerToken(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || ''
  const m = String(h).match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : ''
}

export function jsonSender(res) {
  return (status, data) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(data))
  }
}

/** Resolves the caller's uid from the `Authorization: Bearer <idToken>` header. */
export async function verifyCaller(req) {
  const token = bearerToken(req)
  if (!token) return null
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    return decoded?.uid || null
  } catch {
    return null
  }
}

/**
 * Resolves a *customer's* uid, rejecting email accounts that never confirmed
 * their address. The app already blocks them in the UI, but a token minted
 * straight from the Firebase SDK bypasses that — and staff sign-in is exempt
 * on purpose, so this cannot live in `verifyCaller`.
 *
 * @returns {Promise<{ uid: string | null, reason?: 'auth' | 'unverified' }>}
 */
export async function verifyCustomer(req) {
  const token = bearerToken(req)
  if (!token) return { uid: null, reason: 'auth' }
  let decoded
  try {
    decoded = await admin.auth().verifyIdToken(token)
  } catch {
    return { uid: null, reason: 'auth' }
  }
  if (!decoded?.uid) return { uid: null, reason: 'auth' }
  if (decoded.firebase?.sign_in_provider === 'password' && decoded.email_verified !== true) {
    return { uid: null, reason: 'unverified' }
  }
  return { uid: decoded.uid }
}

export async function isAdminUid(db, uid) {
  if (!uid) return false
  const snap = await db.collection('admins').doc(uid).get()
  return snap.exists
}

/** Collision-safe document ids, matching the client's `nid()` shape. */
export const newId = (prefix) =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
