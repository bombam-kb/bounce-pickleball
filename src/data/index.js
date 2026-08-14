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
  gatewayKey: 'pk_test_••••••••7d2f',
}
