/**
 * Live security test for the booking + payment path.
 *
 * Signs in as a throwaway customer (real Firebase ID token) and actually tries
 * the attacks the audit found, against the real Firestore rules and the real
 * API handlers. Nothing here trusts the source code — every check is a request
 * whose response we assert on.
 *
 *   npm run check:security                 # rules only
 *   npm run check:security -- --api=http://localhost:5173
 *
 * Safe to run against production: it only writes docs whose ids start with
 * `sectest_`, and deletes them (plus the temp auth users) on the way out.
 */
import admin from 'firebase-admin'
import { existsSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { initAdmin } from './lib/admin.mjs'

const API_BASE = (process.argv.find((a) => a.startsWith('--api=')) || '').slice(6)
const STAMP = Date.now().toString(36)
const ATTACKER = `sectest_atk_${STAMP}`
const VICTIM = `sectest_vic_${STAMP}`
const NEWCOMER = `sectest_new_${STAMP}`
const BANNED = `sectest_ban_${STAMP}`
const STAFF = `sectest_staff_${STAMP}`

const apiKey = (process.env.VITE_FB_API_KEY || '').trim()
let projectId = ''
let results = []

const record = (pass, name, detail = '') => {
  results.push({ pass, name, detail })
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

// ── Firestore REST helpers (rules apply to these, unlike the Admin SDK) ──
const fsBase = () => `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`

const val = (v) => {
  if (v === null) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
  return { stringValue: String(v) }
}
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]))

async function fsReq(idToken, method, path, body) {
  const res = await fetch(`${fsBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

const denied = (r) => r.status === 403 || r.json?.error?.status === 'PERMISSION_DENIED'

/** Runs a scoped `where userId == uid` query the way the app's listeners do. */
async function fsQuery(idToken, collection, uid) {
  const res = await fetch(`${fsBase()}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: uid },
          },
        },
        limit: 5,
      },
    }),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

async function idTokenFor(uid) {
  const custom = await admin.auth().createCustomToken(uid)
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  })
  const json = await res.json()
  if (!json.idToken) throw new Error(`token exchange failed: ${JSON.stringify(json).slice(0, 200)}`)
  return json.idToken
}

// ── the attacks ──
async function testRules(token, victimVoucherId) {
  console.log('\nFirestore rules (as a signed-in customer)\n')

  record(denied(await fsReq(token, 'POST', `/bookings?documentId=sectest_bk_${STAMP}`, {
    fields: fields({
      ref: 'HACK-01', userId: ATTACKER, courtId: 'c1', date: '2027-01-01', hour: 19,
      duration: 60, price: 0, discount: 0, total: 0, payMethod: 'counter',
      status: 'upcoming', createdAt: '2027-01-01T00:00', voucherUsed: false,
    }),
  })), 'cannot create a booking directly (book without paying)')

  record(denied(await fsReq(token, 'POST', `/vouchers?documentId=sectest_v_${STAMP}`, {
    fields: fields({ userId: ATTACKER, issued: '2026-01-01', expiry: null, used: false, source: 'stamps' }),
  })), 'cannot mint a free-hour voucher for itself')

  record(denied(await fsReq(token, 'PATCH', `/members/${ATTACKER}?updateMask.fieldPaths=stamps`, {
    fields: fields({ stamps: 99 }),
  })), 'cannot raise its own stamp count')

  const profile = await fsReq(token, 'PATCH', `/members/${ATTACKER}?updateMask.fieldPaths=name`, {
    fields: fields({ name: 'Renamed by owner' }),
  })
  record(profile.status === 200, 'CAN still edit its own profile name (not over-locked)',
    profile.status === 200 ? '' : `status ${profile.status}`)

  record(denied(await fsReq(token, 'PATCH', `/members/${VICTIM}?updateMask.fieldPaths=name`, {
    fields: fields({ name: 'Hacked' }),
  })), "cannot edit another member's profile")

  record(denied(await fsReq(token, 'PATCH', `/vouchers/${victimVoucherId}?updateMask.fieldPaths=used`, {
    fields: fields({ used: true }),
  })), "cannot burn another member's voucher")

  record(denied(await fsReq(token, 'GET', `/payments/sectest_probe_${STAMP}`)),
    'cannot read the payments / slip audit trail')

  record(denied(await fsReq(token, 'POST', `/stampLog?documentId=sectest_s_${STAMP}`, {
    fields: fields({ userId: ATTACKER, date: '2026-01-01', delta: 10, note: 'hack', by: 'system' }),
  })), 'cannot write its own stamp-log entries')

  // the slip-check throttle lives in Firestore, so clearing it must be denied
  record(denied(await fsReq(token, 'GET', `/rateLimits/slip_${ATTACKER}`)),
    'cannot read its own slip-check quota')
  record(denied(await fsReq(token, 'PATCH', `/rateLimits/slip_${ATTACKER}?updateMask.fieldPaths=fails`, {
    fields: fields({ fails: 0 }),
  })), 'cannot reset its own slip-check quota')

  const courts = await fsReq(token, 'GET', '/courts?pageSize=1')
  record(courts.status === 200, 'CAN still read the court catalog', courts.status === 200 ? '' : `status ${courts.status}`)
}

