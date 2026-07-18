// One-time Firestore seeder — run with: node scripts/seed.mjs
//
// The app's client-side auto-seed can't run against production security rules
// (a first, anonymous visitor has no write access). This script seeds the demo
// dataset directly. Temporarily open your Firestore rules to
//   match /{document=**} { allow read, write: if true; }
// run this, verify, then restore the secure rules.
//
// Config is read from .env (VITE_FB_* keys).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getFirestore, doc, writeBatch, getDocs, collection } from 'firebase/firestore'
import {
  COURTS, MEMBERS, SEED_BOOKINGS, SEED_PROMOS, SEED_VOUCHERS, SEED_STAMP_LOG, SEED_SETTINGS,
} from '../src/data/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// minimal .env parser
const env = {}
for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}

const app = initializeApp({
  apiKey: env.VITE_FB_API_KEY,
  authDomain: env.VITE_FB_AUTH_DOMAIN,
  projectId: env.VITE_FB_PROJECT_ID,
  storageBucket: env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FB_MESSAGING_SENDER_ID,
  appId: env.VITE_FB_APP_ID,
})
const db = getFirestore(app)
const stripId = ({ id, ...rest }) => rest

const COLLECTIONS = {
  courts: COURTS, members: MEMBERS, bookings: SEED_BOOKINGS,
  promos: SEED_PROMOS, vouchers: SEED_VOUCHERS, stampLog: SEED_STAMP_LOG,
}

const existing = await getDocs(collection(db, 'courts'))
if (!existing.empty) {
  console.log(`⏭  courts already has ${existing.size} docs — skipping seed (delete them first to re-seed).`)
  process.exit(0)
}

const batch = writeBatch(db)
let n = 0
for (const [col, rows] of Object.entries(COLLECTIONS)) {
  for (const row of rows) { batch.set(doc(db, col, row.id), stripId(row)); n += 1 }
}
batch.set(doc(db, 'config', 'settings'), SEED_SETTINGS); n += 1

await batch.commit()
console.log(`✅ Seeded ${n} documents across ${Object.keys(COLLECTIONS).length} collections + settings.`)
process.exit(0)
