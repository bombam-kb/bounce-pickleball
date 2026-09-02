/**
 * Customer vs staff origins.
 *
 * Production serves the staff app on a separate host (convention: admin.<apex>,
 * or whatever VITE_ADMIN_ORIGIN is). The customer bundle never imports admin
 * screens, so downloading the booking site does not download the staff UI.
 *
 * Locally and on the free `*.vercel.app` host both apps share one origin and
 * the staff app lives at /admin. A custom `admin.<apex>` host is optional.
 */
function stripSlash(s) {
  return String(s || '').replace(/\/$/, '')
}

export function publicOrigin() {
  const env = stripSlash(import.meta.env.VITE_PUBLIC_ORIGIN)
  if (env) return env
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function isSharedHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.vercel.app')
}

export function adminOrigin() {
  const env = stripSlash(import.meta.env.VITE_ADMIN_ORIGIN)
  if (env) return env
  if (typeof window === 'undefined') return ''
  const { protocol, hostname, port } = window.location
  // Free Vercel host has no admin.<project>.vercel.app — staff stays at /admin.
  if (isSharedHost(hostname)) {
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`
  }
  const apex = hostname.replace(/^www\./, '').replace(/^admin\./, '')
  return `${protocol}//admin.${apex}`
}

function pathLooksLikeStaff(path) {
  return path === '/admin' || path.startsWith('/admin/') || /(^|\/)admin\.html$/.test(path)
}

export function isAdminHost() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  const path = window.location.pathname
  const env = stripSlash(import.meta.env.VITE_ADMIN_ORIGIN)
  if (env) {
    try {
      return new URL(env).host === window.location.host
    } catch { /* ignore */ }
  }
  // Local + Vercel preview share a host; staff lives at /admin.
  if (isSharedHost(host)) return pathLooksLikeStaff(path)
  return host.startsWith('admin.')
}

/** When VITE_ADMIN_ORIGIN is set, refuse to run the staff app on any other host. */
export function mustMoveToAdminOrigin() {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  if (isSharedHost(host)) return false
  const env = stripSlash(import.meta.env.VITE_ADMIN_ORIGIN)
  if (!env) return false
  try {
    return new URL(env).host !== window.location.host
  } catch {
    return false
  }
}

export function goCustomerSite() {
  const dest = publicOrigin()
  if (dest && dest !== window.location.origin) {
    window.location.assign(`${dest}/`)
    return
  }
  window.location.assign('/')
}

export function goAdminSite() {
  const dest = adminOrigin()
  if (dest && dest !== window.location.origin) {
    window.location.assign(`${dest}/`)
    return
  }
  window.location.assign('/admin')
}
