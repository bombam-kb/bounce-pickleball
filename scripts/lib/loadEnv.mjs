import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readEnvFile, assertStaging } from './envTarget.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** `BOUNCE_ENV=staging` targets the test project; anything else is the live one. */
export const isStaging = () => process.env.BOUNCE_ENV === 'staging'

function apply(vars) {
  for (const [k, v] of Object.entries(vars)) {
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v
  }
}

/**
 * Load env files into process.env without overwriting values already set.
 * In staging, `.env.staging` is checked first and loaded ahead of `.env`, so
 * shared keys such as LINE or SlipOK still come from `.env`.
 */
export function loadDotEnv() {
  if (isStaging()) apply(assertStaging(root))
  apply(readEnvFile(join(root, '.env')))
}

export function projectRoot() {
  return root
}
