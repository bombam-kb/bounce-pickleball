// Delete only the demo documents written by `npm run seed` (and the old
// in-app auto-seed). Real LINE/email members, live bookings, and `admins`
// are never touched.
//
//   npm run unseed -- --yes              members, bookings, vouchers, stampLog
//   npm run unseed -- --yes --courts     also delete seed courts c1–c3
//   npm run unseed -- --yes --settings   also delete config/settings
//   npm run unseed -- --yes --all        all of the above
//
// Dry run (print ids, delete nothing):
//   npm run unseed
import { firestore } from './lib/admin.mjs'
import {
  COURTS, MEMBERS, SEED_BOOKINGS, SEED_VOUCHERS, SEED_STAMP_LOG,
} from '../src/data/index.js'

const args = new Set(process.argv.slice(2))
const yes = args.has('--yes')
const all = args.has('--all')
const withCourts = all || args.has('--courts')
const withSettings = all || args.has('--settings')

const GROUPS = {
  members: MEMBERS.map((r) => r.id),
  bookings: SEED_BOOKINGS.map((r) => r.id),
  vouchers: SEED_VOUCHERS.map((r) => r.id),
  stampLog: SEED_STAMP_LOG.map((r) => r.id),
}
if (withCourts) GROUPS.courts = COURTS.map((r) => r.id)
if (withSettings) GROUPS.config = ['settings', 'payout']

const db = firestore()
const plan = []
for (const [col, ids] of Object.entries(GROUPS)) {
  for (const id of ids) {
    const snap = await db.collection(col).doc(id).get()
    if (snap.exists) plan.push({ col, id })
  }
}

if (plan.length === 0) {
  console.log('No seed documents found. Nothing to delete.')
  process.exit(0)
}

console.log('Would delete:')
for (const { col, id } of plan) console.log(`  ${col}/${id}`)
console.log(`${plan.length} document(s). Does not touch admins or live LINE/email accounts.`)

if (!yes) {
  console.log('\nDry run. To delete:  npm run unseed -- --yes')
  process.exit(0)
}

const batch = db.batch()
for (const { col, id } of plan) batch.delete(db.collection(col).doc(id))
await batch.commit()
console.log(`Deleted ${plan.length} seed document(s).`)
process.exit(0)
