/**
 * Verifies the payment-slip storage setup end to end, without taking a payment:
 * bucket exists → the server can upload → a signed URL actually downloads →
 * the 2-year lifecycle rule is in place. Run after finishing FIREBASE_SETUP.md
 * step 3b.
 *
 *   npm run check:storage
 */
import admin from 'firebase-admin'
import { initAdmin } from './lib/admin.mjs'

const RETENTION_DAYS = 730
const PREFIX = 'slips/'

const ok = (m) => console.log(`  ok    ${m}`)
const bad = (m) => console.log(`  FAIL  ${m}`)
const warn = (m) => console.log(`  warn  ${m}`)

const bucketName = (process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FB_STORAGE_BUCKET || '').trim()

async function main() {
  console.log('\nPayment slip storage check\n')

  if (!bucketName) {
    bad('VITE_FB_STORAGE_BUCKET (or FIREBASE_STORAGE_BUCKET) is not set in .env')
    process.exitCode = 1
    return
  }
  ok(`bucket name: ${bucketName}`)

  initAdmin()
  const bucket = admin.storage().bucket(bucketName)

  const [exists] = await bucket.exists()
  if (!exists) {
    bad('bucket does not exist yet')
    console.log('\n        Firebase Console → Build → Storage → Get started.')
    console.log('        Cloud Storage needs the Blaze plan; see FIREBASE_SETUP.md step 3b.\n')
    process.exitCode = 1
    return
  }
  ok('bucket exists')

  const [meta] = await bucket.getMetadata()
  ok(`location: ${meta.location} (${meta.locationType})`)

  // round-trip a throwaway object the same way /api/bookings/pay does
  const probe = bucket.file(`${PREFIX}_healthcheck/${Date.now()}.txt`)
  try {
    await probe.save(Buffer.from('slip storage probe'), {
      resumable: false,
      contentType: 'text/plain',
      metadata: { cacheControl: 'private, max-age=0, no-store' },
    })
    ok('upload works (service account can write)')

    const [url] = await probe.getSignedUrl({
      version: 'v4', action: 'read', expires: Date.now() + 60_000,
    })
    const res = await fetch(url)
    if (res.ok) ok('signed URL downloads (admins can view slips)')
    else bad(`signed URL returned ${res.status} — check the service account has "Service Account Token Creator"`)

    // the PDPA claim in FIREBASE_SETUP.md: no route in without a signed URL
    const encoded = encodeURIComponent(probe.name)
    const leaks = [
      ['Firebase Storage REST', `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encoded}?alt=media`],
      ['raw Cloud Storage URL', `https://storage.googleapis.com/${bucketName}/${probe.name}`],
    ]
    for (const [label, leakUrl] of leaks) {
      const r = await fetch(leakUrl)
      if (r.ok) bad(`PUBLICLY READABLE via ${label} (${r.status}) — slips are exposed`)
      else ok(`not readable anonymously via ${label} (${r.status})`)
    }
  } catch (e) {
    bad(`upload/signed URL failed: ${e.message}`)
    process.exitCode = 1
  } finally {
    await probe.delete().catch(() => {})
  }

  const rules = meta.lifecycle?.rule || []
  const retention = rules.find((r) => {
    if (r.action?.type !== 'Delete') return false
    const prefixes = r.condition?.matchesPrefix || []
    return r.condition?.age === RETENTION_DAYS
      && (prefixes.length === 0 || prefixes.some((p) => PREFIX.startsWith(p) || p.startsWith(PREFIX)))
  })
  if (retention) ok(`retention rule found: delete at ${RETENTION_DAYS} days`)
  else {
    warn(`no ${RETENTION_DAYS}-day delete rule — slips will never expire (PDPA)`)
    console.log(`\n        https://console.cloud.google.com/storage/browser/${bucketName}?tab=lifecycle`)
    console.log(`        Add a rule → Delete object → Age ${RETENTION_DAYS} days, prefix "${PREFIX}"`)
    if (rules.length) console.log(`        (existing rules: ${JSON.stringify(rules)})`)
  }

  console.log('')
}

main().catch((e) => {
  console.error(`\n  FAIL  ${e.message}\n`)
  process.exitCode = 1
})
