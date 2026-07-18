// ── Firebase bootstrap ────────────────────────────────────────────────────
// Config comes from Vite env vars (VITE_FB_*). See FIREBASE_SETUP.md for how
// to create the project and fill in .env. If the vars are missing the app
// stays up but shows a "not configured" notice instead of crashing.
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
}

// enough config present to connect?
export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app = null
let auth = null
let db = null

if (firebaseReady) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)
} else {
  // eslint-disable-next-line no-console
  console.warn('[Bounce] Firebase env vars missing — see FIREBASE_SETUP.md. Running without a backend.')
}

export { app, auth, db }
