import { readFileSync, existsSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

/** `KEY=value` lines from one env file, without touching process.env. */
export function readEnvFile(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

/**
 * Keys that must come from `.env.staging` itself. Anything missing there would
 * otherwise fall back to `.env` and point the test app at the live database.
 */
const STAGING_OWN_KEYS = [
  'VITE_FB_API_KEY',
  'VITE_FB_AUTH_DOMAIN',
  'VITE_FB_PROJECT_ID',
  'VITE_FB_STORAGE_BUCKET',
  'VITE_FB_APP_ID',
]

function serviceAccountProject(root, vars) {
  if (vars.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try { return JSON.parse(vars.FIREBASE_SERVICE_ACCOUNT_JSON).project_id || '' } catch { return '' }
  }
  const rel = vars.FIREBASE_SERVICE_ACCOUNT_PATH
  if (!rel) return ''
  const file = isAbsolute(rel) ? rel : resolve(root, rel)
  if (!existsSync(file)) return ''
  try { return JSON.parse(readFileSync(file, 'utf8')).project_id || '' } catch { return '' }
}

/** Reasons the staging config is unsafe to run. Empty when it is fine. */
export function stagingProblems(root) {
  const stagingFile = join(root, '.env.staging')
  if (!existsSync(stagingFile)) {
    return ['.env.staging is missing. Copy .env.staging.example to .env.staging and fill in the test project keys.']
  }
  const live = readEnvFile(join(root, '.env'))
  const staging = readEnvFile(stagingFile)
  const problems = []
  for (const k of STAGING_OWN_KEYS) {
    if (!staging[k]) problems.push(`${k} must be set in .env.staging`)
  }
  if (!staging.FIREBASE_SERVICE_ACCOUNT_PATH && !staging.FIREBASE_SERVICE_ACCOUNT_JSON) {
    problems.push('FIREBASE_SERVICE_ACCOUNT_PATH must be set in .env.staging (the test project key file)')
  }
  const testProject = staging.VITE_FB_PROJECT_ID || ''
  const liveProject = live.VITE_FB_PROJECT_ID || ''
  if (testProject && liveProject && testProject === liveProject) {
    problems.push(`.env.staging points at the live project (${liveProject})`)
  }
  if (staging.VITE_FB_API_KEY && staging.VITE_FB_API_KEY === live.VITE_FB_API_KEY) {
    problems.push('.env.staging uses the live web API key')
  }
  const saProject = serviceAccountProject(root, staging)
  if (!saProject && (staging.FIREBASE_SERVICE_ACCOUNT_PATH || staging.FIREBASE_SERVICE_ACCOUNT_JSON)) {
    problems.push('the test service account file cannot be read')
  }
  if (saProject && testProject && saProject !== testProject) {
    problems.push(`the test service account belongs to ${saProject}, not ${testProject}`)
  }
  if (saProject && liveProject && saProject === liveProject) {
    problems.push(`the test service account belongs to the live project (${liveProject})`)
  }
  return problems
}

export function assertStaging(root) {
  const problems = stagingProblems(root)
  if (!problems.length) return readEnvFile(join(root, '.env.staging'))
  const msg = [
    '',
    'Refusing to start test mode: it could reach the live database.',
    ...problems.map((p) => `  - ${p}`),
    '',
  ].join('\n')
  throw new Error(msg)
}
