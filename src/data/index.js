// ── Mock data layer (no backend) ─────────────────────────────────────────
// All dates are computed relative to "today" so the demo always looks live.

export const iso = (d) => {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

const BKK = 'Asia/Bangkok'

/** Calendar date in Thailand, including on Vercel (UTC) servers. */
export const todayISO = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: BKK }).format(new Date())

export const addDays = (base, n) => {
  const [y, m, d] = String(base).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  const z = (n) => String(n).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${z(dt.getUTCMonth() + 1)}-${z(dt.getUTCDate())}`
}
const T = todayISO()

export const genRef = () => 'BNC-' + Math.random().toString(36).slice(2, 8).toUpperCase()

/** Shop account number, shown as on the member card: "No. 10001". */
export const formatAccountNo = (n) => (n ? `No. ${n}` : '')

/** Digits only, capped so a pasted paragraph cannot become a phone number. */
export const normalizePhone = (raw) => String(raw || '').replace(/\D/g, '').slice(0, 15)

/** A callback number the shop can dial. Existing empty profiles stay empty until the person saves one. */
export const hasContactPhone = (raw) => {
  const digits = normalizePhone(raw)
  return digits.length >= 9 && digits.length <= 15
}

/** Staff can add or remove several stamps or coupons in one action, not an unbounded amount. */
export const ADJUST_LIMIT = 30

export const VOUCHER_EXPIRY_MAX_DAYS = 3650

/** Days a new coupon stays valid, from shop settings. 0 means it never expires. */
export const voucherExpiryDays = (settings) => {
  const n = Number(settings?.voucherExpiryDays)
  return Number.isInteger(n) && n > 0 && n <= VOUCHER_EXPIRY_MAX_DAYS ? n : 0
}

/**
 * Dates fixed on a coupon when it is issued. The expiry is a calendar day, so a later
 * settings change never moves a coupon the customer already holds.
 */
export const newVoucherDates = (settings, today = todayISO()) => {
  const days = voucherExpiryDays(settings)
  return { issued: today, expiry: days ? addDays(today, days) : null, expiryDays: days || null }
}

/** Usable through its expiry day; expired from the next day. */
export const voucherExpired = (v, today = todayISO()) => !!(v?.expiry && String(v.expiry) < today)

/**
 * Slots a checkout's coupons make free. One coupon covers one hour, peak included.
 * The most expensive hours are covered first so a peak slot can take a coupon.
 * Same function on the server, so the price the customer sees is the price that is charged.
 */
export const voucherCoverIndexes = (prices, count) => {
  const n = Math.max(0, Math.min(prices.length, count | 0))
  return prices
    .map((price, i) => ({ i, price: Number(price) || 0 }))
    .sort((a, b) => b.price - a.price || a.i - b.i)
    .slice(0, n)
    .map((x) => x.i)
}

/** "YYYY-MM-DD" from a stored date or "YYYY-MM-DDTHH:mm". Empty when it is not a date. */
export const isoDay = (raw) => {
  if (raw == null || raw === '') return ''
  if (typeof raw === 'string') {
    const day = raw.slice(0, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : ''
  }
  if (typeof raw.toDate === 'function') return isoDay(raw.toDate().toISOString().slice(0, 10))
  return ''
}

/**
 * Day each used coupon was redeemed. Newer coupons store usedAt. Older ones only
 * flipped used to true, so the day comes from the booking that spent the coupon.
 * Nothing is written back.
 */
export const voucherUsedDayMap = (vouchers, bookings) => {
  const map = new Map()
  const claimedRefs = new Set()
  const list = Array.isArray(vouchers) ? vouchers : []
  const rows = Array.isArray(bookings) ? bookings : []
  for (const v of list) {
    if (!v?.used || !v.id) continue
    const direct = isoDay(v.usedAt)
    if (direct) {
      map.set(v.id, direct)
      if (v.usedForRef) claimedRefs.add(v.usedForRef)
      continue
    }
    if (!v.usedForRef) continue
    const hits = rows.filter((b) => b.ref === v.usedForRef && b.voucherUsed)
    const b = hits.find((x) => x.status !== 'cancelled') || hits[0]
    const day = isoDay(b?.createdAt) || isoDay(b?.date)
    if (!day) continue
    map.set(v.id, day)
    claimedRefs.add(v.usedForRef)
  }
  const missing = list
    .filter((v) => v?.used && v.id && !map.has(v.id))
    .sort((a, b) => String(a.issued || '').localeCompare(String(b.issued || '')) || String(a.id).localeCompare(String(b.id)))
  const pool = []
  const seen = new Set()
  const open = rows
    .filter((b) => b?.voucherUsed && b.ref && !claimedRefs.has(b.ref))
    .sort((a, b) => String(a.createdAt || a.date || '').localeCompare(String(b.createdAt || b.date || '')))
  for (const b of open) {
    if (seen.has(b.ref)) continue
    seen.add(b.ref)
    pool.push(b)
  }
  const taken = new Set()
  for (const v of missing) {
    const issued = isoDay(v.issued)
    let pick = pool.findIndex((b) => {
      if (taken.has(b.ref)) return false
      const day = isoDay(b.createdAt) || isoDay(b.date)
      return !issued || !day || day >= issued
    })
    if (pick < 0) pick = pool.findIndex((b) => !taken.has(b.ref))
    if (pick < 0) continue
    const b = pool[pick]
    taken.add(b.ref)
    const day = isoDay(b.createdAt) || isoDay(b.date)
    if (day) map.set(v.id, day)
  }
  return map
}

/** Name, email, phone, account number, or id. "No. 10001" matches 10001. */
export const memberMatches = (m, q) => {
  const raw = String(q || '').trim().toLowerCase()
  if (!raw) return true
  const needle = raw.replace(/^no\.?\s*/, (prefix, _o, str) => (
    /^\d/.test(str.slice(prefix.length)) ? '' : prefix
  ))
  const hay = [m?.name, m?.email, m?.phone, m?.accountNo, m?.id]
    .filter((x) => x != null && x !== '')
    .join(' ')
    .toLowerCase()
  return hay.includes(needle)
}

// local datetime "YYYY-MM-DDTHH:mm" (not UTC — display is Thailand-local)
export const nowLocalISO = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BKK,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const g = (t) => parts.find((p) => p.type === t)?.value || '00'
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`
}

