/**
 * Copy the shop catalog from the live project into the test project:
 * courts, config/settings and config/payout. No members, bookings, coupons,
 * stamps, slips or logs are read or copied.
 *
 * The live project is only read. Writes go to the test project only.
 *
 *   npm run staging:catalog
 */
import { readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import admin from 'firebase-admin'
import { readEnvFile, assertStaging } from '../lib/envTarget.mjs'
import { projectRoot } from '../lib/loadEnv.mjs'

const root = projectRoot()
const staging = assertStaging(root)
const live = readEnvFile(join(root, '.env'))

function credentialFor(vars) {
  if (vars.FIREBASE_SERVICE_ACCOUNT_JSON) return JSON.parse(vars.FIREBASE_SERVICE_ACCOUNT_JSON)
  const rel = vars.FIREBASE_SERVICE_ACCOUNT_PATH
  const file = isAbsolute(rel) ? rel : resolve(root, rel)
  return JSON.parse(readFileSync(file, 'utf8'))
}

const liveSa = credentialFor(live)
const testSa = credentialFor(staging)
const liveApp = admin.initializeApp({ credential: admin.credential.cert(liveSa), projectId: live.VITE_FB_PROJECT_ID || liveSa.project_id }, 'live-read')
const testApp = admin.initializeApp({ credential: admin.credential.cert(testSa), projectId: staging.VITE_FB_PROJECT_ID }, 'test-write')
if (liveApp.options.projectId === testApp.options.projectId) {
  console.error('Live and test project are the same. Nothing copied.')
  process.exit(1)
}

const from = liveApp.firestore()
const to = testApp.firestore()

const courts = await from.collection('courts').get()
const settings = await from.collection('config').doc('settings').get()
const payout = await from.collection('config').doc('payout').get()

const batch = to.batch()
courts.docs.forEach((d) => batch.set(to.collection('courts').doc(d.id), d.data()))
if (settings.exists) batch.set(to.collection('config').doc('settings'), settings.data())
if (payout.exists) batch.set(to.collection('config').doc('payout'), payout.data())
await batch.commit()

console.log(`Copied ${courts.size} court(s)${settings.exists ? ', settings' : ''}${payout.exists ? ', payout' : ''}`)
console.log(`  from ${liveApp.options.projectId} (read only) → ${testApp.options.projectId}`)
process.exit(0)
