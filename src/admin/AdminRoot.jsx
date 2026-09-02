import React, { useEffect } from 'react'
import { StoreProvider } from '../store.jsx'
import { firebaseReady } from '../firebase.js'
import { goAdminSite, goCustomerSite, isAdminHost, mustMoveToAdminOrigin } from '../origins.js'
import AdminApp from './AdminApp.jsx'

/**
 * Staff origin. If this bundle is somehow opened on the customer host, bounce
 * to the admin origin instead of rendering the panel there.
 */
export default function AdminRoot() {
  useEffect(() => {
    if (mustMoveToAdminOrigin() || !isAdminHost()) goAdminSite()
  }, [])

  if (mustMoveToAdminOrigin() || !isAdminHost()) return null

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
      <AdminApp goUser={goCustomerSite} />
    </StoreProvider>
  )
}