/** Bookings / cart rows: date, then hour, then court column order. */
export const sortSlotItems = (items, courtIds = []) =>
  [...items].sort((a, b) => {
    const d = String(a.date || '').localeCompare(String(b.date || ''))
    if (d) return d
    if (a.hour !== b.hour) return a.hour - b.hour
    const ia = courtIds.indexOf(a.courtId)
    const ib = courtIds.indexOf(b.courtId)
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib)
  })

/** Per-court peak window. End hour is exclusive. Missing fields default to 17:00–21:00, on. */
export const isPeak = (hour, court) => {
  if (!court || court.peakEnabled === false) return false
  const from = court.peakFrom ?? 17
  const to = court.peakTo ?? 21
  return hour >= from && hour < to
}

export const COURTS = [
  {
    id: 'c1', name: 'Court 1 — Center', nameTh: 'คอร์ท 1 — เซ็นเตอร์',
    desc: 'Indoor cushion court, tournament grade net', descTh: 'สนามในร่มพื้นยาง เน็ตมาตรฐานแข่งขัน',
    maxPlayers: 4, priceOff: 240, pricePeak: 380,
    open: 8, close: 22, peakEnabled: true, peakFrom: 17, peakTo: 21, openCourt: true, active: true,
    photo: 'linear-gradient(135deg,#2456D6 0%,#173B9E 60%,#102A73 100%)',
    blocked: [], // {date, hour, reason}
  },
  {
    id: 'c2', name: 'Court 2 — Garden', nameTh: 'คอร์ท 2 — การ์เด้น',
    desc: 'Semi-outdoor court with shade roof, evening breeze', descTh: 'สนามกึ่งกลางแจ้ง มีหลังคา ลมเย็นตอนเย็น',
    maxPlayers: 4, priceOff: 200, pricePeak: 320,
    open: 9, close: 21, peakEnabled: true, peakFrom: 17, peakTo: 21, openCourt: false, active: true,
    photo: 'linear-gradient(135deg,#1E7A4C 0%,#3B4D27 70%)',
    blocked: [{ date: addDays(T, 1), hour: 12, reason: 'Net maintenance' }],
  },
  {
    id: 'c3', name: 'Court 3 — Rooftop', nameTh: 'คอร์ท 3 — รูฟท็อป',
    desc: 'Rooftop court, sunset view, LED lighting', descTh: 'สนามดาดฟ้า วิวพระอาทิตย์ตก ไฟ LED',
    maxPlayers: 4, priceOff: 260, pricePeak: 420,
    open: 10, close: 22, peakEnabled: true, peakFrom: 17, peakTo: 21, openCourt: true, active: true,
    photo: 'linear-gradient(135deg,#E8743B 0%,#B33A2B 60%,#6E1F33 100%)',
    blocked: [],
  },
]

