/**
 * The customer HTML must not pull in the staff entry. Run after `npm run build`.
 * Skipped when dist/ is missing so `check:security` still works without a build.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { projectRoot } from './lib/loadEnv.mjs'

const root = projectRoot()
const dist = resolve(root, 'dist')

if (!existsSync(resolve(dist, 'index.html'))) {
  console.log('\n  skip  customer/admin bundle check — run npm run build first\n')
  process.exit(0)
}

const index = readFileSync(resolve(dist, 'index.html'), 'utf8')
const admin = existsSync(resolve(dist, 'admin.html'))
  ? readFileSync(resolve(dist, 'admin.html'), 'utf8')
  : ''

const jsRefs = (html) => [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1])
const customerScripts = jsRefs(index)
const adminScripts = jsRefs(admin)

let fail = 0
const ok = (pass, name, detail = '') => {
  if (!pass) fail += 1
  console.log(`  ${pass ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

console.log('\nCustomer vs staff bundles\n')
ok(admin.length > 0, 'admin.html is in the build')
ok(!index.includes('admin.html') && !index.includes('src/admin'),
  'customer index.html does not reference the staff entry')
ok(customerScripts.every((s) => !/\/admin[-.]/i.test(s)),
  'customer HTML does not load the staff entry',
  customerScripts.join(', '))
ok(adminScripts.some((s) => /\/admin[-.]/i.test(s) || s.includes('src/admin')),
  'staff HTML loads a separate entry')

const assets = existsSync(resolve(dist, 'assets')) ? readdirSync(resolve(dist, 'assets')) : []
const read = (name) => readFileSync(resolve(dist, 'assets', name), 'utf8')
const fileOf = (s) => s.split('/').pop()
const customerJs = customerScripts
  .map(fileOf)
  .filter((n) => n.endsWith('.js') && assets.includes(n))
  .map(read)
  .join('\n')
const adminEntryJs = adminScripts
  .map(fileOf)
  .filter((n) => /^admin[-.]/.test(n) && assets.includes(n))
  .map(read)
  .join('\n')

ok(!customerJs.includes('a-shell'),
  'customer JS does not contain the staff chrome')
ok(adminEntryJs.includes('a-shell'),
  'staff JS contains the staff chrome')

console.log(fail ? `\n${fail} bundle check(s) FAILED\n` : '\nall bundle checks passed\n')
if (fail) process.exitCode = 1
