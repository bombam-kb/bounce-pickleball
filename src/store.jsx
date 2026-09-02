import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, onAuthStateChanged, updateProfile,
  signInWithCustomToken,
} from 'firebase/auth'
import {
  collection, doc, getDoc, getDocs, onSnapshot,
  setDoc, updateDoc, deleteDoc, writeBatch, query, where,
} from 'firebase/firestore'
import { auth, db, firebaseReady } from './firebase.js'
import {
  genRef, todayISO, isPeak, nowLocalISO, sortSlotItems, SEED_SETTINGS, SEED_PAYOUT,
} from './data/index.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

// collision-safe ids for docs we create client-side (bookings, vouchers, …)
const nid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
// Firestore keeps the id as the doc key, so never store it in the doc body too
const stripId = ({ id, ...rest }) => rest

// map Firebase Auth error codes → the ERR keys the Login UI knows about
const mapAuthError = (e) => {
  switch (e?.code) {
    case 'auth/email-already-in-use': return 'exists'
    case 'auth/invalid-email': return 'bademail'
    case 'auth/weak-password': return 'shortpass'
    case 'auth/missing-password':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'badpass'
    case 'auth/user-not-found': return 'notfound'
    case 'auth/too-many-requests': return 'toomany'
    case 'auth/network-request-failed': return 'network'
    default: return 'unknown'
  }
}

