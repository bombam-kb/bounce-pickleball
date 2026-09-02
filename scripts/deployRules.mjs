/**
 * Publishes firestore.rules to the live project.
 *
 * Keeping the rules in the repo and shipping them from here means the
 * authorization model is reviewable and testable (`npm run check:security`)
 * instead of living as a block of text someone pastes into a console.
 *
 * Usage: npm run rules:deploy
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import admin from 'firebase-admin'
import { initAdmin } from './lib/admin.mjs'
import { projectRoot } from './lib/loadEnv.mjs'

const API = 'https://firebaserules.googleapis.com/v1'

async function accessToken() {
  const token = await admin.app().options.credential.getAccessToken()
  return token.access_token
}

async function call(path, { method = 'POST', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json
}

async function main() {
  const app = initAdmin()
  const projectId = app.options.projectId
  const file = resolve(projectRoot(), 'firestore.rules')
  const source = readFileSync(file, 'utf8')

  console.log(`\nPublishing firestore.rules → ${projectId}`)

  const ruleset = await call(`/projects/${projectId}/rulesets`, {
    body: { source: { files: [{ name: 'firestore.rules', content: source }] } },
  })
  console.log(`  ok    ruleset created: ${ruleset.name}`)

  // the release name Firestore actually serves from
  const releaseId = `cloud.firestore`
  const releaseBody = { name: `projects/${projectId}/releases/${releaseId}`, rulesetName: ruleset.name }
  try {
    await call(`/projects/${projectId}/releases/${releaseId}?updateMask=rulesetName`, {
      method: 'PATCH',
      body: { release: releaseBody },
    })
    console.log('  ok    release updated — rules are live')
  } catch (e) {
    if (!/not found/i.test(e.message)) throw e
    await call(`/projects/${projectId}/releases`, { body: releaseBody })
    console.log('  ok    release created — rules are live')
  }
  console.log('')
}

main().catch((e) => {
  console.error(`\n  FAIL  ${e.message}\n`)
  process.exitCode = 1
})
