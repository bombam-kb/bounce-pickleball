import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  COURTS, MEMBERS, SEED_BOOKINGS, SEED_PROMOS, SEED_VOUCHERS,
  SEED_STAMP_LOG, SEED_SETTINGS, genRef, todayISO, addDays, isPeak,
} from './data/index.js'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

// collision-safe ids (persisted data survives reloads, so a counter won't do)
const nid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

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

  // autosave snapshot on every change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        courts, members, bookings, promos, vouchers, stampLog, settings, adminLog, user, adminAuthed,
      }))
    } catch { /* quota exceeded / private mode — demo keeps running in-memory */ }
  }, [courts, members, bookings, promos, vouchers, stampLog, settings, adminLog, user, adminAuthed])

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
      status: 'upcoming', createdAt: todayISO(), voucherUsed: !!voucherId,
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
    return { booking, voucherEarned }
  }, [courts, user, addStamp])

  const cancelBooking = useCallback((bookingId, by = 'user') => {
    const bk = bookings.find((b) => b.id === bookingId)
    if (!bk) return
    setBookings((bs) => bs.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b)))
    if (!bk.voucherUsed) addStamp(bk.userId, `Cancelled ${bk.ref} — stamp refund`, -1, by)
  }, [bookings, addStamp])

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
    slotStatus, createBooking, cancelBooking, validatePromo,
    adminAdjustStamps, adminIssueVoucher,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
