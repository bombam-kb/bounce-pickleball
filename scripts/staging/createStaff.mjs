/**
 * Create (or reuse) a staff login in the test project only.
 *
 *   npm run staging:staff -- staff@example.com 'password123'
 */
import admin from 'firebase-admin'
import { firestore } from '../lib/admin.mjs'
import { isStaging } from '../lib/loadEnv.mjs'

if (!isStaging()) {
  console.error('Run this through `npm run staging:staff` so it only touches the test project.')
  process.exit(1)
}

const [email, password] = process.argv.slice(2)
if (!email || !password || password.length < 6) {
  console.error("Usage: npm run staging:staff -- staff@example.com 'password (6+ chars)'")
  process.exit(1)
}

const db = firestore()
const auth = admin.auth()
let user
try {
  user = await auth.getUserByEmail(email)
  await auth.updateUser(user.uid, { password, emailVerified: true })
} catch (e) {
  if (e?.code !== 'auth/user-not-found') throw e
  user = await auth.createUser({ email, password, emailVerified: true, displayName: 'Test staff' })
}
await db.collection('admins').doc(user.uid).set({ email, role: 'staff', createdBy: 'staging-script' }, { merge: true })
console.log(`Staff login ready in ${admin.app().options.projectId}: ${email}`)
process.exit(0)