/** One customer must not be able to read anything about another. */
async function testCrossCustomerReads(token, victimVoucherId) {
  console.log('\nData exposure (as a signed-in customer)\n')

  record(denied(await fsReq(token, 'GET', '/members?pageSize=1')),
    'cannot list the member directory (names, phones, emails)')
  record(denied(await fsReq(token, 'GET', `/members/${VICTIM}`)),
    "cannot read another member's profile")
  record(denied(await fsReq(token, 'GET', '/bookings?pageSize=1')),
    "cannot list everyone's bookings")
  record(denied(await fsReq(token, 'GET', '/vouchers?pageSize=1')),
    "cannot list everyone's vouchers")
  record(denied(await fsReq(token, 'GET', '/stampLog?pageSize=1')),
    "cannot list everyone's stamp history")
  record(denied(await fsReq(token, 'GET', `/vouchers/${victimVoucherId}`)),
    "cannot read another member's voucher")
  record(denied(await fsReq(token, 'GET', '/adminLog?pageSize=1')),
    'cannot read the staff activity log')

  // the same restriction must not break the customer's own screens
  const own = await fsReq(token, 'GET', `/members/${ATTACKER}`)
  record(own.status === 200, 'CAN still read its own profile',
    own.status === 200 ? '' : `status ${own.status}`)
  for (const col of ['bookings', 'vouchers', 'stampLog']) {
    const r = await fsQuery(token, col, ATTACKER)
    record(r.status === 200, `CAN still query its own ${col}`,
      r.status === 200 ? '' : `status ${r.status}`)
  }
}