export function StoreProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('bounce_lang') || 'th')

  // ── live data mirrored from Firestore (source of truth = Firestore) ──
  const [courts, setCourts] = useState([])
  const [members, setMembers] = useState([])
  const [bookings, setBookings] = useState([])
  const [vouchers, setVouchers] = useState([])
  const [stampLog, setStampLog] = useState([])
  const [settings, setSettingsState] = useState({ ...SEED_SETTINGS, ...SEED_PAYOUT })
  const [adminLog, setAdminLog] = useState([])
  // `${courtId}|${date}|${hour}` of slots booked by anyone, from
  // /api/slots/taken — customers can no longer read others' bookings
  const [takenSlots, setTakenSlots] = useState(() => new Set())

  // ── session / device state (not business data → kept local) ──
  const [user, setUser] = useState(null)          // logged-in member
  const [isAdmin, setIsAdmin] = useState(false)    // current auth user is staff (in admins/)
  const [authUid, setAuthUid] = useState(null)     // signed-in Firebase uid — drives private listeners
  const [authReady, setAuthReady] = useState(false)
  const [notifications, setNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bounce_notifs') || '[]') } catch { return [] }
  })

  // shared row mapper + sort
  const rowsOf = (snap, sort) => {
    const r = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    return sort ? r.sort(sort) : r
  }
  const errLog = (name) => (e) => console.error(`[Bounce] ${name} listener`, e)

  // ── public catalog (courts, settings): readable without auth, so
  //    subscribe once on mount. Demo data is loaded with `npm run seed`. ──
  useEffect(() => {
    if (!firebaseReady) { setAuthReady(true); return }
    const unsubs = []
    unsubs.push(onSnapshot(collection(db, 'courts'),
      (s) => setCourts(rowsOf(s, (a, b) => (a.id < b.id ? -1 : 1))), errLog('courts')))
    unsubs.push(onSnapshot(doc(db, 'config', 'settings'),
      (d) => {
        if (!d.exists()) return
        const data = { ...d.data() }
        // payout fields live on config/payout (auth-only). Ignore them if an
        // old settings doc still carries them so they never sit in the public
        // catalog listener.
        delete data.payAccountName
        delete data.payAccountNo
        delete data.promptPayId
        setSettingsState((prev) => ({
          ...SEED_SETTINGS,
          ...SEED_PAYOUT,
          ...data,
          payAccountName: prev.payAccountName,
          payAccountNo: prev.payAccountNo,
          promptPayId: prev.promptPayId,
        }))
      }, errLog('settings')))
    return () => unsubs.forEach((u) => u && u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── private collections (members, bookings, vouchers, stampLog, adminLog):
  //    require auth to read, so (re)subscribe whenever the signed-in user
  //    changes. Attaching before login would hit PERMISSION_DENIED and never
  //    recover — leaving these empty even after logging in.
  //
  //    Customers only get their own rows: Firestore rules reject anything
  //    wider, and a whole-collection listener would leak every member's name,
  //    phone and booking history to anyone who opened DevTools. Staff still
  //    need the full picture, so the subscription shape follows the role and
  //    re-attaches when `isAdmin` resolves. ──
  useEffect(() => {
    if (!firebaseReady) return
    if (!authUid) {
      setMembers([]); setBookings([]); setVouchers([]); setStampLog([]); setAdminLog([])
      setTakenSlots(new Set())
      setSettingsState((prev) => ({ ...prev, ...SEED_PAYOUT }))
      return
    }
    const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
    const mine = (name) => query(collection(db, name), where('userId', '==', authUid))

    if (!isAdmin) {
      setAdminLog([])
      const unsubs = [
        onSnapshot(doc(db, 'members', authUid),
          (d) => setMembers(d.exists() ? [{ id: d.id, ...d.data() }] : []), errLog('members')),
        onSnapshot(mine('bookings'), (s) => setBookings(rowsOf(s)), errLog('bookings')),
        onSnapshot(mine('vouchers'), (s) => setVouchers(rowsOf(s, byDateDesc)), errLog('vouchers')),
        onSnapshot(mine('stampLog'), (s) => setStampLog(rowsOf(s, byDateDesc)), errLog('stampLog')),
        onSnapshot(doc(db, 'config', 'payout'),
          (d) => {
            const p = d.exists() ? (d.data() || {}) : {}
            setSettingsState((prev) => ({
              ...prev,
              payAccountName: String(p.payAccountName || ''),
              payAccountNo: String(p.payAccountNo || ''),
              promptPayId: String(p.promptPayId || ''),
            }))
          }, errLog('payout')),
      ]
      return () => unsubs.forEach((u) => u && u())
    }

    const unsubs = [
      onSnapshot(collection(db, 'members'), (s) => setMembers(rowsOf(s)), errLog('members')),
      onSnapshot(collection(db, 'bookings'), (s) => setBookings(rowsOf(s)), errLog('bookings')),
      onSnapshot(collection(db, 'vouchers'), (s) => setVouchers(rowsOf(s, byDateDesc)), errLog('vouchers')),
      onSnapshot(collection(db, 'stampLog'), (s) => setStampLog(rowsOf(s, byDateDesc)), errLog('stampLog')),
      onSnapshot(collection(db, 'adminLog'), (s) => setAdminLog(rowsOf(s)), errLog('adminLog')),
      onSnapshot(doc(db, 'config', 'payout'),
        (d) => {
          const p = d.exists() ? (d.data() || {}) : {}
          setSettingsState((prev) => ({
            ...prev,
            payAccountName: String(p.payAccountName || ''),
            payAccountNo: String(p.payAccountNo || ''),
            promptPayId: String(p.promptPayId || ''),
          }))
        }, errLog('payout')),
    ]
    return () => unsubs.forEach((u) => u && u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUid, isAdmin])

  // auth session → determine staff vs customer, resolve member doc into `user`
  useEffect(() => {
    if (!firebaseReady) return
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setAuthUid(fbUser ? fbUser.uid : null)
      if (fbUser) {
        let admin = false
        try {
          const adminSnap = await getDoc(doc(db, 'admins', fbUser.uid))
          admin = adminSnap.exists()
        } catch (e) { console.error('[Bounce] admin check', e) }
        setIsAdmin(admin)
        if (admin) {
          setUser(null)                                 // staff are not customers
        } else {
          // Email/password accounts must verify; LINE (custom token) has no email verify step.
          const isPassword = fbUser.providerData.some((p) => p.providerId === 'password')
          if (isPassword && !fbUser.emailVerified) {
            setUser(null)
          } else {
            try {
              const snap = await getDoc(doc(db, 'members', fbUser.uid))
              if (snap.exists() && snap.data()?.suspended) {
                await signOut(auth)
                setUser(null)
              } else if (snap.exists()) {
                setUser({ id: snap.id, ...snap.data() })
              } else setUser(null)
            } catch (e) { console.error('[Bounce] load member', e) }
          }
        }
      } else {
        setIsAdmin(false)
        setUser(null)
      }
      setAuthReady(true)
    })
    return unsub
  }, [])

  // keep the logged-in user's stamps/bookings live as members updates;
  // also drop the session the moment staff flip `suspended` on a live user
  useEffect(() => {
    if (!user) return
    const fresh = members.find((m) => m.id === user.id)
    if (!fresh) return
    if (fresh.suspended) {
      signOut(auth).catch(() => {})
      setUser(null)
      return
    }
    setUser((u) => ({ ...u, ...fresh }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members])

  // persist device-local bits
  useEffect(() => {
    try { localStorage.setItem('bounce_notifs', JSON.stringify(notifications.slice(0, 50))) } catch { /* quota */ }
  }, [notifications])

  const switchLang = useCallback((l) => {
    setLang(l)
    localStorage.setItem('bounce_lang', l)
  }, [])

  // ── admin (staff) auth via Firebase — must be listed in the admins/ collection ──
  const adminLogin = useCallback(async (email, password) => {
    if (!firebaseReady) return { error: 'notconfigured' }
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
      const adminSnap = await getDoc(doc(db, 'admins', cred.user.uid))
      if (!adminSnap.exists()) { await signOut(auth); return { error: 'notadmin' } }
      return { ok: true } // onAuthStateChanged sets isAdmin
    } catch (e) {
      return { error: mapAuthError(e) }
    }
  }, [])
  const adminLogout = useCallback(async () => {
    try { if (firebaseReady && auth.currentUser) await signOut(auth) } catch { /* ignore */ }
    setIsAdmin(false)
  }, [])

  // clears device-local state only — does not wipe the shared Firestore data
  const resetDemo = useCallback(async () => {
    try { if (firebaseReady && auth.currentUser) await signOut(auth) } catch { /* ignore */ }
    localStorage.removeItem('bounce_notifs')
    window.location.reload()
  }, [])

  // ── LINE login: custom token from /api/auth/line (see api/_lib/lineExchange.js) ──
  const completeLineLogin = useCallback(async (firebaseToken) => {
    if (!firebaseReady) return { error: 'notconfigured' }
    try {
      const cred = await signInWithCustomToken(auth, firebaseToken)
      const snap = await getDoc(doc(db, 'members', cred.user.uid))
      if (snap.exists() && snap.data().suspended) {
        await signOut(auth)
        return { error: 'suspended' }
      }
      return { ok: true } // onAuthStateChanged populates `user`
    } catch (e) {
      return { error: mapAuthError(e) }
    }
  }, [])

  const logout = useCallback(async () => {
    try { if (firebaseReady && auth.currentUser) await signOut(auth) } catch { /* ignore */ }
    setUser(null)
  }, [])

  // ── notifications (in-app + browser Notification API when granted) ──
  const notify = useCallback((title, body) => {
    setNotifications((ns) => [
      { id: nid('n'), title, body, date: nowLocalISO(), read: false }, ...ns,
    ].slice(0, 50))
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(title, { body, icon: '/favicon.svg' }) } catch { /* not supported */ }
    }
  }, [])
  const markNotifsRead = useCallback(() =>
    setNotifications((ns) => ns.map((n) => (n.read ? n : { ...n, read: true }))), [])

  // ── email auth via Firebase Auth (verification is a link Firebase emails) ──
  const registerEmail = useCallback(async (name, email, password) => {
    if (!firebaseReady) return { error: 'notconfigured' }
    const em = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { error: 'bademail' }
    if (password.length < 8) return { error: 'shortpass' }
    try {
      const cred = await createUserWithEmailAndPassword(auth, em, password)
      try { await updateProfile(cred.user, { displayName: name.trim() }) } catch { /* non-fatal */ }
      const member = {
        name: name.trim(), email: em, phone: '', channel: 'email',
        country: lang === 'th' ? 'TH' : '—', lang, avatar: '🏓',
        stamps: 0, bookingsYear: 0, suspended: false,
        joined: todayISO(), birthday: null,
      }
      await setDoc(doc(db, 'members', cred.user.uid), member)
      await sendEmailVerification(cred.user)
      await signOut(auth)     // must verify via the emailed link before first login
      return { ok: true, email: em }
    } catch (e) {
      return { error: mapAuthError(e) }
    }
  }, [lang])

  const loginEmail = useCallback(async (email, password) => {
    if (!firebaseReady) return { error: 'notconfigured' }
    const em = email.trim().toLowerCase()
    try {
      const cred = await signInWithEmailAndPassword(auth, em, password)
      if (!cred.user.emailVerified) { await signOut(auth); return { error: 'notverified' } }
      const snap = await getDoc(doc(db, 'members', cred.user.uid))
      if (snap.exists() && snap.data().suspended) { await signOut(auth); return { error: 'suspended' } }
      return { ok: true } // onAuthStateChanged populates `user`
    } catch (e) {
      return { error: mapAuthError(e) }
    }
  }, [])

  // re-send the verification link (needs the credentials from the register form)
  const resendVerification = useCallback(async (email, password) => {
    if (!firebaseReady) return { error: 'notconfigured' }
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
      if (cred.user.emailVerified) { await signOut(auth); return { alreadyVerified: true } }
      await sendEmailVerification(cred.user)
      await signOut(auth)
      return { ok: true }
    } catch (e) {
      return { error: mapAuthError(e) }
    }
  }, [])

  // Firebase emails a reset link — no in-app code step anymore
  const requestReset = useCallback(async (email) => {
    if (!firebaseReady) return { error: 'notconfigured' }
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase())
      return { ok: true }
    } catch (e) {
      return { error: mapAuthError(e) }
    }
  }, [])

  // ── authenticated call to our own /api/* handlers.
  // Rejects with an Error whose `code` is the server's `error` string. ──
  const apiPost = useCallback(async (url, payload) => {
    const current = firebaseReady ? auth.currentUser : null
    if (!current) throw Object.assign(new Error('auth'), { code: 'auth' })
    let token
    try {
      token = await current.getIdToken()
    } catch {
      throw Object.assign(new Error('auth'), { code: 'auth' })
    }
    let res
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload || {}),
      })
    } catch {
      throw Object.assign(new Error('network'), { code: 'network' })
    }
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) {
      throw Object.assign(new Error(json.error || 'unknown'), { code: json.error || 'unknown', data: json })
    }
    return json
  }, [])

  // Occupancy for the booking grid. Customers can only read their own
  // bookings, so which slots *other* people took comes from /api/slots/taken —
  // court, date and hour only, no names or amounts. Staff already hold the
  // full `bookings` snapshot and don't need the call.
  const loadTakenSlots = useCallback(async (dates) => {
    const want = [...new Set((dates || []).filter(Boolean))]
    if (!want.length || isAdmin) return
    try {
      const res = await apiPost('/api/slots/taken', { dates: want })
      setTakenSlots((prev) => {
        const next = new Set(prev)
        // drop the stale view of these dates before re-adding, so a cancelled
        // booking actually frees its slot again
        for (const key of prev) {
          const [, d] = key.split('|')
          if (want.includes(d)) next.delete(key)
        }
        Object.entries(res.taken || {}).forEach(([date, slots]) => {
          (slots || []).forEach((s) => next.add(`${s.courtId}|${date}|${s.hour}`))
        })
        return next
      })
    } catch (e) {
      console.error('[Bounce] taken slots', e)
    }
  }, [apiPost, isAdmin])

  // slot status for a court/date/hour
  const slotStatus = useCallback((court, date, hour) => {
    if (hour < court.open || hour >= court.close) return 'closed'
    if ((court.blocked || []).some((b) => b.date === date && b.hour === hour)) return 'closed'
    const now = new Date()
    const slotTime = new Date(date + 'T00:00:00')
    slotTime.setHours(hour)
    if (slotTime <= now) return 'past'
    const taken = takenSlots.has(`${court.id}|${date}|${hour}`) || bookings.some(
      (b) => b.courtId === court.id && b.date === date && b.hour === hour && b.status !== 'cancelled'
    )
    return taken ? 'booked' : 'free'
  }, [bookings, takenSlots])

  // add/subtract stamps for one member; issues a voucher when 10 are reached.
  // reads the current member from the live snapshot (single-shot; callers that
  // add several stamps at once must batch the math themselves — see below).
  const addStamp = useCallback(async (userId, note, delta = 1, by = 'system') => {
    if (!firebaseReady) return false
    const member = members.find((m) => m.id === userId)
    if (!member) return false
    const batch = writeBatch(db)
    batch.set(doc(db, 'stampLog', nid('s')), { userId, date: todayISO(), delta, note, by })
    let stamps = (member.stamps || 0) + delta
    let issued = 0
    while (stamps >= 10) { stamps -= 10; issued += 1 }
    if (stamps < 0) stamps = 0
    batch.update(doc(db, 'members', userId), {
      stamps, bookingsYear: delta > 0 ? (member.bookingsYear || 0) + 1 : member.bookingsYear,
    })
    for (let k = 0; k < issued; k += 1) {
      batch.set(doc(db, 'vouchers', nid('v')), {
        userId, issued: todayISO(), expiry: null, used: false, source: 'stamps',
      })
    }
    await batch.commit()
    return issued > 0
  }, [members])

  // ── multi-slot checkout — runs entirely on the server (`/api/bookings/pay`).
  // The browser only says *what* it wants; price, slip verification, voucher
  // ownership and stamp math are all decided there, and Firestore rules block
  // customer writes to bookings/vouchers/stampLog. `slip` is a data-URL of the
  // transfer slip and is required whenever the server total is above ฿0. ──
  const createMultiBooking = useCallback(async (items, { voucherId, slip } = {}) => {
    const res = await apiPost('/api/bookings/pay', {
      items: items.map((it) => ({ courtId: it.courtId, date: it.date, hour: it.hour })),
      voucherId: voucherId || '',
      slip: slip || '',
    })
    const newBookings = res.bookings || []
    const voucherEarned = !!res.voucherEarned
    if (!newBookings.length) throw Object.assign(new Error('unknown'), { code: 'unknown' })
    const grandTotal = newBookings.reduce((s, b) => s + b.total, 0)
    notify(
      newBookings.length > 1
        ? (lang === 'th' ? `✅ จองสำเร็จ ${newBookings.length} รายการ` : `✅ ${newBookings.length} bookings confirmed`)
        : (lang === 'th' ? `✅ จองสำเร็จ ${newBookings[0].ref}` : `✅ Booking confirmed ${newBookings[0].ref}`),
      lang === 'th' ? `ยอดรวม ฿${grandTotal}` : `Total ฿${grandTotal}`)
    if (voucherEarned) {
      notify(lang === 'th' ? '🎁 คุณได้รับ Free Booking 1 ครั้ง!' : '🎁 You earned 1 Free Booking!',
        lang === 'th' ? 'สะสมแสตมป์ครบ 10 ดวงแล้ว' : 'You collected 10 stamps')
    }
    return { bookings: newBookings, voucherEarned }
  }, [apiPost, notify, lang])

  // ── admin: short-lived signed URL for a stored payment slip.
  // The bucket is private; only `/api/admin/slip` can mint a link, and every
  // call is written to adminLog (PDPA access trail). ──
  const fetchSlipUrl = useCallback(async (bookingId) =>
    apiPost('/api/admin/slip', { bookingId }), [apiPost])

  const cancelBooking = useCallback(async (bookingId, by = 'user') => {
    const bk = bookings.find((b) => b.id === bookingId)
    if (!bk) return
    await updateDoc(doc(db, 'bookings', bookingId), { status: 'cancelled' })
    if (!bk.voucherUsed) await addStamp(bk.userId, `Cancelled ${bk.ref} — stamp refund`, -1, by)
    notify(
      lang === 'th' ? `❌ ยกเลิกการจอง ${bk.ref}` : `❌ Booking cancelled ${bk.ref}`,
      bk.voucherUsed
        ? (lang === 'th' ? 'Voucher ที่ใช้ไปจะไม่ถูกคืน' : 'The voucher used is not refunded')
        : (lang === 'th' ? 'แสตมป์จากการจองนี้ถูกหักคืนแล้ว' : 'The stamp from this booking was refunded'))
  }, [bookings, addStamp, notify, lang])

  const logAdmin = useCallback(async (action) => {
    if (!firebaseReady) return
    await setDoc(doc(db, 'adminLog', nid('a')), { date: new Date().toLocaleString(), action })
  }, [])

  // ── admin data mutations (write straight to Firestore) ──
  const saveCourt = useCallback(async (court) => {
    const id = court.id || ('c' + Date.now())
    const data = court.id
      ? court
      : { ...court, nameTh: court.nameTh || court.name, descTh: court.descTh || court.desc }
    await setDoc(doc(db, 'courts', id), stripId({ ...data, id }))
  }, [])
  const deleteCourt = useCallback(async (id) => { await deleteDoc(doc(db, 'courts', id)) }, [])
  const updateCourt = useCallback(async (id, patch) => { await updateDoc(doc(db, 'courts', id), patch) }, [])

  const updateMember = useCallback(async (id, patch) => { await updateDoc(doc(db, 'members', id), patch) }, [])

  const saveSettings = useCallback(async (obj) => {
    const payout = {
      payAccountName: String(obj.payAccountName || '').trim(),
      payAccountNo: String(obj.payAccountNo || '').replace(/\D/g, ''),
      promptPayId: String(obj.promptPayId || '').replace(/\D/g, ''),
    }
    const rest = { ...obj }
    delete rest.payAccountName
    delete rest.payAccountNo
    delete rest.promptPayId
    delete rest.gatewayKey
    await Promise.all([
      setDoc(doc(db, 'config', 'settings'), rest),
      setDoc(doc(db, 'config', 'payout'), payout),
    ])
  }, [])

  // ── admin manual booking — for phone-in / walk-in customers. Books one or
  //    more slots (any court/date/hour) for a member in a single batch, with
  //    one stamp per booking and any earned free-vouchers. ──
  // pass either `userId` (existing member) or `guest` ({name, phone}) for a
  // walk-in with no account — the guest gets a lightweight member record.
  const adminCreateMultiBooking = useCallback(async ({ userId, guest, items, duration = 60 }) => {
    if (!items.length) return []
    const uid = userId || (guest ? nid('u') : null)
    if (!uid) return []
    const existing = userId ? members.find((m) => m.id === userId) : null

    const ordered = sortSlotItems(items, courts.map((c) => c.id))
    const clash = ordered.some((it, i) =>
      ordered.some((o, j) => j !== i && o.courtId === it.courtId && o.date === it.date && o.hour === it.hour)
      || bookings.some((b) => b.courtId === it.courtId && b.date === it.date && b.hour === it.hour && b.status !== 'cancelled')
    )
    if (clash) throw new Error('slot_taken')

    const batch = writeBatch(db)
    const createdAt = nowLocalISO()
    const ref = genRef()          // one reference for the whole booking session
    const newBookings = ordered.map((it) => {
      const court = courts.find((c) => c.id === it.courtId)
      if (!court) throw new Error('court_missing')
      const base = (isPeak(it.hour, court) ? court.pricePeak : court.priceOff) * (duration / 60)
      return {
        id: nid('b'), ref, userId: uid, courtId: it.courtId, date: it.date, hour: it.hour, duration,
        price: base, discount: 0, total: base, payMethod: 'counter',
        status: 'upcoming', createdAt, voucherUsed: false,
      }
    })
    newBookings.forEach((b) => batch.set(doc(db, 'bookings', b.id), stripId(b)))

    // one stamp per booking (+ earned free-vouchers)
    let stamps = (existing?.stamps || 0) + newBookings.length
    let earned = 0
    while (stamps >= 10) { stamps -= 10; earned += 1 }
    const bookingsYear = (existing?.bookingsYear || 0) + newBookings.length

    if (guest && !userId) {
      // create the walk-in member with its final stamp totals (single write)
      batch.set(doc(db, 'members', uid), {
        name: guest.name.trim(), email: '', phone: (guest.phone || '').trim(),
        channel: 'guest', country: '—', lang, avatar: '🎾',
        stamps, bookingsYear, suspended: false,
        joined: todayISO(), birthday: null,
      })
    } else if (existing) {
      batch.update(doc(db, 'members', uid), { stamps, bookingsYear })
    }

    newBookings.forEach((b) => batch.set(doc(db, 'stampLog', nid('s')), {
      userId: uid, date: todayISO(), delta: 1, note: `Admin booking ${b.ref} (phone/walk-in)`, by: 'admin',
    }))
    for (let k = 0; k < earned; k += 1) {
      batch.set(doc(db, 'vouchers', nid('v')), {
        userId: uid, issued: todayISO(), expiry: null, used: false, source: 'stamps',
      })
    }

    await batch.commit()
    const who = existing?.name ?? guest?.name ?? uid
    await logAdmin(`Booked ${newBookings.length} slot(s) for ${who}${guest && !userId ? ' (guest)' : ''} — ${lang === 'th' ? 'จองให้ลูกค้า (โทร/walk-in)' : 'manual booking (phone/walk-in)'}`)
    return newBookings
  }, [courts, members, bookings, logAdmin, lang])

  const adminAdjustStamps = useCallback(async (userId, delta, reason) => {
    await addStamp(userId, `Admin adjust: ${reason}`, delta, 'admin')
    await logAdmin(`Adjust stamps ${delta > 0 ? '+' : ''}${delta} for ${userId} — ${reason}`)
  }, [addStamp, logAdmin])

  // Move bookings / codes / stamps from one member onto another (LINE channel switch).
  const adminMergeMembers = useCallback(async (fromId, intoId) => {
    if (!fromId || !intoId || fromId === intoId) return { error: 'same' }
    const from = members.find((m) => m.id === fromId)
    const into = members.find((m) => m.id === intoId)
    if (!from || !into) return { error: 'notfound' }

    const retarget = async (col) => {
      const snap = await getDocs(query(collection(db, col), where('userId', '==', fromId)))
      if (snap.empty) return
      const batch = writeBatch(db)
      snap.docs.forEach((d) => batch.update(d.ref, { userId: intoId }))
      await batch.commit()
    }
    await retarget('bookings')
    await retarget('vouchers')
    await retarget('stampLog')

    const batch = writeBatch(db)
    let stamps = (into.stamps || 0) + (from.stamps || 0)
    let earned = 0
    while (stamps >= 10) { stamps -= 10; earned += 1 }
    batch.update(doc(db, 'members', intoId), {
      stamps,
      bookingsYear: (into.bookingsYear || 0) + (from.bookingsYear || 0),
    })
    for (let k = 0; k < earned; k += 1) {
      batch.set(doc(db, 'vouchers', nid('v')), {
        userId: intoId, issued: todayISO(), expiry: null, used: false, source: 'stamps',
      })
    }
    batch.delete(doc(db, 'members', fromId))
    await batch.commit()
    await logAdmin(`Merge member ${from.name} (${fromId}) → ${into.name} (${intoId})`)
    return { ok: true }
  }, [members, logAdmin])

  const value = {
    lang, switchLang, firebaseReady, authReady,
    courts, members, bookings, vouchers, stampLog, settings, adminLog,
    saveCourt, deleteCourt, updateCourt, updateMember, saveSettings,
    logAdmin,
    user, completeLineLogin, logout, isAdmin, adminLogin, adminLogout, resetDemo,
    registerEmail, loginEmail, requestReset, resendVerification,
    notifications, notify, markNotifsRead,
    slotStatus, loadTakenSlots, createMultiBooking, cancelBooking, fetchSlipUrl,
    adminAdjustStamps, adminCreateMultiBooking, adminMergeMembers,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
