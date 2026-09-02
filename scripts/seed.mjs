// Seed demo data into Firestore.
// Uses the Firebase Admin SDK (bypasses security rules).
//
//   npm run seed
//
// Skips if `courts` already has documents. Run `npm run unseed -- --yes` first
// to remove demo docs, then seed again.
import { firestore } from './lib/admin.mjs'
import {
  COURTS, MEMBERS, SEED_BOOKINGS, SEED_VOUCHERS, SEED_STAMP_LOG, SEED_SETTINGS, SEED_PAYOUT,
} from '../src/data/index.js'

const stripId = ({ id, ...rest }) => rest

const COLLECTIONS = {
  courts: COURTS,
  members: MEMBERS,
  bookings: SEED_BOOKINGS,
  vouchers: SEED_VOUCHERS,
  stampLog: SEED_STAMP_LOG,
}

const db = firestore()
const existing = await db.collection('courts').limit(1).get()
if (!existing.empty) {
  console.log('courts already has documents — skip seed.')
  console.log('To replace demo data:  npm run unseed -- --yes --courts')
  console.log('Then run:              npm run seed')
  process.exit(0)
}

const batch = db.batch()
let n = 0
for (const [col, rows] of Object.entries(COLLECTIONS)) {
  for (const row of rows) {
    batch.set(db.collection(col).doc(row.id), stripId(row))
    n += 1
  }
}
batch.set(db.collection('config').doc('settings'), SEED_SETTINGS)
n += 1
batch.set(db.collection('config').doc('payout'), SEED_PAYOUT)
n += 1

await batch.commit()
console.log(`Seeded ${n} documents (${Object.keys(COLLECTIONS).join(', ')} + config/settings + config/payout).`)
process.exit(0)