export const MEMBERS = [
  {
    id: 'u1', name: 'แบม กันตี', email: 'bam@example.com', phone: '081-234-5678',
    channel: 'line', country: 'TH', lang: 'th', avatar: '🏓',
    stamps: 7, bookingsYear: 52, suspended: false,
    joined: addDays(T, -210), birthday: '1998-' + T.slice(5),
  },
  {
    id: 'u2', name: 'ต้น ธนกฤต', email: 'ton@example.com', phone: '089-111-2233',
    channel: 'line', country: 'TH', lang: 'th', avatar: '😎',
    stamps: 3, bookingsYear: 8, suspended: false,
    joined: addDays(T, -90), birthday: '2000-03-22',
  },
  {
    id: 'u3', name: 'Sarah Miller', email: 'sarah.m@example.com', phone: '',
    channel: 'email', country: 'US', lang: 'en', avatar: '🎾',
    stamps: 9, bookingsYear: 31, suspended: false,
    joined: addDays(T, -160), birthday: '1995-11-02',
  },
  {
    id: 'u4', name: 'เจน จิราพร', email: 'jane.j@example.com', phone: '086-555-7788',
    channel: 'email', country: 'TH', lang: 'th', avatar: '🌸',
    stamps: 2, bookingsYear: 4, suspended: false,
    joined: addDays(T, -45), birthday: null,
  },
  {
    id: 'u5', name: 'Kenji Watanabe', email: 'kenji.w@example.com', phone: '',
    channel: 'email', country: 'JP', lang: 'en', avatar: '🗻',
    stamps: 0, bookingsYear: 52, suspended: false,
    joined: addDays(T, -300), birthday: '1990-06-18',
  },
  {
    id: 'u6', name: 'ปอ ปวีณา', email: 'por.p@example.com', phone: '082-999-0011',
    channel: 'line', country: 'TH', lang: 'th', avatar: '🦋',
    stamps: 5, bookingsYear: 12, suspended: true,
    joined: addDays(T, -120), birthday: null,
  },
]

// Seed bookings around today. status: upcoming | completed | cancelled
let bid = 0
const B = (userId, courtId, dayOffset, hour, opts = {}) => {
  const date = addDays(T, dayOffset)
  const court = COURTS.find((c) => c.id === courtId)
  const price = isPeak(hour, court) ? court.pricePeak : court.priceOff
  return {
    id: 'b' + ++bid, ref: 'BNC-' + String(1000 + bid),
    userId, courtId, date, hour, duration: 60,
    price, discount: opts.discount || 0, total: opts.total ?? price - (opts.discount || 0),
    payMethod: opts.payMethod || 'promptpay',
    status: opts.status || (dayOffset < 0 ? 'completed' : 'upcoming'),
    // pseudo transaction time, deterministic per-booking
    createdAt: `${addDays(T, dayOffset - 2)}T${String(9 + (bid % 11)).padStart(2, '0')}:${String((bid * 7) % 60).padStart(2, '0')}`,
    voucherUsed: opts.voucherUsed || false,
  }
}

