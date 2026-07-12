// ── Mock data layer (no backend) ─────────────────────────────────────────
// All dates are computed relative to "today" so the demo always looks live.

export const iso = (d) => {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
export const todayISO = () => iso(new Date())
export const addDays = (base, n) => {
  const d = new Date(base + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return iso(d)
}
const T = todayISO()

export const genRef = () => 'BNC-' + Math.random().toString(36).slice(2, 8).toUpperCase()

// local datetime "YYYY-MM-DDTHH:mm" (not UTC — display is Thailand-local)
export const nowLocalISO = () => {
  const d = new Date()
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}

// Peak = weekday 17:00-21:00, weekend 09:00-21:00
export const isPeak = (dateISO, hour) => {
  const day = new Date(dateISO + 'T00:00:00').getDay()
  const weekend = day === 0 || day === 6
  return weekend ? hour >= 9 && hour < 21 : hour >= 17 && hour < 21
}

export const COURTS = [
  {
    id: 'c1', name: 'Court 1 — Center', nameTh: 'คอร์ท 1 — เซ็นเตอร์',
    desc: 'Indoor cushion court, tournament grade net', descTh: 'สนามในร่มพื้นยาง เน็ตมาตรฐานแข่งขัน',
    maxPlayers: 4, priceOff: 240, pricePeak: 380,
    open: 8, close: 22, openCourt: true, active: true,
    photo: 'linear-gradient(135deg,#2456D6 0%,#173B9E 60%,#102A73 100%)',
    blocked: [], // {date, hour, reason}
  },
  {
    id: 'c2', name: 'Court 2 — Garden', nameTh: 'คอร์ท 2 — การ์เด้น',
    desc: 'Semi-outdoor court with shade roof, evening breeze', descTh: 'สนามกึ่งกลางแจ้ง มีหลังคา ลมเย็นตอนเย็น',
    maxPlayers: 4, priceOff: 200, pricePeak: 320,
    open: 9, close: 21, openCourt: false, active: true,
    photo: 'linear-gradient(135deg,#1E7A4C 0%,#16382B 70%)',
    blocked: [{ date: addDays(T, 1), hour: 12, reason: 'Net maintenance' }],
  },
  {
    id: 'c3', name: 'Court 3 — Rooftop', nameTh: 'คอร์ท 3 — รูฟท็อป',
    desc: 'Rooftop court, sunset view, LED lighting', descTh: 'สนามดาดฟ้า วิวพระอาทิตย์ตก ไฟ LED',
    maxPlayers: 4, priceOff: 260, pricePeak: 420,
    open: 10, close: 22, openCourt: true, active: true,
    photo: 'linear-gradient(135deg,#E8743B 0%,#B33A2B 60%,#6E1F33 100%)',
    blocked: [],
  },
]

export const TIERS = [
  { key: 'bronze', name: 'Bronze', emoji: '🟤', min: 1, max: 19, color: '#A0785A', perk: { th: 'Stamp Card 10 ฟรี 1', en: 'Stamp Card — 10 free 1' } },
  { key: 'silver', name: 'Silver', emoji: '⚪', min: 20, max: 49, color: '#9E9E9E', perk: { th: 'ส่วนลด 5% + Early Booking 24 ชม.', en: '5% off + Early Booking 24h' } },
  { key: 'gold', name: 'Gold', emoji: '🟡', min: 50, max: Infinity, color: '#D4AC0D', perk: { th: 'ส่วนลด 10% + Priority + Birthday Free', en: '10% off + Priority + Birthday Free' } },
]
export const tierOf = (bookingsYear) => {
  if (bookingsYear >= 50) return TIERS[2]
  if (bookingsYear >= 20) return TIERS[1]
  return TIERS[0]
}

export const MEMBERS = [
  {
    id: 'u1', name: 'แบม กันตี', email: 'bam@example.com', phone: '081-234-5678',
    channel: 'line', country: 'TH', lang: 'th', avatar: '🏓',
    stamps: 7, bookingsYear: 52, credits: 150, suspended: false,
    joined: addDays(T, -210), birthday: '1998-' + T.slice(5), // Gold + วันเกิดวันนี้ — เดโม Birthday Promo
  },
  {
    id: 'u2', name: 'ต้น ธนกฤต', email: 'ton@example.com', phone: '089-111-2233',
    channel: 'line', country: 'TH', lang: 'th', avatar: '😎',
    stamps: 3, bookingsYear: 8, credits: 0, suspended: false,
    joined: addDays(T, -90), birthday: '2000-03-22',
  },
  {
    id: 'u3', name: 'Sarah Miller', email: 'sarah.m@example.com', phone: '',
    channel: 'google', country: 'US', lang: 'en', avatar: '🎾',
    stamps: 9, bookingsYear: 31, credits: 300, suspended: false,
    joined: addDays(T, -160), birthday: '1995-11-02',
  },
  {
    id: 'u4', name: 'เจน จิราพร', email: 'jane.j@example.com', phone: '086-555-7788',
    channel: 'email', country: 'TH', lang: 'th', avatar: '🌸',
    stamps: 2, bookingsYear: 4, credits: 0, suspended: false,
    joined: addDays(T, -45), birthday: null,
  },
  {
    id: 'u5', name: 'Kenji Watanabe', email: 'kenji.w@example.com', phone: '',
    channel: 'google', country: 'JP', lang: 'en', avatar: '🗻',
    stamps: 0, bookingsYear: 52, credits: 500, suspended: false,
    joined: addDays(T, -300), birthday: '1990-06-18',
  },
  {
    id: 'u6', name: 'ปอ ปวีณา', email: 'por.p@example.com', phone: '082-999-0011',
    channel: 'line', country: 'TH', lang: 'th', avatar: '🦋',
    stamps: 5, bookingsYear: 12, credits: 0, suspended: true,
    joined: addDays(T, -120), birthday: null,
  },
]

// Seed bookings around today. status: upcoming | completed | cancelled
let bid = 0
const B = (userId, courtId, dayOffset, hour, opts = {}) => {
  const date = addDays(T, dayOffset)
  const court = COURTS.find((c) => c.id === courtId)
  const price = isPeak(date, hour) ? court.pricePeak : court.priceOff
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

export const SEED_PROMOS = [
  { id: 'p1', code: 'BOUNCE50', type: 'fixed', value: 50, expiry: addDays(T, 30), limit: 100, used: 34, active: true },
  { id: 'p2', code: 'SMASH10', type: 'percent', value: 10, expiry: addDays(T, 14), limit: 50, used: 12, active: true },
  { id: 'p3', code: 'NEWBIE', type: 'fixed', value: 100, expiry: addDays(T, 60), limit: 200, used: 87, active: true },
  { id: 'p4', code: 'SONGKRAN', type: 'percent', value: 20, expiry: addDays(T, -10), limit: 100, used: 100, active: false },
]

export const SEED_VOUCHERS = [
  { id: 'v1', userId: 'u3', issued: addDays(T, -20), expiry: addDays(T, 70), used: false, source: 'stamps' },
  { id: 'v2', userId: 'u5', issued: addDays(T, -50), expiry: addDays(T, 40), used: false, source: 'manual' },
  { id: 'v3', userId: 'u1', issued: addDays(T, -100), expiry: addDays(T, -10), used: true, source: 'stamps' },
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
  gatewayKey: 'pk_test_••••••••7d2f',
}