/** A suspended account must not be able to lift its own ban. */
async function testSuspended() {
  console.log('\nModeration (as a suspended account)\n')
  const token = await idTokenFor(BANNED)

  record(denied(await fsReq(token, 'PATCH', `/members/${BANNED}?updateMask.fieldPaths=suspended`, {
    fields: fields({ suspended: false }),
  })), 'cannot clear its own suspension')

  if (!API_BASE) return
  const res = await fetch(`${API_BASE}/api/bookings/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items: [{ courtId: 'c1', date: '2027-01-01', hour: 19 }] }),
  })
  const json = await res.json().catch(() => ({}))
  record(json?.error === 'suspended', 'cannot check out while suspended', `got ${json?.error}`)
}

async function testSignup() {
  console.log('\nSign-up rules (as a brand-new account with no member doc)\n')
  const token = await idTokenFor(NEWCOMER)

  record(denied(await fsReq(token, 'POST', `/members?documentId=${NEWCOMER}`, {
    fields: fields({
      name: 'Cheater', email: '', phone: '', channel: 'email', country: 'TH', lang: 'th',
      avatar: '🏓', stamps: 99, bookingsYear: 0, suspended: false, joined: '2026-01-01', birthday: null,
    }),
  })), 'cannot register with pre-loaded stamps')

  const clean = await fsReq(token, 'POST', `/members?documentId=${NEWCOMER}`, {
    fields: fields({
      name: 'Honest', email: '', phone: '', channel: 'email', country: 'TH', lang: 'th',
      avatar: '🏓', stamps: 0, bookingsYear: 0, suspended: false, joined: '2026-01-01', birthday: null,
    }),
  })
  record(clean.status === 200, 'CAN still register normally (stamps 0)',
    clean.status === 200 ? '' : `status ${clean.status}`)
}

async function pickSlot(db, { peak: wantPeak } = {}) {
  const [courtsSnap, settingsSnap] = await Promise.all([
    db.collection('courts').get(),
    db.collection('config').doc('settings').get(),
  ])
  const advance = Number(settingsSnap.data()?.advanceBookingDays) || 14
  const courts = courtsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => c.active !== false)
  const booked = new Set()
  const bk = await db.collection('bookings').get()
  bk.docs.forEach((d) => {
    const b = d.data()
    if (b.status !== 'cancelled') booked.add(`${b.courtId}|${b.date}|${b.hour}`)
  })
  for (let day = 1; day < Math.max(2, advance); day += 1) {
    const d = new Date()
    d.setDate(d.getDate() + day)
    const z = (n) => String(n).padStart(2, '0')
    const date = `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
    for (const court of courts) {
      for (let hour = Number(court.open); hour < Number(court.close); hour += 1) {
        if (booked.has(`${court.id}|${date}|${hour}`)) continue
        if ((court.blocked || []).some((b) => b.date === date && b.hour === hour)) continue
        const peak = court.peakEnabled !== false && hour >= (court.peakFrom ?? 17) && hour < (court.peakTo ?? 21)
        if (wantPeak === true && !peak) continue
        if (wantPeak === false && peak) continue
        const price = Number(peak ? court.pricePeak : court.priceOff)
        if (!(price > 0)) continue
        return { courtId: court.id, date, hour, price, peak }
      }
    }
  }
  return null
}

async function testApi(token, db, victimVoucherId) {
  console.log(`\nCheckout API (${API_BASE})\n`)

  const post = async (path, body, bearer) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      body: JSON.stringify(body),
    })
    return { status: res.status, json: await res.json().catch(() => ({})) }
  }

  record((await post('/api/bookings/pay', { items: [] })).status === 401, 'rejects an anonymous checkout')
  record((await post('/api/bookings/pay', { items: [] }, 'not-a-token')).status === 401, 'rejects a forged token')

  const slot = await pickSlot(db)
  if (!slot) {
    record(false, 'could not find a free priced slot to probe with')
    return
  }
  const items = [{ courtId: slot.courtId, date: slot.date, hour: slot.hour }]
  console.log(`        probing with ${slot.courtId} ${slot.date} ${slot.hour}:00 (฿${slot.price})`)

  let r = await post('/api/bookings/pay', { items }, token)
  record(r.json?.error === 'slip_required', 'refuses to book a paid slot without a slip', `got ${r.json?.error}`)

  r = await post('/api/bookings/pay', {
    items, payMethod: 'counter', amount: 1, total: 0, price: 0, slipTransRef: 'FAKEREF123',
  }, token)
  record(r.json?.error === 'slip_required',
    'ignores injected payMethod / amount / slipTransRef', `got ${r.json?.error}`)

  r = await post('/api/bookings/pay', { items, voucherId: victimVoucherId }, token)
  record(r.json?.error === 'voucher_invalid', "refuses another member's voucher", `got ${r.json?.error}`)

  const peak = await pickSlot(db, { peak: true })
  if (peak) {
    const ownVoucher = `sectest_av_${STAMP}`
    await db.collection('vouchers').doc(ownVoucher).set({
      userId: ATTACKER, issued: '2026-01-01', expiry: null, used: false, source: 'stamps',
    })
    r = await post('/api/bookings/pay', {
      items: [{ courtId: peak.courtId, date: peak.date, hour: peak.hour }],
      voucherId: ownVoucher,
    }, token)
    record(r.json?.error === 'voucher_peak', 'refuses a free-hour code on a peak slot', `got ${r.json?.error}`)
    await db.collection('vouchers').doc(ownVoucher).delete().catch(() => {})
  } else {
    record(false, 'refuses a free-hour code on a peak slot', 'no free peak slot to probe')
  }

  // same real court, so this exercises the date guard rather than a bad id
  r = await post('/api/bookings/pay', {
    items: [{ courtId: slot.courtId, date: '2020-01-01', hour: slot.hour }],
  }, token)
  record(r.json?.error === 'slot_window', 'refuses a slot in the past', `got ${r.json?.error}`)

  r = await post('/api/bookings/pay', {
    items: [{ courtId: slot.courtId, date: '2099-01-01', hour: slot.hour }],
  }, token)
  record(r.json?.error === 'slot_window', 'refuses a date beyond the booking window', `got ${r.json?.error}`)

  r = await post('/api/admin/slip', { bookingId: 'anything' }, token)
  record(r.json?.error === 'notadmin', 'blocks a customer from the admin slip viewer', `got ${r.json?.error}`)

  // the calendar's replacement for reading everyone's bookings — it must hand
  // back occupancy and nothing that identifies a person
  r = await post('/api/slots/taken', { dates: [slot.date] }, token)
  const slots = r.json?.taken?.[slot.date]
  record(Array.isArray(slots), 'slot availability API answers a customer',
    Array.isArray(slots) ? '' : `got ${JSON.stringify(r.json).slice(0, 80)}`)
  const leaked = (slots || []).flatMap((s) => Object.keys(s)).filter((k) => k !== 'courtId' && k !== 'hour')
  record(leaked.length === 0, 'slot availability leaks nothing but courtId and hour',
    leaked.length ? `also returned ${[...new Set(leaked)].join(', ')}` : '')
  r = await post('/api/slots/taken', { dates: [slot.date] }, '')
  record(r.json?.error === 'auth', 'slot availability rejects anonymous callers', `got ${r.json?.error}`)

  r = await post('/api/auth/line', { code: 'not-a-real-code', redirectUri: 'https://evil.example/callback' })
  record(r.json?.error === 'badredirect', 'LINE exchange rejects an unlisted redirectUri', `got ${r.json?.error}`)
  r = await post('/api/auth/line', { redirectUri: 'http://localhost:5173/auth/line/callback' })
  record(r.json?.error === 'badrequest', 'LINE exchange rejects a missing code', `got ${r.json?.error}`)

  const stray = await db.collection('bookings').where('userId', '==', ATTACKER).get()
  record(stray.empty, 'no booking was created by any of the above', stray.empty ? '' : `${stray.size} leaked!`)
}

