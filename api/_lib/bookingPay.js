/**
 * Server-authoritative checkout — the only way a customer booking is created.
 *
 * The browser sends *what* it wants to book (court/date/hour + an optional
 * voucher) and the transfer slip. Everything that decides money or ownership is
 * recomputed here from Firestore:
 *
 *   • price comes from `courts`, never from the request
 *   • the amount sent to SlipOK is the server total
 *   • the slip's receiver must be the shop account in `config/settings`
 *   • a slip's `transRef` can be applied to exactly one checkout (payments/{ref})
 *   • `payMethod` is derived here, so nobody can self-serve a `counter` booking
 *   • a voucher must belong to the caller and still be unused
 *
 * Firestore rules block customer writes to bookings/vouchers/stampLog, so this
 * handler (Admin SDK) is the single writer. See FIREBASE_SETUP.md.
 */
import admin from 'firebase-admin'
import {
  getEnv, initAdmin, readJsonBody, jsonSender, verifyCustomer, storageBucket, newId,
} from './serverAdmin.js'
import { isPeak, sortSlotItems, genRef, todayISO, nowLocalISO } from '../../src/data/index.js'

const MAX_ITEMS = 12
const MAX_SLIP_BYTES = 3 * 1024 * 1024
const STAMPS_PER_VOUCHER = 10
/** Throttle on the paid SlipOK API: failed checks per customer per window. */
const SLIP_FAIL_LIMIT = 8
const SLIP_FAIL_WINDOW_MS = 60 * 60 * 1000
/** PDPA: payment slips are kept 2 years (accounting/dispute window), then deleted. */
export const SLIP_RETENTION_DAYS = 730

const httpError = (status, code, extra = {}) =>
  Object.assign(new Error(code), { status, code, extra })

/** "2026-09-02" + 730 days → "2028-09-01" */
function addDaysISO(dateISO, days) {
  const d = new Date(`${dateISO}T00:00:00`)
  d.setDate(d.getDate() + days)
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

function normalizeItems(raw) {
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue
    const courtId = String(it.courtId || '').trim()
    const date = String(it.date || '').trim()
    const hour = Number(it.hour)
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(courtId)) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue
    const key = `${courtId}|${date}|${hour}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ courtId, date, hour })
    if (out.length >= MAX_ITEMS) break
  }
  return out
}

function dataUrlToBase64(image) {
  const s = String(image || '')
  const m = s.match(/^data:image\/(jpeg|jpg|png|webp|jfif);base64,(.+)$/i)
  if (m) return m[2].replace(/\s/g, '')
  if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 80) return s.replace(/\s/g, '')
  return ''
}

/** Slot must still be in the future and inside the shop's booking window. */
function slotInWindow(item, settings) {
  const now = new Date()
  const slot = new Date(`${item.date}T00:00:00`)
  slot.setHours(item.hour)
  if (slot <= now) return false
  const days = Number(settings.advanceBookingDays)
  if (Number.isFinite(days) && days > 0) {
    const last = addDaysISO(todayISO(), days - 1)
    if (item.date > last) return false
  }
  return true
}

function digitRuns(value, out = []) {
  if (value == null) return out
  if (typeof value === 'string' || typeof value === 'number') {
    const d = String(value).replace(/\D/g, '')
    if (d) out.push(d)
    return out
  }
  if (typeof value === 'object') Object.values(value).forEach((v) => digitRuns(v, out))
  return out
}

/**
 * SlipOK masks the receiver account ("xxx-x-x1322-x"), so the strongest check
 * available is that the shop's last 4 digits appear somewhere in it.
 *
 * Throws rather than returning false when the shop account is not configured:
 * a money check that silently passes when misconfigured is worse than a shop
 * that cannot take payments until an admin fills in the account number.
 */
function assertReceiverIsShop(data, settings) {
  const expected = [settings.payAccountNo, settings.promptPayId]
    .map((v) => String(v || '').replace(/\D/g, ''))
    .filter((v) => v.length >= 4)
  if (!expected.length) {
    console.error('[pay] refusing payment: no payAccountNo/promptPayId in config/payout')
    throw httpError(500, 'notconfigured')
  }
  const found = digitRuns(data?.receiver)
  if (!found.length) {
    // provider gave us no receiver to compare — record it, don't guess
    console.warn('[pay] SlipOK returned no receiver details; account not verified')
    return
  }
  if (!expected.some((e) => found.some((f) => f.includes(e.slice(-4))))) {
    throw httpError(400, 'receiver_mismatch')
  }
}

async function verifySlipWithSlipOk({ base64, amount, settings }) {
  const branchId = getEnv('SLIPOK_BRANCH_ID')
  const apiKey = getEnv('SLIPOK_API_KEY')
  if (!branchId || !apiKey) throw httpError(500, 'notconfigured', { detail: 'SlipOK env missing' })

  let res
  try {
    res = await fetch(`https://api.slipok.com/api/line/apikey/${encodeURIComponent(branchId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-authorization': apiKey },
      body: JSON.stringify({ files: base64, log: true, amount }),
    })
  } catch (e) {
    console.error('[pay] slipok unreachable', e)
    throw httpError(502, 'slip_network')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success !== true) {
    throw httpError(400, json.code != null ? String(json.code) : 'slip_failed', { message: json.message || '' })
  }

  const data = json.data || {}
  const transRef = String(data.transRef || '').trim()
  // this becomes a Firestore document id, and the id *is* the replay guard —
  // a value with a slash would silently write to a nested path instead
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(transRef)) {
    console.error('[pay] unusable transRef from SlipOK:', JSON.stringify(transRef).slice(0, 100))
    throw httpError(400, 'slip_failed')
  }
  // SlipOK also enforces `amount`, but never trust one check with money.
  const paid = Number(data.amount)
  if (!Number.isFinite(paid) || paid + 0.01 < amount) throw httpError(400, '1013')
  assertReceiverIsShop(data, settings)

  return {
    transRef,
    amount: paid,
    paidAt: String(data.transDate || '') + (data.transTime ? ` ${data.transTime}` : ''),
    sender: String(data.sender?.displayName || data.sender?.name || '').slice(0, 80),
    receiver: String(data.receiver?.displayName || data.receiver?.name || '').slice(0, 80),
    receivingBank: String(data.receivingBank || '').slice(0, 20),
  }
}

