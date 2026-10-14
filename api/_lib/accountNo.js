/**
 * Short shop account numbers (No. 10001, 10002, …).
 *
 * LINE display names collide, and the Firebase uid is too long to read out.
 * Numbers are assigned only here, with the Admin SDK, from `config/accountSeq`.
 * Customers cannot pick one: Firestore rules reject `accountNo` on sign-up.
 */
import admin from 'firebase-admin'
import {
  initAdmin, readJsonBody, jsonSender, verifyCaller, verifyCustomer, isAdminUid,
} from './serverAdmin.js'

export const ACCOUNT_START = 10001

function hasAccountNo(data) {
  const n = data?.accountNo
  return typeof n === 'number' && Number.isInteger(n) && n >= ACCOUNT_START
}

function nextSeq(seqData, usedMax = 0) {
  const stored = Number(seqData?.next)
  const base = Number.isInteger(stored) && stored >= ACCOUNT_START ? stored : ACCOUNT_START
  return Math.max(base, usedMax + 1, ACCOUNT_START)
}

/** Give this member a number if they do not have one yet. Returns the number. */
export async function ensureMemberAccountNo(db, memberRef) {
  const seqRef = db.collection('config').doc('accountSeq')
  return db.runTransaction(async (tx) => {
    const member = await tx.get(memberRef)
    if (!member.exists) return null
    if (hasAccountNo(member.data())) return member.data().accountNo
    const seq = await tx.get(seqRef)
    const next = nextSeq(seq.data())
    tx.set(seqRef, { next: next + 1 }, { merge: true })
    tx.update(memberRef, { accountNo: next })
    return next
  })
}

/** Staff backfill: every member missing a number, oldest join date first. */
export async function assignMissingAccountNos(db) {
  const snap = await db.collection('members').get()
  let usedMax = 0
  const missing = []
  snap.docs.forEach((d) => {
    const data = d.data() || {}
    if (hasAccountNo(data)) usedMax = Math.max(usedMax, data.accountNo)
    else missing.push(d)
  })
  missing.sort((a, b) => {
    const joined = String(a.data()?.joined || '').localeCompare(String(b.data()?.joined || ''))
    return joined || a.id.localeCompare(b.id)
  })
  if (!missing.length) return { assigned: 0 }

  const seqRef = db.collection('config').doc('accountSeq')
  let assigned = 0
  // Highest number already handed out. Updated only after a commit so a
  // transaction retry cannot skip or reuse a number.
  let floor = usedMax
  const chunkSize = 400
  for (let i = 0; i < missing.length; i += chunkSize) {
    const chunk = missing.slice(i, i + chunkSize)
    const result = await db.runTransaction(async (tx) => {
      const reads = await Promise.all(chunk.map((d) => tx.get(d.ref)))
      const seq = await tx.get(seqRef)
      let next = nextSeq(seq.data(), floor)
      let count = 0
      reads.forEach((fresh) => {
        if (!fresh.exists || hasAccountNo(fresh.data())) return
        tx.update(fresh.ref, { accountNo: next })
        next += 1
        count += 1
      })
      if (count) tx.set(seqRef, { next }, { merge: true })
      return { count, next }
    })
    assigned += result.count
    floor = Math.max(floor, result.next - 1)
  }
  return { assigned }
}

/**
 * POST /api/account/ensure
 * Customer: assign the caller's own number.
 * Staff + `{ all: true }`: backfill every member still missing one.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export async function handleEnsureAccount(req, res) {
  const send = jsonSender(res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.method !== 'POST') { send(405, { error: 'method' }); return }

  let db
  try {
    initAdmin()
    db = admin.firestore()
  } catch (e) {
    console.error('[account-no] admin init', e)
    send(500, { error: 'notconfigured' })
    return
  }

  const uid = await verifyCaller(req)
  if (!uid) { send(401, { error: 'auth' }); return }

  let body = {}
  try { body = await readJsonBody(req) } catch (e) {
    send(e.status === 413 ? 413 : 400, { error: e.code || 'badrequest' })
    return
  }

  try {
    const staff = await isAdminUid(db, uid)
    if (body.all === true) {
      if (!staff) { send(403, { error: 'notadmin' }); return }
      send(200, await assignMissingAccountNos(db))
      return
    }
    if (!staff) {
      const customer = await verifyCustomer(req)
      if (!customer.uid) { send(401, { error: customer.reason || 'auth' }); return }
    }
    const accountNo = await ensureMemberAccountNo(db, db.collection('members').doc(uid))
    if (!accountNo) { send(404, { error: 'notfound' }); return }
    send(200, { accountNo })
  } catch (e) {
    console.error('[account-no]', e)
    send(500, { error: 'unknown' })
  }
}
