/**
 * Admin-only viewer for stored payment slips.
 *
 * Slip images live in a private Storage bucket — no public URL exists. Staff get
 * a signed URL that dies in 5 minutes, and every access is written to
 * `adminLog` so the shop can show who looked at a customer's slip (PDPA:
 * accountability + access logging).
 */
import admin from 'firebase-admin'
import {
  initAdmin, readJsonBody, jsonSender, verifyCaller, isAdminUid, storageBucket, newId,
} from './serverAdmin.js'

const URL_TTL_MS = 5 * 60 * 1000

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleSlipView(req, res) {
  const send = jsonSender(res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.method !== 'POST') { send(405, { error: 'method' }); return }

  let db
  try {
    initAdmin()
    db = admin.firestore()
  } catch (e) {
    console.error('[slip-view] admin init', e)
    send(500, { error: 'notconfigured' })
    return
  }

  const uid = await verifyCaller(req)
  if (!uid) { send(401, { error: 'auth' }); return }
  if (!(await isAdminUid(db, uid))) { send(403, { error: 'notadmin' }); return }

  let body
  try { body = await readJsonBody(req) } catch (e) {
    send(e.status === 413 ? 413 : 400, { error: e.code || 'badrequest' })
    return
  }
  const bookingId = String(body.bookingId || '').trim()
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(bookingId)) { send(400, { error: 'badrequest' }); return }

  const snap = await db.collection('bookings').doc(bookingId).get()
  if (!snap.exists) { send(404, { error: 'notfound' }); return }
  const booking = snap.data() || {}
  const objectPath = String(booking.slipPath || '')
  if (!objectPath) { send(404, { error: 'noslip' }); return }

  try {
    const file = storageBucket().file(objectPath)
    const [exists] = await file.exists()
    // past the 2-year retention the object is gone but the booking row remains
    if (!exists) { send(410, { error: 'slip_expired', slipExpiresAt: booking.slipExpiresAt || '' }); return }

    const expires = Date.now() + URL_TTL_MS
    const [url] = await file.getSignedUrl({ version: 'v4', action: 'read', expires })

    await db.collection('adminLog').doc(newId('a')).set({
      date: new Date().toLocaleString(),
      action: `View payment slip ${booking.ref || bookingId} (${booking.slipTransRef || '—'})`,
      by: uid,
    })

    send(200, {
      ok: true,
      url,
      expiresAt: new Date(expires).toISOString(),
      transRef: booking.slipTransRef || '',
      slipExpiresAt: booking.slipExpiresAt || '',
    })
  } catch (e) {
    console.error('[slip-view]', e)
    send(500, { error: 'unknown' })
  }
}
