import React, { useState, useEffect, Suspense, lazy } from 'react'
import { StoreProvider } from './store.jsx'
import { firebaseReady } from './firebase.js'

// code-split: customers never download the admin bundle (and vice versa)
const UserApp = lazy(() => import('./user/UserApp.jsx'))
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

const Loading = () => (
  <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 40, animation: 'bounceIn 0.6s ease' }}>🏓</div>
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--ink-3)' }}>Bounce…</div>
  </div>
)

// Two-sided app: customer site at "/", staff panel at "/admin"
export default function App() {
  const [side, setSide] = useState(window.location.pathname.startsWith('/admin') ? 'admin' : 'user')

  const go = (s) => {
    window.history.pushState({}, '', s === 'admin' ? '/admin' : '/')
    setSide(s)
  }
  useEffect(() => {
    const onPop = () => setSide(window.location.pathname.startsWith('/admin') ? 'admin' : 'user')
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
        {side === 'admin' ? <AdminApp goUser={() => go('user')} /> : <UserApp />}
      </Suspense>
      {side === 'user' && (
        <button onClick={() => go('admin')} title="Staff only" style={{
          position: 'fixed', bottom: 84, right: 12, zIndex: 90,
          border: '2px solid var(--stroke)', borderRadius: 999,
          background: 'var(--pine)', color: 'var(--lime)',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
          padding: '6px 12px', boxShadow: 'var(--shadow-pop-sm)', opacity: 0.85, cursor: 'pointer',
        }}>⚙ Admin</button>
      )}
    </StoreProvider>
  )
}
