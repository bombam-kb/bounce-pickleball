import React, { useEffect, Suspense, lazy } from 'react'
import { StoreProvider } from './store.jsx'
import { firebaseReady } from './firebase.js'
import Logo from './components/Logo.jsx'
import { goAdminSite, adminOrigin } from './origins.js'

const UserApp = lazy(() => import('./user/UserApp.jsx'))
const LineCallback = lazy(() => import('./user/LineCallback.jsx'))

const Loading = () => (
  <div className="app-boot">
    <Logo variant="light" size="xl" animate />
  </div>
)

const isLineCallback = () => window.location.pathname === '/auth/line/callback'

/**
 * Customer origin only. Staff UI is a separate entry (`admin.html`) served on
 * the admin host — this file must never import `src/admin/*`.
 */
export default function CustomerApp() {
  const staffPath = window.location.pathname === '/admin'
    || window.location.pathname.startsWith('/admin/')
  const sendToStaffOrigin = staffPath && adminOrigin() !== window.location.origin

  useEffect(() => {
    if (sendToStaffOrigin) goAdminSite()
  }, [sendToStaffOrigin])

  if (sendToStaffOrigin) return null

  return (
    <StoreProvider>
      {!firebaseReady && (
        <div style={{
          background: '#7A1F1F', color: '#fff', padding: '10px 14px', fontSize: 13,
          fontFamily: 'var(--font-body)', textAlign: 'center', lineHeight: 1.4,
        }}>
          ⚠ Firebase is not configured — copy <code>.env.example</code> to <code>.env</code>,
          fill in your keys, and restart. See <b>FIREBASE_SETUP.md</b>.
        </div>
      )}
      <Suspense fallback={<Loading />}>
        {isLineCallback() ? <LineCallback /> : <UserApp />}
      </Suspense>
    </StoreProvider>
  )
}
