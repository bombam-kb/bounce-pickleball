// LINE Login (OAuth) helpers — client side only. Channel secret stays on the server.
//
// Two real-world flows:
// 1) Open site inside LINE → storage usually survives → login OK
// 2) Open site in a (often private) browser → jump to LINE app → return in a
//    fresh context with empty localStorage/cookies → must rely on ?code=&state=
//    in the callback URL (and in-memory stash for Strict Mode remounts).

const STATE_KEY = 'bounce_line_oauth_state'
const PENDING_KEY = 'bounce_line_oauth_pending'

/** Survives React Strict Mode remounts even when storage is blocked (private mode). */
let memoryPendingCode = null
let callbackFlight = null

function cookieSecureFlag() {
  return window.location.protocol === 'https:' ? '; Secure' : ''
}

function setCookie(name, value, maxAgeSec = 600) {
  try {
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${cookieSecureFlag()}`
  } catch { /* blocked */ }
}

function getCookie(name) {
  try {
    const key = `${encodeURIComponent(name)}=`
    for (const part of document.cookie.split(';')) {
      const p = part.trim()
      if (p.startsWith(key)) return decodeURIComponent(p.slice(key.length))
    }
  } catch { /* blocked */ }
  return null
}

function clearCookie(name) {
  try {
    document.cookie = `${encodeURIComponent(name)}=; Path=/; Max-Age=0; SameSite=Lax${cookieSecureFlag()}`
  } catch { /* blocked */ }
}

function put(name, value) {
  try { localStorage.setItem(name, value) } catch { /* private mode */ }
  setCookie(name, value)
}

function take(name) {
  try {
    const v = localStorage.getItem(name)
    if (v) return v
  } catch { /* ignore */ }
  try {
    const v = sessionStorage.getItem(name)
    if (v) return v
  } catch { /* ignore */ }
  return getCookie(name)
}

function remove(name) {
  try { localStorage.removeItem(name) } catch { /* ignore */ }
  try { sessionStorage.removeItem(name) } catch { /* ignore */ }
  clearCookie(name)
}

export function lineLoginConfigured() {
  return Boolean(import.meta.env.VITE_LINE_CHANNEL_ID)
}

export function lineCallbackUri() {
  return `${window.location.origin}/auth/line/callback`
}

/** Redirect the browser to LINE's authorize page. */
export function startLineLogin() {
  const channelId = import.meta.env.VITE_LINE_CHANNEL_ID
  if (!channelId) {
    const err = new Error('notconfigured')
    err.code = 'notconfigured'
    throw err
  }
  memoryPendingCode = null
  callbackFlight = null
  const state = crypto.randomUUID()
  put(STATE_KEY, state)
  try { sessionStorage.setItem(STATE_KEY, state) } catch { /* private mode */ }
  remove(PENDING_KEY)
  if (import.meta.env.DEV) {
    console.info('[LINE] start login', { redirect_uri: lineCallbackUri(), state })
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: lineCallbackUri(),
    state,
    scope: 'profile openid',
  })
  window.location.assign(`https://access.line.me/oauth2/v2.1/authorize?${params}`)
}

/**
 * Pull the authorization code out of the callback URL once.
 * Order: memory → storage → URL. Stored `state` (cookie + local/session
 * storage) is required — without it anyone could send a victim a callback
 * URL that logs them into the attacker's LINE-linked account. If LINE opened
 * a fresh browser that wiped storage, the user taps login again from here.
 */
function extractCallbackCode() {
  if (memoryPendingCode) return memoryPendingCode

  const fromStore = take(PENDING_KEY)
  if (fromStore) {
    memoryPendingCode = fromStore
    return fromStore
  }

  const url = new URL(window.location.href)
  const err = url.searchParams.get('error')
  if (err) {
    const e = new Error(url.searchParams.get('error_description') || err)
    e.code = 'line_denied'
    throw e
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = take(STATE_KEY)

  if (import.meta.env.DEV) {
    console.info('[LINE] callback', {
      hasCode: Boolean(code),
      state,
      expected,
      match: Boolean(state && expected && state === expected),
    })
  }

  if (!code || !state) {
    const e = new Error(
      !code
        ? 'missing code in callback URL'
        : 'missing state in callback URL — try again from the login button',
    )
    e.code = 'badstate'
    throw e
  }

  if (!expected || state !== expected) {
    const e = new Error('oauth state missing or mismatch — start login again from this browser')
    e.code = 'badstate'
    throw e
  }

  memoryPendingCode = code
  put(PENDING_KEY, code) // best-effort; may fail in private mode
  remove(STATE_KEY)

  // Clear query only after memory stash so Strict Mode remount still works
  url.search = ''
  window.history.replaceState({}, '', url.pathname)
  return code
}

/** Exchange LINE auth code → Firebase custom token via our API. */
export async function exchangeLineCode(code) {
  const res = await fetch('/api/auth/line', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri: lineCallbackUri() }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.token) {
    if (import.meta.env.DEV) console.error('[LINE] exchange failed', res.status, data)
    const e = new Error(data.detail || data.error || 'exchange failed')
    e.code = data.error || 'unknown'
    throw e
  }
  return data.token
}

/** Validate callback + exchange for a Firebase custom token (single-flight). */
export function finishLineLogin() {
  if (!callbackFlight) {
    callbackFlight = (async () => {
      try {
        const code = extractCallbackCode()
        const token = await exchangeLineCode(code)
        remove(PENDING_KEY)
        memoryPendingCode = null
        return token
      } catch (e) {
        callbackFlight = null
        throw e
      }
    })()
  }
  return callbackFlight
}
