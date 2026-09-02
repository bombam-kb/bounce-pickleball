/**
 * LINE Login → Firebase custom-token exchange (server-only).
 * Used by the Vercel `/api/auth/line` function and the Vite dev middleware.
 *
 * The browser only sends the OAuth `code`. The redirect URI is taken from a
 * server allowlist (never trusted from the body), the LINE `id_token` is
 * verified against this channel, and the IP is throttled so the public
 * endpoint cannot be used to burn LINE / Vercel quota.
 */
import admin from 'firebase-admin'
import {
  getEnv, initAdmin, readJsonBody, jsonSender, clientIp, rateLimitDocId,
  assertRateLimit, bumpRateLimit,
} from './serverAdmin.js'

const LINE_FAIL_LIMIT = 20
const LINE_FAIL_WINDOW_MS = 60 * 60 * 1000

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function allowedRedirectUris() {
  const origins = new Set([
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ])
  getEnv('LINE_REDIRECT_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean)
    .forEach((o) => origins.add(o.replace(/\/$/, '')))
  const pub = getEnv('VITE_PUBLIC_ORIGIN')
  if (pub) origins.add(pub.replace(/\/$/, ''))
  const vercel = getEnv('VERCEL_URL')
  if (vercel) origins.add(vercel.startsWith('http') ? vercel.replace(/\/$/, '') : `https://${vercel}`)
  return new Set([...origins].map((o) => `${o}/auth/line/callback`))
}

function pickRedirectUri(requested) {
  const allow = allowedRedirectUris()
  if (requested && allow.has(requested)) return requested
  return null
}

async function verifyLineIdToken(idToken, channelId, expectedSub) {
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.sub !== expectedSub || String(json.aud) !== channelId) {
    const e = new Error('line_id_token')
    e.status = 401
    e.code = 'line_id_token'
    throw e
  }
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleLineExchange(req, res) {
  const send = jsonSender(res)

  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.method !== 'POST') { send(405, { error: 'method' }); return }

  const channelId = getEnv('VITE_LINE_CHANNEL_ID') || getEnv('LINE_CHANNEL_ID')
  const channelSecret = getEnv('LINE_CHANNEL_SECRET')
  if (!channelId || !channelSecret) {
    send(500, { error: 'notconfigured' })
    return
  }

  let db
  try {
    initAdmin()
    db = admin.firestore()
  } catch (e) {
    console.error('[line-auth] admin init', e)
    send(500, { error: 'notconfigured' })
    return
  }

  const ipKey = rateLimitDocId('line', clientIp(req))
  try {
    await assertRateLimit(db, ipKey, { limit: LINE_FAIL_LIMIT, windowMs: LINE_FAIL_WINDOW_MS, error: 'too_many' })
  } catch (e) {
    send(e.status || 429, { error: e.code || 'too_many' })
    return
  }
  await bumpRateLimit(db, ipKey, { windowMs: LINE_FAIL_WINDOW_MS })

  let body
  try {
    body = await readJsonBody(req)
  } catch (e) {
    send(e.status === 413 ? 413 : 400, { error: e.code || 'badrequest' })
    return
  }

  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const requested = typeof body.redirectUri === 'string' ? body.redirectUri.trim() : ''
  const redirectUri = pickRedirectUri(requested)
  if (!code) { send(400, { error: 'badrequest' }); return }
  if (!redirectUri) { send(400, { error: 'badredirect' }); return }

  try {
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    })
    const tokenJson = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !tokenJson.access_token || !tokenJson.id_token) {
      send(401, { error: 'line_token' })
      return
    }

    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const profile = await profileRes.json().catch(() => ({}))
    if (!profileRes.ok || !profile.userId) {
      send(401, { error: 'line_profile' })
      return
    }

    await verifyLineIdToken(tokenJson.id_token, channelId, profile.userId)

    const uid = `line_${profile.userId}`
    const ref = db.collection('members').doc(uid)
    const snap = await ref.get()
    const name = (profile.displayName || 'LINE User').slice(0, 60)
    const avatarUrl = typeof profile.pictureUrl === 'string' ? profile.pictureUrl : ''

    if (!snap.exists) {
      await ref.set({
        name,
        email: '',
        phone: '',
        channel: 'line',
        country: 'TH',
        lang: 'th',
        avatar: '🏓',
        avatarUrl,
        lineUserId: profile.userId,
        stamps: 0,
        bookingsYear: 0,
        suspended: false,
        joined: todayISO(),
        birthday: null,
      })
    } else {
      const patch = { channel: 'line', lineUserId: profile.userId }
      if (avatarUrl) patch.avatarUrl = avatarUrl
      const cur = snap.data() || {}
      if (!cur.name) patch.name = name
      await ref.update(patch)
    }

    if (snap.exists && snap.data()?.suspended) {
      send(403, { error: 'suspended' })
      return
    }

    const firebaseToken = await admin.auth().createCustomToken(uid, {
      provider: 'line',
      lineUserId: profile.userId,
    })

    send(200, { token: firebaseToken })
  } catch (e) {
    if (e?.status) { send(e.status, { error: e.code }); return }
    const codeName = e?.code === 'notconfigured' ? 'notconfigured' : 'unknown'
    console.error('[line-auth]', e)
    send(500, { error: codeName })
  }
}