export const SEED_BOOKINGS = [
  // history (completed) — drives revenue chart
  B('u1', 'c1', -6, 18), B('u3', 'c2', -6, 10), B('u5', 'c3', -6, 19),
  B('u2', 'c1', -5, 17), B('u4', 'c2', -5, 15),
  B('u1', 'c3', -4, 20), B('u3', 'c1', -4, 9), B('u5', 'c2', -4, 18), B('u6', 'c1', -4, 11),
  B('u2', 'c2', -3, 19),
  B('u1', 'c1', -2, 18), B('u3', 'c3', -2, 17), B('u5', 'c1', -2, 20), B('u4', 'c3', -2, 13),
  B('u3', 'c2', -1, 10), B('u1', 'c2', -1, 19), B('u2', 'c3', -1, 18),
  // today
  B('u3', 'c1', 0, 9), B('u5', 'c2', 0, 11),
  B('u1', 'c1', 0, 18), B('u2', 'c3', 0, 19), B('u4', 'c2', 0, 17),
  // upcoming
  B('u1', 'c3', 1, 19), B('u3', 'c1', 1, 10), B('u5', 'c1', 1, 18),
  B('u2', 'c2', 2, 18), B('u1', 'c1', 3, 17),
  B('u4', 'c1', 2, 12, { status: 'cancelled' }),
]

export const SEED_VOUCHERS = [
  { id: 'v1', userId: 'u3', issued: addDays(T, -20), expiry: null, used: false, source: 'stamps' },
  { id: 'v3', userId: 'u1', issued: addDays(T, -100), expiry: null, used: true, source: 'stamps' },
]

export const SEED_STAMP_LOG = [
  { id: 's1', userId: 'u1', date: addDays(T, -2), delta: 1, note: 'Booking BNC-1011', by: 'system' },
  { id: 's2', userId: 'u1', date: addDays(T, -4), delta: 1, note: 'Booking BNC-1006', by: 'system' },
  { id: 's3', userId: 'u1', date: addDays(T, -6), delta: 1, note: 'Booking BNC-1001', by: 'system' },
  { id: 's4', userId: 'u3', date: addDays(T, -1), delta: 1, note: 'Booking BNC-1015', by: 'system' },
  { id: 's5', userId: 'u6', date: addDays(T, -30), delta: -1, note: 'Cancelled booking refund', by: 'admin' },
]

export const SEED_SETTINGS = {
  cancelHours: 6,
  reminderHours: 1,
  defaultLang: 'th',
  slotDuration: 60,
  voucherDays: 90,
  advanceBookingDays: 14,
  payTermsTh: 'โอนเข้าบัญชีร้านตามที่แสดงในแอปเท่านั้น ยอดต้องตรงกับยอดที่ระบบแสดง<br>อัปโหลดสลิปจากแอปธนาคารหลังโอน การจองสมบูรณ์เมื่อระบบตรวจสลิปผ่าน<br>หากช่องเวลาถูกจองตัดหน้า ให้ติดต่อพนักงานเรื่องคืนเงินหรือย้ายเวลา<br><u>ร้านไม่รับสลิปที่โอนเข้าบัญชีอื่น</u>',
  payTermsEn: 'Transfer only to the shop account shown in the app. The amount must match the total shown.<br>Upload the bank-app slip after you pay. The booking is confirmed when the slip passes verification.<br>If the slot is taken before we can seat you, contact staff for a refund or a move.<br><u>Slips paid to another account are not accepted.</u>',
  appTermsTh: 'แอปนี้ใช้สำหรับจองสนาม Bounce Pickleball House<br>ข้อมูลโปรไฟล์ใช้เพื่อการจองและการติดต่อจากร้าน<br>แสตมป์และโค้ดฟรีเป็นไปตามเงื่อนไขที่ร้านกำหนด<br><u>ร้านขอสงวนสิทธิ์ระงับบัญชีที่ใช้งานผิดวัตถุประสงค์</u>',
  appTermsEn: 'This app is for booking courts at Bounce Pickleball House.<br>Profile details are used for bookings and shop contact.<br>Stamps and free-hour codes follow the shop\'s rules.<br><u>The shop may suspend accounts used in bad faith.</u>',
}

export const SEED_PAYOUT = {
  // Blank on purpose. The server verifies a slip's receiver against these exact
  // Firestore values, so a default baked into the bundle would show customers
  // an account the server cannot confirm. Set them in Admin → Settings.
  promptPayId: '',
  payAccountName: '',
  payAccountNo: '',
}
