import React, { useState, useEffect } from 'react'
import { StoreProvider } from './store.jsx'
import UserApp from './user/UserApp.jsx'
import AdminApp from './admin/AdminApp.jsx'

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
      {side === 'admin' ? <AdminApp goUser={() => go('user')} /> : <UserApp />}
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
