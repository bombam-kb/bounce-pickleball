import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, onAuthStateChanged, updateProfile,
} from 'firebase/auth'
import {
  collection, doc, getDoc, getDocs, onSnapshot,
  setDoc, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore'
import { auth, db, firebaseReady } from './firebase.js'
import {
  COURTS, MEMBERS, SEED_BOOKINGS, SEED_PROMOS, SEED_VOUCHERS,
  SEED_STAMP_LOG, SEED_SETTINGS, genRef, todayISO, addDays, isPeak, nowLocalISO, tierOf,
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

// ── one-time seed: if the database is empty, push the demo dataset ──────────
const SEED_COLLECTIONS = {
  courts: COURTS, members: MEMBERS, bookings: SEED_BOOKINGS,
  promos: SEED_PROMOS, vouchers: SEED_VOUCHERS, stampLog: SEED_STAMP_LOG,
}
async function seedIfEmpty() {
  const snap = await getDocs(collection(db, 'courts'))
  if (!snap.empty) return
  const batch = writeBatch(db)
  for (const [col, rows] of Object.entries(SEED_COLLECTIONS)) {
    rows.forEach((row) => batch.set(doc(db, col, row.id), stripId(row)))
  }
  batch.set(doc(db, 'config', 'settings'), SEED_SETTINGS)
  await batch.commit()
}

export function StoreProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('bounce_lang') || 'th')

  // ── live data mirrored from Firestore (source of truth = Firestore) ──
  const [courts, setCourts] = useState([])
  const [members, setMembers] = useState([])
  const [bookings, setBookings] = useState([])
  const [promos, setPromos] = useState([])
  const [vouchers, setVouchers] = useState([])
  const [stampLog, setStampLog] = useState([])
  const [settings, setSettingsState] = useState(SEED_SETTINGS)
  const [adminLog, setAdminLog] = useState([])

  // ── session / device state (not business data → kept local) ──
  const [user, setUser] = useState(null)          // logged-in member
  const [isAdmin, setIsAdmin] = useState(false)    // current auth user is staff (in admins/)
  const [authReady, setAuthReady] = useState(false)
  const [notifications, setNotifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bounce_notifs') || '[]') } catch { return [] }
  })

  // subscribe to all collections in real time (+ seed on first run)
  useEffect(() => {
    if (!firebaseReady) { setAuthReady(true); return }
    const unsubs = []
    let cancelled = false
    ;(async () => {
      try { await seedIfEmpty() } catch (e) { console.error('[Bounce] seed failed', e) }
      if (cancelled) return
      const sub = (col, setter, sort) =>
        onSnapshot(collection(db, col), (snap) => {
          let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          if (sort) rows = rows.sort(sort)
          setter(rows)
        }, (err) => console.error(`[Bounce] ${col} listener`, err))
      const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
      unsubs.push(sub('courts', setCourts, (a, b) => (a.id < b.id ? -1 : 1)))
      unsubs.push(sub('members', setMembers))
      unsubs.push(sub('bookings', setBookings))
      unsubs.push(sub('promos', setPromos))
      unsubs.push(sub('vouchers', setVouchers, byDateDesc))
      unsubs.push(sub('stampLog', setStampLog, byDateDesc))
      unsubs.push(sub('adminLog', setAdminLog))
      unsubs.push(onSnapshot(doc(db, 'config', 'settings'), (d) => {
        if (d.exists()) setSettingsState(d.data())
      }))
    })()
    return () => { cancelled = true; unsubs.forEach((u) => u && u()) }
  }, [])

  // auth session → determine staff vs customer, resolve member doc into `user`
  useEffect(() => {
    if (!firebaseReady) return
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        let admin = false
        try {
          const adminSnap = await getDoc(doc(db, 'admins', fbUser.uid))
          admin = adminSnap.exists()
        } catch (e) { console.error('[Bounce] admin check', e) }
        setIsAdmin(admin)
        if (admin) {
          setUser(null)                                 // staff are not customers
        } else if (fbUser.emailVerified) {
          try {
            const snap = await getDoc(doc(db, 'members', fbUser.uid))
            if (snap.exists()) setUser({ id: snap.id, ...snap.data() })
          } catch (e) { console.error('[Bounce] load member', e) }
        } else {
          setUser((u) => (u && u.channel === 'line' ? u : null))
        }
      } else {
        setIsAdmin(false)
        setUser((u) => (u && u.channel === 'line' ? u : null)) // keep LINE demo session
      }
      setAuthReady(true)
    })
    return unsub
  }, [])

  // keep the logged-in user's stamps/credits/etc. live as members updates
  useEffect(() => {
    if (!user) return
    const fresh = members.find((m) => m.id === user.id)
    if (fresh) setUser((u) => ({ ...u, ...fresh }))
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

  // ── LINE login: demo shortcut (Firebase has no native LINE provider) ──
  const login = useCallback((channel) => {
    const base = members.find((m) => m.id === 'u1') ?? MEMBERS[0]
    setUser({ ...base, channel })
  }, [members])

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
        stamps: 0, bookingsYear: 0, credits: 0, suspended: false,
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

  // slot status for a court/date/hour
  const slotStatus = useCallback((court, date, hour) => {
    if (hour < court.open || hour >= court.close) return 'closed'
    if (court.blocked.some((b) => b.date === date && b.hour === hour)) return 'closed'
    const now = new Date()
    const slotTime = new Date(date + 'T00:00:00')
    slotTime.setHours(hour)
    if (slotTime <= now) return 'past'
    const taken = bookings.some(
      (b) => b.courtId === court.id && b.date === date && b.hour === hour && b.status !== 'cancelled'
    )
    return taken ? 'booked' : 'free'
  }, [bookings])

  // add/subtract stamps for one member; issues a voucher when 10 are reached.
  // reads the current member from the live snapshot (single-shot; callers that
  // add several stamps at once must batch the math themselves — see below).
  const addStamp = useCallback(async (userId, note, delta = 1, by = 'system') => {
    if (!firebaseReady) return false
    const member = members.find((m) => m.id === userId)
    if (!member) return false
    const batch = writeBatch(db)
    batch.set(doc(db, 'stampLog', nid('s')), { userId, date: todayISO(), delta, note, by })
    let stamps = member.stamps + delta
    let issued = false
    if (stamps >= 10) { stamps -= 10; issued = true }
    if (stamps < 0) stamps = 0
    batch.update(doc(db, 'members', userId), {
      stamps, bookingsYear: delta > 0 ? member.bookingsYear + 1 : member.bookingsYear,
    })
    if (issued) {
      batch.set(doc(db, 'vouchers', nid('v')), {
        userId, issued: todayISO(), expiry: addDays(todayISO(), settings.voucherDays), used: false, source: 'stamps',
      })
    }
    await batch.commit()
    return issued
  }, [members, settings.voucherDays])

  // ── multi-slot checkout — one payment, one booking record per selected cell.
  // All writes (bookings, voucher/promo usage, stamps, earned vouchers) go in a
  // single Firestore batch so the stamp math is computed exactly once (no race
  // between per-booking snapshot reads).
  const createMultiBooking = useCallback(async (items, { promo, voucherId, payMethod }) => {
    const priced = items.map((it) => {
      const court = courts.find((c) => c.id === it.courtId)
      const base = isPeak(it.date, it.hour) ? court.pricePeak : court.priceOff
      return { ...it, base }
    })
    const subtotal = priced.reduce((s, x) => s + x.base, 0)
    let totalDiscount = 0
    if (voucherId && priced.length === 1) totalDiscount = priced[0].base
    else if (promo) totalDiscount = promo.type === 'fixed' ? Math.min(promo.value, subtotal) : Math.round(subtotal * promo.value / 100)

    const createdAt = nowLocalISO()
    let allocated = 0
    const newBookings = priced.map((it, i) => {
      const disc = i === priced.length - 1
        ? totalDiscount - allocated
        : Math.round(totalDiscount * (it.base / subtotal))
      if (i < priced.length - 1) allocated += disc
      const total = it.base - disc
      return {
        id: nid('b'), ref: genRef(), userId: user.id, courtId: it.courtId, date: it.date, hour: it.hour, duration: 60,
        price: it.base, discount: disc, total, payMethod: voucherId ? 'voucher' : payMethod,
        status: 'upcoming', createdAt, voucherUsed: !!voucherId && i === 0,
      }
    })

    const batch = writeBatch(db)
    newBookings.forEach((b) => batch.set(doc(db, 'bookings', b.id), stripId(b)))
    if (voucherId) batch.update(doc(db, 'vouchers', voucherId), { used: true })
    if (promo) batch.update(doc(db, 'promos', promo.id), { used: promo.used + 1 })

    // one stamp per booking not covered by a voucher redemption
    const stampBookings = newBookings.filter((b) => !b.voucherUsed)
    let voucherEarned = false
    const member = members.find((m) => m.id === user.id)
    if (member && stampBookings.length) {
      let stamps = member.stamps + stampBookings.length
      let earned = 0
      while (stamps >= 10) { stamps -= 10; earned += 1 }
      voucherEarned = earned > 0
      batch.update(doc(db, 'members', user.id), {
        stamps, bookingsYear: member.bookingsYear + stampBookings.length,
      })
      stampBookings.forEach((b) => batch.set(doc(db, 'stampLog', nid('s')), {
        userId: user.id, date: todayISO(), delta: 1, note: `Booking ${b.ref}`, by: 'system',
      }))
      for (let k = 0; k < earned; k += 1) {
        batch.set(doc(db, 'vouchers', nid('v')), {
          userId: user.id, issued: todayISO(), expiry: addDays(todayISO(), settings.voucherDays), used: false, source: 'stamps',
        })
      }
    }
    await batch.commit()

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
  }, [courts, user, members, notify, lang, settings.voucherDays])

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

  // ── Birthday Promo — Gold member gets a free voucher on their birthday ──
  useEffect(() => {
    if (!firebaseReady || !user?.birthday || user.suspended) return
    const today = todayISO()
    if (user.birthday.slice(5) !== today.slice(5)) return
    if (tierOf(user.bookingsYear).key !== 'gold') return
    const already = vouchers.some((v) =>
      v.userId === user.id && v.source === 'birthday' && v.issued.slice(0, 4) === today.slice(0, 4))
    if (already) return
    setDoc(doc(db, 'vouchers', nid('v')), {
      userId: user.id, issued: today,
      expiry: addDays(today, settings.voucherDays), used: false, source: 'birthday',
    }).catch((e) => console.error('[Bounce] birthday voucher', e))
    notify(
      lang === 'th' ? '🎂 สุขสันต์วันเกิด!' : '🎂 Happy Birthday!',
      lang === 'th' ? 'สิทธิ์ Gold Member — รับ Free Booking 1 ครั้งเป็นของขวัญ' : 'Gold perk — enjoy 1 free booking on us')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const validatePromo = useCallback((code) => {
    const p = promos.find((x) => x.code.toLowerCase() === code.trim().toLowerCase())
    if (!p || !p.active || p.used >= p.limit || p.expiry < todayISO()) return null
    return p
  }, [promos])

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

  const savePromo = useCallback(async (promo) => {
    const id = promo.id || ('p' + Date.now())
    await setDoc(doc(db, 'promos', id), stripId({ ...promo, id }))
  }, [])
  const updatePromo = useCallback(async (id, patch) => { await updateDoc(doc(db, 'promos', id), patch) }, [])

  const updateMember = useCallback(async (id, patch) => { await updateDoc(doc(db, 'members', id), patch) }, [])

  const saveSettings = useCallback(async (obj) => { await setDoc(doc(db, 'config', 'settings'), obj) }, [])

  // ── admin manual booking — for phone-in / walk-in customers ──
  const adminCreateBooking = useCallback(async ({ userId, courtId, date, hour, duration }) => {
    const court = courts.find((c) => c.id === courtId)
    const member = members.find((m) => m.id === userId)
    const base = (isPeak(date, hour) ? court.pricePeak : court.priceOff) * (duration / 60)
    const booking = {
      id: nid('b'), ref: genRef(), userId, courtId, date, hour, duration,
      price: base, discount: 0, total: base, payMethod: 'counter',
      status: 'upcoming', createdAt: nowLocalISO(), voucherUsed: false,
    }
    await setDoc(doc(db, 'bookings', booking.id), stripId(booking))
    await addStamp(userId, `Admin booking ${booking.ref} (phone/walk-in)`)
    await logAdmin(`Booked ${booking.ref} for ${member?.name ?? userId} — ${lang === 'th' ? 'จองให้ลูกค้า (โทร/walk-in)' : 'manual booking (phone/walk-in)'}`)
    return booking
  }, [courts, members, addStamp, logAdmin, lang])

  const adminAdjustStamps = useCallback(async (userId, delta, reason) => {
    await addStamp(userId, `Admin adjust: ${reason}`, delta, 'admin')
    await logAdmin(`Adjust stamps ${delta > 0 ? '+' : ''}${delta} for ${userId} — ${reason}`)
  }, [addStamp, logAdmin])

  const adminIssueVoucher = useCallback(async (userId, reason) => {
    await setDoc(doc(db, 'vouchers', nid('v')), {
      userId, issued: todayISO(), expiry: addDays(todayISO(), settings.voucherDays), used: false, source: 'manual',
    })
    await logAdmin(`Issue voucher to ${userId} — ${reason}`)
  }, [settings.voucherDays, logAdmin])

  const value = {
    lang, switchLang, firebaseReady, authReady,
    courts, members, bookings, promos, vouchers, stampLog, settings, adminLog,
    saveCourt, deleteCourt, updateCourt, savePromo, updatePromo, updateMember, saveSettings,
    logAdmin,
    user, login, logout, isAdmin, adminLogin, adminLogout, resetDemo,
    registerEmail, loginEmail, requestReset, resendVerification,
    notifications, notify, markNotifsRead,
    slotStatus, createMultiBooking, cancelBooking, validatePromo,
    adminAdjustStamps, adminIssueVoucher, adminCreateBooking,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