async function cleanup(db) {
  const cols = ['bookings', 'vouchers', 'stampLog']
  for (const col of cols) {
    for (const uid of [ATTACKER, VICTIM, NEWCOMER, BANNED]) {
      const snap = await db.collection(col).where('userId', '==', uid).get()
      await Promise.all(snap.docs.map((d) => d.ref.delete()))
    }
  }
  await db.collection('admins').doc(STAFF).delete().catch(() => {})
  await Promise.all([ATTACKER, VICTIM, NEWCOMER, BANNED, STAFF].map(async (uid) => {
    await db.collection('members').doc(uid).delete().catch(() => {})
    await admin.auth().deleteUser(uid).catch(() => {})
  }))
}

/**
 * Scoping reads is only correct if it stops customers *and* leaves staff able
 * to run the admin panel, which needs the whole of every collection.
 */
async function testStaffStillWorks(db) {
  console.log('\nStaff access (as an account listed in admins/)\n')
  await db.collection('admins').doc(STAFF).set({ role: 'sectest' })
  try {
    const token = await idTokenFor(STAFF)
    for (const col of ['members', 'bookings', 'vouchers', 'stampLog', 'adminLog', 'payments']) {
      const r = await fsReq(token, 'GET', `/${col}?pageSize=1`)
      record(r.status === 200, `CAN read all of ${col}`, r.status === 200 ? '' : `status ${r.status}`)
    }
  } finally {
    await db.collection('admins').doc(STAFF).delete().catch(() => {})
  }
}

/**
 * The server compares every slip's receiver against these settings and now
 * refuses to take money when they are blank, so an empty account is both a
 * broken checkout and the sign that the receiver check never ran.
 */