const slipObjectPath = (transRef, createdAt) =>
  `slips/${createdAt.slice(0, 7)}/${String(transRef).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60)}.jpg`

/** Private object — served to admins only, through a short-lived signed URL. */
async function uploadSlip({ base64, objectPath, meta }) {
  const file = storageBucket().file(objectPath)
  await file.save(Buffer.from(base64, 'base64'), {
    resumable: false,
    contentType: 'image/jpeg',
    metadata: {
      cacheControl: 'private, max-age=0, no-store',
      metadata: Object.fromEntries(
        Object.entries(meta).map(([k, v]) => [k, String(v ?? '')])
      ),
    },
  })
}

/** Slots already held by a live booking, checked before we burn the slip. */
async function takenSlots(db, items) {
  const dates = [...new Set(items.map((i) => i.date))]
  const found = new Set()
  for (const date of dates) {
    const snap = await db.collection('bookings').where('date', '==', date).get()
    snap.docs.forEach((d) => {
      const b = d.data() || {}
      if (b.status === 'cancelled') return
      found.add(`${b.courtId}|${b.date}|${b.hour}`)
    })
  }
  return items.filter((i) => found.has(`${i.courtId}|${i.date}|${i.hour}`))
}

/**
 * Every SlipOK call costs the shop a credit, so a logged-in customer must not
 * be able to loop the endpoint with junk images. Only *failed* checks are
 * counted — a success means real money arrived, which is never abuse.
 */
async function assertSlipQuota(db, uid) {
  const snap = await db.collection('rateLimits').doc(`slip_${uid}`).get()
  const d = snap.exists ? (snap.data() || {}) : null
  if (!d) return
  if (Date.now() - (d.windowStart || 0) > SLIP_FAIL_WINDOW_MS) return
  if ((d.fails || 0) >= SLIP_FAIL_LIMIT) throw httpError(429, 'too_many_slips')
}

