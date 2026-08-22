/**
 * LINE Login → Firebase custom-token exchange (server-only).
 * Used by the Vercel `/api/auth/line` function and the Vite dev middleware.
 */
import fs from 'node:fs'
import path from 'node:path'
import admin from 'firebase-admin'

function getEnv(name, fallback = '') {
  return (process.env[name] || fallback).trim()
}

function loadServiceAccount() {
  const raw = getEnv('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      const err = new Error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON (use one line, or FIREBASE_SERVICE_ACCOUNT_PATH)')
      err.code = 'notconfigured'
      throw err
    }
  }

  const rel = getEnv('FIREBASE_SERVICE_ACCOUNT_PATH')
  if (rel) {
    const file = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel)
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      const err = new Error(`Cannot read service account file: ${file} (${e.message})`)
      err.code = 'notconfigured'
      throw err
    }
  }

  const err = new Error('Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH')
  err.code = 'notconfigured'
  throw err
}

function initAdmin() {
  if (admin.apps.length) return admin.app()

  const projectId = getEnv('VITE_FB_PROJECT_ID') || getEnv('FB_PROJECT_ID')
  const sa = loadServiceAccount()

  return admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: projectId || sa.project_id,
  })
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body) {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  // Node IncomingMessage (Vite middleware)
  if (typeof req.on === 'function') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8')
    if (!raw) return {}
    try { return JSON.parse(raw) } catch { return {} }
  }
  return {}
}

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function retargetUserId(db, col, fromId, intoId) {
  const snap = await db.collection(col).where('userId', '==', fromId).get()
  if (snap.empty) return 0
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch()
    docs.slice(i, i + 400).forEach((d) => batch.update(d.ref, { userId: intoId }))
    await batch.commit()
  }
  return docs.length
}

/** LINE user IDs are unique per Login channel. A new channel looks like a new person. */
async function adoptLineTwin(db, uid, name) {
  const n = (name || '').trim()
  if (!n) return
  const q = await db.collection('members').where('name', '==', n).get()
  const twins = q.docs.filter((d) => {
    if (d.id === uid) return false
    const ch = d.data()?.channel
    return ch === 'line' || String(d.id).startsWith('line_')
  })
  if (twins.length !== 1) return
  const fromId = twins[0].id
  const from = twins[0].data() || {}
  const intoSnap = await db.collection('members').doc(uid).get()
  const into = intoSnap.data() || {}

  await retargetUserId(db, 'bookings', fromId, uid)
  await retargetUserId(db, 'vouchers', fromId, uid)
  await retargetUserId(db, 'stampLog', fromId, uid)

  const batch = db.batch()
  let stamps = (into.stamps || 0) + (from.stamps || 0)
  while (stamps >= 10) stamps -= 10
  batch.update(db.collection('members').doc(uid), {
    stamps,
    bookingsYear: (into.bookingsYear || 0) + (from.bookingsYear || 0),
    previousMemberIds: [...(into.previousMemberIds || []), fromId],
  })
  batch.delete(db.collection('members').doc(fromId))
  await batch.commit()
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleLineExchange(req, res) {
  const send = (status, data) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(data))
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'POST') {
    send(405, { error: 'method' })
    return
  }

  const channelId = getEnv('VITE_LINE_CHANNEL_ID') || getEnv('LINE_CHANNEL_ID')
  const channelSecret = getEnv('LINE_CHANNEL_SECRET')
  if (!channelId || !channelSecret) {
    send(500, { error: 'notconfigured', detail: 'LINE channel env missing' })
    return
  }

  let body
  try {
    body = await readJsonBody(req)
  } catch {
    send(400, { error: 'badrequest' })
    return
  }

  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri.trim() : ''
  if (!code || !redirectUri) {
    send(400, { error: 'badrequest' })
    return
  }

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
    if (!tokenRes.ok || !tokenJson.access_token) {
      send(401, { error: 'line_token', detail: tokenJson.error_description || tokenJson.error || 'token exchange failed' })
      return
    }

    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    })
    const profile = await profileRes.json().catch(() => ({}))
    if (!profileRes.ok || !profile.userId) {
      send(401, { error: 'line_profile', detail: profile.message || 'profile failed' })
      return
    }

    initAdmin()
    const uid = `line_${profile.userId}`
    const db = admin.firestore()
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

    try { await adoptLineTwin(db, uid, name) } catch (e) {
      console.error('[line-auth] adopt twin', e)
    }

    const firebaseToken = await admin.auth().createCustomToken(uid, {
      provider: 'line',
      lineUserId: profile.userId,
    })

    send(200, { token: firebaseToken })
  } catch (e) {
    const codeName = e?.code === 'notconfigured' ? 'notconfigured' : 'unknown'
    console.error('[line-auth]', e)
    send(500, {
      error: codeName,
      detail: e?.message || 'exchange failed',
    })
  }
}
