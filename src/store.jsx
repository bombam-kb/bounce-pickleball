import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  COURTS, MEMBERS, SEED_BOOKINGS, SEED_PROMOS, SEED_VOUCHERS,
  SEED_STAMP_LOG, SEED_SETTINGS, genRef, todayISO, addDays, isPeak, nowLocalISO, tierOf,
} from './data/index.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

// collision-safe ids (persisted data survives reloads, so a counter won't do)
const nid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

// demo password hashing — real system must hash server-side (bcrypt/argon2)
const sha256 = async (text) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('bounce·' + text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
const genOTP = () => String(Math.floor(100000 + Math.random() * 900000))

// ── localStorage persistence (DEMO ONLY — no server, do not store real data) ──
const LS_KEY = 'bounce_demo_v1'
const loadSaved = () => {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    // shape check: reject anything that doesn't look like our snapshot
    if (!d || typeof d !== 'object' ||
      !Array.isArray(d.courts) || !Array.isArray(d.bookings) ||
      !Array.isArray(d.members) || typeof d.settings !== 'object') return null
    return d
  } catch {
    return null
  }
}
const saved = loadSaved()

export function StoreProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('bounce_lang') || 'th')
  const [courts, setCourts] = useState(saved?.courts ?? COURTS)
  const [members, setMembers] = useState(saved?.members ?? MEMBERS)
  const [bookings, setBookings] = useState(saved?.bookings ?? SEED_BOOKINGS)
  const [promos, setPromos] = useState(saved?.promos ?? SEED_PROMOS)
  const [vouchers, setVouchers] = useState(saved?.vouchers ?? SEED_VOUCHERS)
  const [stampLog, setStampLog] = useState(saved?.stampLog ?? SEED_STAMP_LOG)
  const [settings, setSettings] = useState(saved?.settings ?? SEED_SETTINGS)
  const [adminLog, setAdminLog] = useState(saved?.adminLog ?? [])
  const [user, setUser] = useState(saved?.user ?? null)   // logged-in member (mock)
  const [adminAuthed, setAdminAuthed] = useState(saved?.adminAuthed ?? false)
  const [emailUsers, setEmailUsers] = useState(saved?.emailUsers ?? []) // email/password registry (demo)
  const [notifications, setNotifications] = useState(saved?.notifications ?? [])

  // autosave snapshot on every change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        courts, members, bookings, promos, vouchers, stampLog, settings, adminLog, user, adminAuthed,
        emailUsers, notifications,
      }))
    } catch { /* quota exceeded / private mode — demo keeps running in-memory */ }
  }, [courts, members, bookings, promos, vouchers, stampLog, settings, adminLog, user, adminAuthed, emailUsers, notifications])

  const resetDemo = useCallback(() => {
    localStorage.removeItem(LS_KEY)
    window.location.reload()
  }, [])

  const switchLang = useCallback((l) => {
    setLang(l)
    localStorage.setItem('bounce_lang', l)
  }, [])

  const login = useCallback((channel) => {
    // Mock social login → sign in as the demo member, tag the channel
    setUser({ ...(members.find((m) => m.id === 'u1') ?? MEMBERS[0]), channel })
  }, [members])
  const logout = useCallback(() => setUser(null), [])

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

  // ── email auth (demo: OTP is returned to be shown on screen instead of a real email) ──
  const registerEmail = useCallback(async (name, email, password) => {
    const em = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return { error: 'bademail' }
    if (password.length < 8) return { error: 'shortpass' }
    if (emailUsers.some((u) => u.email === em && u.verified)) return { error: 'exists' }
    if (members.some((m) => m.email.toLowerCase() === em)) return { error: 'exists' }
    const otp = genOTP()
    const passHash = await sha256(password)
    setEmailUsers((us) => [...us.filter((u) => u.email !== em),
      { email: em, name: name.trim(), passHash, verified: false, otp, memberId: null }])
    return { otp } // demo only — real system emails this
  }, [emailUsers, members])

  const verifyEmail = useCallback((email, code) => {
    const em = email.trim().toLowerCase()
    const rec = emailUsers.find((u) => u.email === em && !u.verified)
    if (!rec || rec.otp !== code.trim()) return { error: 'badcode' }
    const member = {
      id: nid('u'), name: rec.name, email: em, phone: '', channel: 'email',
      country: lang === 'th' ? 'TH' : '—', lang, avatar: '🏓',
      stamps: 0, bookingsYear: 0, credits: 0, suspended: false,
      joined: todayISO(), birthday: null,
    }
    setMembers((ms) => [...ms, member])
    setEmailUsers((us) => us.map((u) => (u.email === em ? { ...u, verified: true, otp: null, memberId: member.id } : u)))
    setUser(member)
    notify(lang === 'th' ? '🎉 ยินดีต้อนรับสู่ Bounce!' : '🎉 Welcome to Bounce!',
      lang === 'th' ? 'สมัครสมาชิกสำเร็จ เริ่มจองสนามได้เลย' : 'Your account is ready — book a court!')
    return { ok: true }
  }, [emailUsers, lang, notify])

  const loginEmail = useCallback(async (email, password) => {
    const em = email.trim().toLowerCase()
    const rec = emailUsers.find((u) => u.email === em && u.verified)
    if (!rec) return { error: 'notfound' }
    if ((await sha256(password)) !== rec.passHash) return { error: 'badpass' }
    const m = members.find((x) => x.id === rec.memberId)
    if (!m) return { error: 'notfound' }
    if (m.suspended) return { error: 'suspended' }
    setUser(m)
    return { ok: true }
  }, [emailUsers, members])

  const requestReset = useCallback((email) => {
    const em = email.trim().toLowerCase()
    if (!emailUsers.some((u) => u.email === em && u.verified)) return { error: 'notfound' }
    const otp = genOTP()
    setEmailUsers((us) => us.map((u) => (u.email === em ? { ...u, otp } : u)))
    return { otp } // demo only
  }, [emailUsers])

  const confirmReset = useCallback(async (email, code, newPass) => {
    const em = email.trim().toLowerCase()
    const rec = emailUsers.find((u) => u.email === em && u.verified)
    if (!rec || !rec.otp || rec.otp !== code.trim()) return { error: 'badcode' }
    if (newPass.length < 8) return { error: 'shortpass' }
    const passHash = await sha256(newPass)
    setEmailUsers((us) => us.map((u) => (u.email === em ? { ...u, passHash, otp: null } : u)))
    return { ok: true }
  }, [emailUsers])

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

  const addStamp = useCallback((userId, note, delta = 1, by = 'system') => {
    setStampLog((l) => [{ id: nid('s'), userId, date: todayISO(), delta, note, by }, ...l])
    let issued = false
    setMembers((ms) => ms.map((m) => {
      if (m.id !== userId) return m
      let stamps = m.stamps + delta
      if (stamps >= 10) { stamps -= 10; issued = true }
      if (stamps < 0) stamps = 0
      return { ...m, stamps, bookingsYear: delta > 0 ? m.bookingsYear + 1 : m.bookingsYear }
    }))
    setUser((u) => {
      if (!u || u.id !== userId) return u
      let stamps = u.stamps + delta
      if (stamps >= 10) stamps -= 10
      if (stamps < 0) stamps = 0
      return { ...u, stamps, bookingsYear: delta > 0 ? u.bookingsYear + 1 : u.bookingsYear }
    })
    if (issued) {
      setVouchers((v) => [{
        id: nid('v'), userId, issued: todayISO(),
        expiry: addDays(todayISO(), settings.voucherDays), used: false, source: 'stamps',
      }, ...v])
    }
    return issued
  }, [settings.voucherDays])

  const createBooking = useCallback(({ courtId, date, hour, duration, promo, voucherId, payMethod }) => {
    const court = courts.find((c) => c.id === courtId)
    const base = (isPeak(date, hour) ? court.pricePeak : court.priceOff) * (duration / 60)
    let discount = 0
    if (voucherId) discount = base
    else if (promo) discount = promo.type === 'fixed' ? Math.min(promo.value, base) : Math.round(base * promo.value / 100)
    const total = base - discount
    const booking = {
      id: nid('b'), ref: genRef(), userId: user.id, courtId, date, hour, duration,
      price: base, discount, total, payMethod: voucherId ? 'voucher' : payMethod,
      status: 'upcoming', createdAt: nowLocalISO(), voucherUsed: !!voucherId,
    }
    setBookings((bs) => [booking, ...bs])
    if (voucherId) {
      setVouchers((vs) => vs.map((v) => (v.id === voucherId ? { ...v, used: true } : v)))
    }
    if (promo) {
      setPromos((ps) => ps.map((p) => (p.id === promo.id ? { ...p, used: p.used + 1 } : p)))
    }
    // stamp: paid bookings only, not voucher redemptions
    let voucherEarned = false
    if (!voucherId) voucherEarned = addStamp(user.id, `Booking ${booking.ref}`)
    notify(
      lang === 'th' ? `✅ จองสำเร็จ ${booking.ref}` : `✅ Booking confirmed ${booking.ref}`,
      lang === 'th' ? `${date} เวลา ${String(hour).padStart(2, '0')}:00 · ยอด ฿${total}` : `${date} at ${String(hour).padStart(2, '0')}:00 · ฿${total}`)
    if (!voucherId) {
      const ns = (user.stamps + 1) % 10 === 0 ? 10 : (user.stamps + 1) % 10
      notify(
        lang === 'th' ? `🏓 คุณสะสมแสตมป์ได้ ${ns}/10 แล้ว!` : `🏓 Stamp collected — ${ns}/10!`,
        voucherEarned
          ? (lang === 'th' ? '🎁 ยินดีด้วย! คุณได้รับ Free Booking 1 ครั้ง' : '🎁 Congrats! You earned 1 Free Booking')
          : (lang === 'th' ? `อีก ${10 - ns} ดวงรับฟรี 1 ครั้ง` : `${10 - ns} more for a free booking`))
    }
    return { booking, voucherEarned }
  }, [courts, user, addStamp, notify, lang])

  const cancelBooking = useCallback((bookingId, by = 'user') => {
    const bk = bookings.find((b) => b.id === bookingId)
    if (!bk) return
    setBookings((bs) => bs.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)))
    if (!bk.voucherUsed) addStamp(bk.userId, `Cancelled ${bk.ref} — stamp refund`, -1, by)
    notify(
      lang === 'th' ? `❌ ยกเลิกการจอง ${bk.ref}` : `❌ Booking cancelled ${bk.ref}`,
      bk.voucherUsed
        ? (lang === 'th' ? 'Voucher ที่ใช้ไปจะไม่ถูกคืน' : 'The voucher used is not refunded')
        : (lang === 'th' ? 'แสตมป์จากการจองนี้ถูกหักคืนแล้ว' : 'The stamp from this booking was refunded'))
  }, [bookings, addStamp, notify, lang])

  // ── Birthday Promo — Gold member ได้ Free Voucher วันเกิด (ปีละครั้ง) ──
  useEffect(() => {
    if (!user?.birthday || user.suspended) return
    const today = todayISO()
    if (user.birthday.slice(5) !== today.slice(5)) return
    if (tierOf(user.bookingsYear).key !== 'gold') return
    const already = vouchers.some((v) =>
      v.userId === user.id && v.source === 'birthday' && v.issued.slice(0, 4) === today.slice(0, 4))
    if (already) return
    setVouchers((v) => [{
      id: nid('v'), userId: user.id, issued: today,
      expiry: addDays(today, settings.voucherDays), used: false, source: 'birthday',
    }, ...v])
    notify(
      lang === 'th' ? '🎂 สุขสันต์วันเกิด!' : '🎂 Happy Birthday!',
      lang === 'th' ? 'สิทธิ์ Gold Member — รับ Free Booking 1 ครั้งเป็นของขวัญ' : 'Gold perk — enjoy 1 free booking on us')
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const validatePromo = useCallback((code) => {
    const p = promos.find((x) => x.code.toLowerCase() === code.trim().toLowerCase())
    if (!p || !p.active || p.used >= p.limit || p.expiry < todayISO()) return null
    return p
  }, [promos])

  const logAdmin = useCallback((action) => {
    setAdminLog((l) => [{ id: nid('a'), date: new Date().toLocaleString(), action }, ...l])
  }, [])

  const adminAdjustStamps = useCallback((userId, delta, reason) => {
    addStamp(userId, `Admin adjust: ${reason}`, delta, 'admin')
    logAdmin(`Adjust stamps ${delta > 0 ? '+' : ''}${delta} for ${userId} — ${reason}`)
  }, [addStamp, logAdmin])

  const adminIssueVoucher = useCallback((userId, reason) => {
    setVouchers((v) => [{
      id: nid('v'), userId, issued: todayISO(),
      expiry: addDays(todayISO(), settings.voucherDays), used: false, source: 'manual',
    }, ...v])
    logAdmin(`Issue voucher to ${userId} — ${reason}`)
  }, [settings.voucherDays, logAdmin])

  const value = {
    lang, switchLang,
    courts, setCourts, members, setMembers, bookings, setBookings,
    promos, setPromos, vouchers, setVouchers, stampLog, settings, setSettings,
    adminLog, logAdmin,
    user, login, logout, adminAuthed, setAdminAuthed, resetDemo,
    registerEmail, verifyEmail, loginEmail, requestReset, confirmReset,
    notifications, notify, markNotifsRead,
    slotStatus, createBooking, cancelBooking, validatePromo,
    adminAdjustStamps, adminIssueVoucher,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