async function recordSlipFailure(db, uid) {
  const ref = db.collection('rateLimits').doc(`slip_${uid}`)
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const d = snap.exists ? (snap.data() || {}) : null
      const stale = !d || Date.now() - (d.windowStart || 0) > SLIP_FAIL_WINDOW_MS
      if (stale) tx.set(ref, { userId: uid, windowStart: Date.now(), fails: 1 })
      else tx.update(ref, { fails: (d.fails || 0) + 1 })
    })
  } catch (e) {
    console.error('[pay] could not record slip failure', e)
  }
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleBookingPay(req, res) {
  const send = jsonSender(res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.method !== 'POST') { send(405, { error: 'method' }); return }

  let db
  try {
    initAdmin()
    db = admin.firestore()
  } catch (e) {
    // details stay in the server log — they name file paths and env vars
    console.error('[pay] admin init', e)
    send(500, { error: 'notconfigured' })
    return
  }

  const caller = await verifyCustomer(req)
  if (!caller.uid) {
    send(caller.reason === 'unverified' ? 403 : 401, { error: caller.reason })
    return
  }
  const uid = caller.uid

  let body
  try { body = await readJsonBody(req) } catch (e) {
    send(e.status === 413 ? 413 : 400, { error: e.code || 'badrequest' })
    return
  }

  const items = normalizeItems(body.items)
  const voucherId = typeof body.voucherId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.voucherId)
    ? body.voucherId : ''
  const slipBase64 = dataUrlToBase64(body.slip)
  if (!items.length) { send(400, { error: 'badrequest' }); return }
  if (slipBase64.length > MAX_SLIP_BYTES) { send(413, { error: 'slip_too_big' }); return }

  let payment = null
  let objectPath = ''
  const createdAt = nowLocalISO()

  try {
    const [memberSnap, settingsSnap, payoutSnap, courtsSnap] = await Promise.all([
      db.collection('members').doc(uid).get(),
      db.collection('config').doc('settings').get(),
      db.collection('config').doc('payout').get(),
      db.collection('courts').get(),
    ])
    if (!memberSnap.exists) throw httpError(403, 'nomember')
    if (memberSnap.data()?.suspended) throw httpError(403, 'suspended')
    const settings = {
      ...(settingsSnap.exists ? (settingsSnap.data() || {}) : {}),
      ...(payoutSnap.exists ? (payoutSnap.data() || {}) : {}),
    }
    const courts = courtsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

    // ── price the cart from Firestore ──
    const ordered = sortSlotItems(items, courts.map((c) => c.id))
    const priced = ordered.map((it) => {
      const court = courts.find((c) => c.id === it.courtId)
      if (!court || court.active === false) throw httpError(400, 'court_missing')
      if (it.hour < Number(court.open) || it.hour >= Number(court.close)) throw httpError(400, 'slot_closed')
      if ((court.blocked || []).some((b) => b.date === it.date && b.hour === it.hour)) throw httpError(400, 'slot_closed')
      if (!slotInWindow(it, settings)) throw httpError(400, 'slot_window')
      const base = Number(isPeak(it.hour, court) ? court.pricePeak : court.priceOff)
      if (!Number.isFinite(base) || base < 0) throw httpError(500, 'price_missing')
      return { ...it, base }
    })

    // ── voucher must be the caller's own, unused, and cover an off-peak slot ──
    if (voucherId) {
      const vSnap = await db.collection('vouchers').doc(voucherId).get()
      const v = vSnap.exists ? (vSnap.data() || {}) : null
      if (!v || v.userId !== uid || v.used) throw httpError(400, 'voucher_invalid')
      if (v.expiry && v.expiry < todayISO()) throw httpError(400, 'voucher_invalid')
    }
    const cheapestIdx = voucherId
      ? priced.reduce((best, it, i) => {
          const court = courts.find((c) => c.id === it.courtId)
          if (isPeak(it.hour, court)) return best
          if (best < 0) return i
          return it.base < priced[best].base ? i : best
        }, -1)
      : -1
    if (voucherId && cheapestIdx < 0) throw httpError(400, 'voucher_peak')
    const lines = priced.map((it, i) => {
      const discount = i === cheapestIdx ? it.base : 0
      return { ...it, discount, total: it.base - discount }
    })
    const total = lines.reduce((s, l) => s + l.total, 0)

    // fail before charging: cheap pre-check, re-checked inside the transaction
    if ((await takenSlots(db, lines)).length) throw httpError(409, 'slot_taken')

    if (total > 0) {
      if (!slipBase64) throw httpError(400, 'slip_required')
      await assertSlipQuota(db, uid)
      try {
        payment = await verifySlipWithSlipOk({ base64: slipBase64, amount: total, settings })
      } catch (e) {
        if (e?.code !== 'notconfigured') await recordSlipFailure(db, uid)
        throw e
      }
      objectPath = slipObjectPath(payment.transRef, createdAt)
    }

    const bookingRef = genRef()
    const slipExpiresAt = addDaysISO(todayISO(), SLIP_RETENTION_DAYS)
    const bookings = lines.map((l, i) => ({
      id: newId('b'),
      ref: bookingRef,
      userId: uid,
      courtId: l.courtId,
      date: l.date,
      hour: l.hour,
      duration: 60,
      price: l.base,
      discount: l.discount,
      total: l.total,
      payMethod: i === cheapestIdx ? 'voucher' : 'promptpay',
      status: 'upcoming',
      createdAt,
      voucherUsed: i === cheapestIdx,
      ...(payment ? { slipTransRef: payment.transRef, slipPath: objectPath, slipExpiresAt } : {}),
    }))

    let voucherEarned = false
    await db.runTransaction(async (tx) => {
      // ── reads (must all precede writes) ──
      const payRef = payment ? db.collection('payments').doc(payment.transRef) : null
      if (payRef) {
        const paid = await tx.get(payRef)
        if (paid.exists) throw httpError(409, '1012')
      }
      const vRef = voucherId ? db.collection('vouchers').doc(voucherId) : null
      if (vRef) {
        const v = await tx.get(vRef)
        if (!v.exists || v.data()?.userId !== uid || v.data()?.used) throw httpError(400, 'voucher_invalid')
      }
      const dates = [...new Set(lines.map((l) => l.date))]
      const live = new Set()
      for (const date of dates) {
        const snap = await tx.get(db.collection('bookings').where('date', '==', date))
        snap.docs.forEach((d) => {
          const b = d.data() || {}
          if (b.status !== 'cancelled') live.add(`${b.courtId}|${b.date}|${b.hour}`)
        })
      }
      if (lines.some((l) => live.has(`${l.courtId}|${l.date}|${l.hour}`))) {
        throw httpError(409, 'slot_taken')
      }
      const memberRef = db.collection('members').doc(uid)
      const member = (await tx.get(memberRef)).data() || {}

      // ── writes ──
      bookings.forEach((b) => {
        const { id, ...data } = b
        tx.set(db.collection('bookings').doc(id), data)
      })
      if (vRef) tx.update(vRef, { used: true, usedAt: createdAt, usedForRef: bookingRef })

      const stamped = bookings.filter((b) => !b.voucherUsed)
      if (stamped.length) {
        let stamps = (member.stamps || 0) + stamped.length
        let earned = 0
        while (stamps >= STAMPS_PER_VOUCHER) { stamps -= STAMPS_PER_VOUCHER; earned += 1 }
        voucherEarned = earned > 0
        tx.update(memberRef, {
          stamps,
          bookingsYear: (member.bookingsYear || 0) + stamped.length,
        })
        stamped.forEach((b) => tx.set(db.collection('stampLog').doc(newId('s')), {
          userId: uid, date: todayISO(), delta: 1, note: `Booking ${b.ref}`, by: 'system',
        }))
        for (let k = 0; k < earned; k += 1) {
          tx.set(db.collection('vouchers').doc(newId('v')), {
            userId: uid, issued: todayISO(), expiry: null, used: false, source: 'stamps',
          })
        }
      }

      if (payRef) {
        tx.set(payRef, {
          provider: 'slipok',
          status: 'applied',
          userId: uid,
          amount: total,
          verifiedAmount: payment.amount,
          transRef: payment.transRef,
          bookingRef,
          bookingIds: bookings.map((b) => b.id),
          slipPath: objectPath,
          slipExpiresAt,
          sender: payment.sender,
          receiver: payment.receiver,
          receivingBank: payment.receivingBank,
          paidAt: payment.paidAt,
          createdAt,
        })
      }
    })

    // Money is in and the bookings exist — a failed upload must not undo that.
    if (payment) {
      try {
        await uploadSlip({
          base64: slipBase64,
          objectPath,
          meta: {
            userId: uid, transRef: payment.transRef, bookingRef,
            amount: total, slipExpiresAt, retentionDays: SLIP_RETENTION_DAYS,
          },
        })
      } catch (e) {
        console.error('[pay] slip upload failed', e)
      }
    }

    send(200, { ok: true, bookings, voucherEarned, transRef: payment?.transRef || '' })
  } catch (e) {
    // The slip passed but we could not seat the booking (slot lost the race).
    // Park the payment so staff can refund or re-seat it instead of it vanishing.
    if (payment && e?.code !== '1012') {
      try {
        await db.collection('payments').doc(payment.transRef).set({
          provider: 'slipok',
          status: 'unapplied',
          reason: e?.code || 'unknown',
          userId: uid,
          verifiedAmount: payment.amount,
          transRef: payment.transRef,
          slipPath: objectPath,
          slipExpiresAt: addDaysISO(todayISO(), SLIP_RETENTION_DAYS),
          sender: payment.sender,
          createdAt,
        }, { merge: true })
        await uploadSlip({
          base64: slipBase64,
          objectPath,
          meta: { userId: uid, transRef: payment.transRef, status: 'unapplied' },
        })
      } catch (inner) {
        console.error('[pay] could not park payment', inner)
      }
      send(409, { error: 'paid_not_booked', transRef: payment.transRef })
      return
    }
    if (e?.status) {
      if (e.extra?.message || e.extra?.detail) console.warn('[pay]', e.code, e.extra)
      send(e.status, { error: e.code })
      return
    }
    console.error('[pay]', e)
    send(500, { error: 'unknown' })
  }
}
