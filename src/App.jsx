import React, { useState, useEffect, Suspense, lazy } from 'react'
import { StoreProvider } from './store.jsx'
import { firebaseReady } from './firebase.js'
import Logo from './components/Logo.jsx'

// code-split: customers never download the admin bundle (and vice versa)
const UserApp = lazy(() => import('./user/UserApp.jsx'))
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))
const LineCallback = lazy(() => import('./user/LineCallback.jsx'))

const Loading = () => (
  <div className="app-boot">
    <Logo variant="light" size="xl" animate />
  </div>
)

const isLineCallback = () => window.location.pathname === '/auth/line/callback'

// Two-sided app: customer site at "/", staff panel at "/admin"
export default function App() {
  const [side, setSide] = useState(window.location.pathname.startsWith('/admin') ? 'admin' : 'user')
  const [lineCb, setLineCb] = useState(isLineCallback)

  const go = (s) => {
    window.history.pushState({}, '', s === 'admin' ? '/admin' : '/')
    setSide(s)
    setLineCb(false)
  }
  useEffect(() => {
    const onPop = () => {
      setLineCb(isLineCallback())
      setSide(window.location.pathname.startsWith('/admin') ? 'admin' : 'user')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

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
        {lineCb ? (
          <LineCallback />
        ) : side === 'admin' ? (
          <AdminApp goUser={() => go('user')} />
        ) : (
          <UserApp />
        )}
      </Suspense>
      {side === 'user' && !lineCb && (
        <button onClick={() => go('admin')} title="Staff only" style={{
          position: 'fixed', bottom: 'calc(var(--u-nav-h) + env(safe-area-inset-bottom, 0px) + 10px)', left: 12, right: 'auto', zIndex: 80,
          border: '2px solid var(--stroke)', borderRadius: 999,
          background: 'var(--pine)', color: 'var(--lime)',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
          padding: '6px 12px', boxShadow: 'var(--shadow-pop-sm)', opacity: 0.85, cursor: 'pointer',
        }}>⚙ Admin</button>
      )}
    </StoreProvider>
  )
}
