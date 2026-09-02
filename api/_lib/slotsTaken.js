/**
 * Which court/hour slots are already booked, and nothing else.
 *
 * The booking grid used to work this out from a live listener over the whole
 * `bookings` collection, which meant every signed-in customer could read every
 * other customer's booking history. Firestore rules now hand a customer only
 * their own rows, so occupancy comes from here instead: the same court/date/
 * hour facts with no `userId`, price, reference or slip data attached.
 */
import admin from 'firebase-admin'
import { initAdmin, readJsonBody, jsonSender, verifyCustomer } from './serverAdmin.js'

const MAX_DATES = 31
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleSlotsTaken(req, res) {
  const send = jsonSender(res)

  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.method !== 'POST') { send(405, { error: 'method' }); return }

  let db
  try {
    initAdmin()
    db = admin.firestore()
  } catch (e) {
    console.error('[slots] admin init', e)
    send(500, { error: 'notconfigured' })
    return
  }

  const caller = await verifyCustomer(req)
  if (!caller.uid) {
    send(caller.reason === 'unverified' ? 403 : 401, { error: caller.reason })
    return
  }

  let body
  try { body = await readJsonBody(req) } catch (e) {
    send(e.status === 413 ? 413 : 400, { error: e.code || 'badrequest' })
    return
  }

  const dates = [...new Set(
    (Array.isArray(body?.dates) ? body.dates : [])
      .map((d) => String(d || '').trim())
      .filter((d) => DATE_RE.test(d)),
  )].slice(0, MAX_DATES)

  if (!dates.length) { send(400, { error: 'baddates' }); return }

  try {
    const taken = {}
    await Promise.all(dates.map(async (date) => {
      const snap = await db.collection('bookings').where('date', '==', date).get()
      taken[date] = snap.docs
        .map((d) => d.data() || {})
        .filter((b) => b.status !== 'cancelled')
        .map((b) => ({ courtId: b.courtId, hour: b.hour }))
    }))
    send(200, { taken })
  } catch (e) {
    console.error('[slots]', e)
    send(500, { error: 'unknown' })
  }
}