async function testPayConfig(db, token) {
  console.log('\nShop payment account (config/payout)\n')
  const snap = await db.collection('config').doc('payout').get()
  const d = snap.exists ? (snap.data() || {}) : {}
  const acct = String(d.payAccountNo || '').replace(/\D/g, '')
  const ppid = String(d.promptPayId || '').replace(/\D/g, '')
  record(acct.length >= 4 || ppid.length >= 4,
    'a receiving account is configured (slip receiver can be verified)',
    acct || ppid ? '' : 'both payAccountNo and promptPayId are empty — checkout will refuse to take money')
  record(!!String(d.payAccountName || '').trim(),
    'the account name customers see is configured')
  record(!ppid || ppid.length !== acct.length || ppid !== acct,
    'promptPayId is not just the bank account number',
    ppid && ppid === acct ? 'a bank account number is not a valid PromptPay proxy — the QR would not resolve' : '')

  const anonPayout = await fetch(`${fsBase()}/config/payout`)
  const anonJson = await anonPayout.json().catch(() => ({}))
  record(anonPayout.status === 403 || anonJson?.error?.status === 'PERMISSION_DENIED',
    'anonymous callers cannot read the shop bank account',
    `status ${anonPayout.status}`)
  const authed = await fsReq(token, 'GET', '/config/payout')
  record(authed.status === 200, 'a signed-in customer CAN read the shop bank account to pay',
    authed.status === 200 ? '' : `status ${authed.status}`)
  const publicSettings = await fetch(`${fsBase()}/config/settings`)
  record(publicSettings.status === 200, 'CAN still read operational settings without logging in',
    publicSettings.status === 200 ? '' : `status ${publicSettings.status}`)
}

function testGitHygiene() {
  console.log('\nTracked files (web API key / secrets)\n')
  const git = (args) => {
    try { return execFileSync('git', args, { encoding: 'utf8' }).trim() } catch { return '' }
  }
  record(!git(['ls-files', 'dist']),
    'dist/ is not tracked (built JS inlines the Firebase web API key)')
  record(!git(['grep', '-I', '-l', 'BEGIN PRIVATE KEY']),
    'no private keys in tracked files')
  const liveKey = git(['grep', '-I', '-E', 'AIzaSy[0-9A-Za-z_-]{30,}'])
  record(!liveKey, 'no live Firebase web API key in tracked files',
    liveKey ? liveKey.split('\n')[0].slice(0, 80) : '')
}

async function main() {
  if (!apiKey) throw new Error('VITE_FB_API_KEY missing from .env (needed to mint a test ID token)')
  const app = initAdmin()
  projectId = app.options.projectId
  const db = admin.firestore()

  console.log(`\nSecurity test — project ${projectId}`)

  const fresh = {
    name: 'Sec Test', email: '', phone: '', channel: 'email', country: 'TH', lang: 'th',
    avatar: '🏓', stamps: 0, bookingsYear: 0, suspended: false, joined: '2026-01-01', birthday: null,
  }
  await db.collection('members').doc(ATTACKER).set(fresh)
  await db.collection('members').doc(VICTIM).set({ ...fresh, name: 'Sec Victim' })
  await db.collection('members').doc(BANNED).set({ ...fresh, name: 'Sec Banned', suspended: true })
  const victimVoucherId = `sectest_vv_${STAMP}`
  await db.collection('vouchers').doc(victimVoucherId).set({
    userId: VICTIM, issued: '2026-01-01', expiry: null, used: false, source: 'stamps',
  })

  try {
    const token = await idTokenFor(ATTACKER)
    await testRules(token, victimVoucherId)
    await testCrossCustomerReads(token, victimVoucherId)
    await testSuspended()
    await testSignup()
    await testStaffStillWorks(db)
    await testPayConfig(db, token)
    await testGitHygiene()
    if (API_BASE) await testApi(token, db, victimVoucherId)
    else console.log('\n  skip  checkout API — pass --api=http://localhost:5173 to include it\n')
  } finally {
    await db.collection('vouchers').doc(victimVoucherId).delete().catch(() => {})
    await cleanup(db)
  }

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${failed.length ? `${failed.length} of ${results.length} checks FAILED` : `all ${results.length} checks passed`}\n`)
  if (failed.length) process.exitCode = 1

  if (existsSync('dist/index.html')) {
    const r = spawnSync(process.execPath, ['scripts/checkBundles.mjs'], { stdio: 'inherit' })
    if (r.status) process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(`\n  FAIL  ${e.message}\n`)
  process.exitCode = 1
})
