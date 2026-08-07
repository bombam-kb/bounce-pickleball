// LINE Login (OAuth) helpers — client side only. Channel secret stays on the server.

const STATE_KEY = 'bounce_line_oauth_state'

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
  const state = crypto.randomUUID()
  sessionStorage.setItem(STATE_KEY, state)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: lineCallbackUri(),
    state,
    scope: 'profile openid',
  })
  window.location.assign(`https://access.line.me/oauth2/v2.1/authorize?${params}`)
}

/** Validate CSRF state and return the authorization code from the callback URL. */
export function takeLineCallbackCode() {
  const url = new URL(window.location.href)
  const err = url.searchParams.get('error')
  if (err) {
    const e = new Error(url.searchParams.get('error_description') || err)
    e.code = 'line_denied'
    throw e
  }
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(STATE_KEY)
  if (!code || !state || !expected || state !== expected) {
    const e = new Error('Invalid LINE login state')
    e.code = 'badstate'
    throw e
  }
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
    const e = new Error(data.detail || data.error || 'exchange failed')
    e.code = data.error || 'unknown'
    throw e
  }
  return data.token
}
