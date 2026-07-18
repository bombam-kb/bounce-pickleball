import React, { useState } from 'react'
import { TIERS, tierOf, todayISO, addDays } from '../data/index.js'
import { DAY_NAMES, MONTH_NAMES, t } from '../i18n.js'

const PATHS = {
  ball: <><circle cx="12" cy="12" r="9" /><circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none" /><circle cx="14.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="13.5" r="1.2" fill="currentColor" stroke="none" /><circle cx="15.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" /><circle cx="8.5" cy="15" r="1.2" fill="currentColor" stroke="none" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  ticket: <><path d="M3 9V7a2 2 0 012-2h14a2 2 0 012 2v2a3 3 0 000 6v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a3 3 0 000-6z" /><path d="M13 5v14" strokeDasharray="2.5 3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-8M21 20H3" /></>,
  grid: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1.2-3.4 4-5 6.5-5s5.3 1.6 6.5 5" /><circle cx="17" cy="9" r="2.6" /><path d="M16 15.2c2.4.2 4.6 1.7 5.5 4.4" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v2.7M12 18.5v2.7M4.6 6.5l1.9 1.9M17.5 15.6l1.9 1.9M2.8 12h2.7M18.5 12h2.7M4.6 17.5l1.9-1.9M17.5 8.4l1.9-1.9" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2.5" /></>,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  chevL: <path d="M15 5l-7 7 7 7" />,
  download: <><path d="M12 4v11M7 11l5 5 5-5" /><path d="M4 20h16" /></>,
  tag: <><path d="M3 12V4a1 1 0 011-1h8l9 9-9 9-9-9z" /><circle cx="8" cy="8" r="1.6" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3h-3zM19 19h2M19 14h2M14 19h1" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /></>,
  pencil: <><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" /></>,
  trash: <><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6.5 7l1 13h9l1-13" /><path d="M10 11v5M14 11v5" /></>,
  block: <><circle cx="12" cy="12" r="9" /><path d="M5.7 5.7l12.6 12.6" /></>,
  bell: <><path d="M6 9.5a6 6 0 0112 0c0 4.6 1.8 5.8 1.8 5.8H4.2S6 14.1 6 9.5" /><path d="M10.2 19.5a2 2 0 003.6 0" /></>,
  trend: <><path d="M3 16l5.5-6.5 4 3.5L20 6" /><path d="M15.5 6H20v4.5" /><path d="M3 20h18" /></>,
  cake: <><path d="M4 20h16v-7a2 2 0 00-2-2H6a2 2 0 00-2 2v7z" /><path d="M4 15.5c1.3 1.2 2.7 1.2 4 0s2.7-1.2 4 0 2.7 1.2 4 0 2.7-1.2 4 0" /><path d="M12 8v3M12 5.5a1.2 1.2 0 001.2-1.3C13.2 3 12 2 12 2s-1.2 1-1.2 2.2A1.2 1.2 0 0012 5.5z" /></>,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M9.5 10c0-1 1-1.8 2.5-1.8s2.5.7 2.5 1.7c0 2.3-5 1.9-5 4.1 0 1 1 1.8 2.5 1.8s2.5-.8 2.5-1.8" /></>,
}

export const Icon = ({ name, size = 20, stroke = 1.8 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0 }}>
    {PATHS[name] || PATHS.ball}
  </svg>
)

export const Modal = ({ onClose, children }) => (
  <div className="modal-back" onClick={onClose}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">
        <Icon name="x" size={15} stroke={2.4} />
      </button>
      {children}
    </div>
  </div>
)

// ── calendar date picker (user-facing "pick a date" popup) ────────────────
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate()
const isoOf = (y, m, d) => {
  const z = (n) => String(n).padStart(2, '0')
  return `${y}-${z(m + 1)}-${z(d)}`
}

export const CalendarModal = ({ value, onSelect, onClose, minDate, maxDate, advanceDays, lang = 'th' }) => {
  const init = new Date(value + 'T00:00:00')
  const [viewY, setViewY] = useState(init.getFullYear())
  const [viewM, setViewM] = useState(init.getMonth())

  const firstDow = new Date(viewY, viewM, 1).getDay()
  const total = daysInMonth(viewY, viewM)
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]

  const prevLastDay = new Date(viewY, viewM, 0)
  const canPrev = isoOf(prevLastDay.getFullYear(), prevLastDay.getMonth(), prevLastDay.getDate()) >= minDate
  const nextFirstDay = new Date(viewY, viewM + 1, 1)
  const canNext = isoOf(nextFirstDay.getFullYear(), nextFirstDay.getMonth(), nextFirstDay.getDate()) <= maxDate

  const goPrev = () => { const d = new Date(viewY, viewM - 1, 1); setViewY(d.getFullYear()); setViewM(d.getMonth()) }
  const goNext = () => { const d = new Date(viewY, viewM + 1, 1); setViewY(d.getFullYear()); setViewM(d.getMonth()) }
  const today = todayISO()
  const maxD = new Date(maxDate + 'T00:00:00')

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h3 style={{ fontSize: 16 }}>{MONTH_NAMES[lang][viewM]} {viewY}</h3>
        <div className="cal-nav-row">
          <button className="btn btn-sm btn-ghost" disabled={!canPrev} onClick={goPrev} aria-label="Previous month">
            <Icon name="chevL" size={16} /> {lang === 'th' ? 'เดือนก่อน' : 'Prev'}
          </button>
          <button className="btn btn-sm btn-ghost" disabled={!canNext} onClick={goNext} aria-label="Next month">
            {lang === 'th' ? 'เดือนถัดไป' : 'Next'} <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}><Icon name="chevL" size={16} /></span>
          </button>
        </div>
      </div>
      {advanceDays != null && (
        <p className="tiny muted" style={{ marginTop: -6, marginBottom: 10 }}>
          {t('calendarRangeNote', lang, { n: advanceDays, d: `${maxD.getDate()} ${MONTH_NAMES[lang][maxD.getMonth()]}` })}
        </p>
      )}
      <div className="cal-grid mt-3">
        {DAY_NAMES[lang].map((d) => <div key={d} className="cal-dow">{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={'e' + i} />
          const iso = isoOf(viewY, viewM, day)
          const disabled = iso < minDate || iso > maxDate
          return (
            <button key={iso} type="button"
              className={`cal-day ${iso === value ? 'selected' : ''} ${iso === today ? 'today' : ''}`}
              disabled={disabled} onClick={() => { onSelect(iso); onClose() }}>
              {day}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}

// darken a hex color so white text stays readable on it regardless of the
// surrounding card (light admin tables AND the dark pine membership header)
const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * (1 - amt))
  const g = Math.round(((n >> 8) & 255) * (1 - amt))
  const b = Math.round((n & 255) * (1 - amt))
  return `rgb(${r}, ${g}, ${b})`
}

export const TierBadge = ({ bookingsYear, size = 'md' }) => {
  const tier = tierOf(bookingsYear)
  return (
    <span className="chip" style={{
      background: shade(tier.color, 0.25), borderColor: 'var(--stroke)', color: '#fff',
      fontSize: size === 'lg' ? 14 : 12.5,
    }}>
      {tier.emoji} {tier.name}
    </span>
  )
}

export const StampCard = ({ stamps }) => (
  <div className="stamp-grid">
    {Array.from({ length: 10 }, (_, i) => {
      const filled = i < stamps
      const isFree = i === 9
      return (
        <div key={i}
          className={`stamp-cell ${filled ? 'filled' : ''} ${!filled && isFree ? 'freebie' : ''}`}
          style={filled ? { animationDelay: `${i * 0.05}s` } : undefined}>
          {filled ? '🏓' : isFree ? '🎁' : i + 1}
        </div>
      )
    })}
  </div>
)

export const Toggle = ({ checked, onChange }) => (
  <label className="switch">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="sl" />
  </label>
)

export const StatusChip = ({ status, lang }) => {
  const map = {
    upcoming: ['chip-blue', lang === 'th' ? 'กำลังมาถึง' : 'Upcoming'],
    completed: ['chip-green', lang === 'th' ? 'เสร็จสิ้น' : 'Completed'],
    cancelled: ['chip-red', lang === 'th' ? 'ยกเลิก' : 'Cancelled'],
  }
  const [cls, label] = map[status] || ['chip-grey', status]
  return <span className={`chip ${cls}`}>{label}</span>
}

export const ChannelChip = ({ channel }) => {
  const map = {
    line: ['#06C755', 'LINE'],
    email: ['#8A968E', 'Email'],
  }
  const [color, label] = map[channel] || ['#8A968E', channel]
  return <span className="chip" style={{ borderColor: color, color, background: color + '14' }}>{label}</span>
}

export const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`

// ── PDF booking slip — printable window; browsers save via "Save as PDF" ──
export const printSlip = (b, court, member, lang) => {
  const th = lang === 'th'
  const w = window.open('', '_blank', 'width=420,height=680')
  if (!w) { alert(th ? 'เบราว์เซอร์บล็อกหน้าต่างใหม่ — กรุณาอนุญาต popup' : 'Popup blocked — please allow popups'); return }
  const hourLbl = `${String(b.hour).padStart(2, '0')}:00`
  const payLabel = { promptpay: 'QR PromptPay', card: th ? 'บัตรเครดิต/เดบิต' : 'Credit/Debit', credits: 'Credits', voucher: 'Free Voucher', counter: th ? 'จองให้โดยพนักงาน' : 'Booked by staff' }[b.payMethod] || b.payMethod
  w.document.write(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<title>${b.ref} — Bounce Pickleball House</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Prompt:wght@500;700;800&family=Anuphan:wght@400;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Anuphan', Tahoma, sans-serif; color: #101B14; padding: 24px; background: #fff; }
  .slip { max-width: 360px; margin: 0 auto; border: 2px solid #101B14; border-radius: 16px; overflow: hidden; }
  .head { background: #16382B; color: #C6F135; text-align: center; padding: 18px 16px 14px; font-family: 'Prompt', Tahoma, sans-serif; }
  .head h1 { font-size: 18px; letter-spacing: 1px; }
  .head small { color: #F7F4EA; font-size: 10px; letter-spacing: 3px; }
  .ref { text-align: center; padding: 14px; border-bottom: 2px dashed #B9B4A2; }
  .ref .label { font-size: 11px; color: #8A968E; }
  .ref .code { font-family: 'Prompt', monospace; font-size: 24px; font-weight: 800; letter-spacing: 1px; }
  .rows { padding: 14px 18px; }
  .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13.5px; border-bottom: 1px solid #EFECE0; }
  .row:last-child { border-bottom: none; }
  .row .k { color: #8A968E; }
  .row .v { font-weight: 600; text-align: right; }
  .total { background: #C6F135; display: flex; justify-content: space-between; padding: 12px 18px; font-family: 'Prompt', Tahoma, sans-serif; font-weight: 800; font-size: 17px; border-top: 2px solid #101B14; }
  .foot { text-align: center; padding: 12px; font-size: 10.5px; color: #8A968E; }
  @media print { body { padding: 0 } .noprint { display: none } }
  .noprint { display: block; margin: 16px auto 0; padding: 10px 24px; font-family: 'Prompt', Tahoma, sans-serif; font-weight: 700; border: 2px solid #101B14; border-radius: 999px; background: #C6F135; cursor: pointer; }
</style></head><body>
<div class="slip">
  <div class="head"><h1>🏓 BOUNCE</h1><small>PICKLEBALL HOUSE</small></div>
  <div class="ref"><div class="label">${th ? 'หมายเลขการจอง' : 'Booking Reference'}</div><div class="code">${b.ref}</div></div>
  <div class="rows">
    <div class="row"><span class="k">${th ? 'ผู้จอง' : 'Customer'}</span><span class="v">${member?.name ?? '—'}</span></div>
    <div class="row"><span class="k">${th ? 'สนาม' : 'Court'}</span><span class="v">${th ? (court?.nameTh ?? '') : (court?.name ?? '')}</span></div>
    <div class="row"><span class="k">${th ? 'วันที่' : 'Date'}</span><span class="v">${b.date}</span></div>
    <div class="row"><span class="k">${th ? 'เวลา' : 'Time'}</span><span class="v">${hourLbl} · ${b.duration} ${th ? 'นาที' : 'min'}</span></div>
    <div class="row"><span class="k">${th ? 'ชำระโดย' : 'Paid via'}</span><span class="v">${payLabel}</span></div>
    ${b.discount ? `<div class="row"><span class="k">${th ? 'ส่วนลด' : 'Discount'}</span><span class="v">−฿${b.discount}</span></div>` : ''}
  </div>
  <div class="total"><span>${th ? 'ยอดชำระ' : 'Total'}</span><span>${b.total === 0 ? (th ? 'ฟรี' : 'FREE') : '฿' + b.total}</span></div>
  <div class="foot">${th ? 'แสดงใบนี้ที่เคาน์เตอร์ก่อนลงสนาม · ขอบคุณที่ใช้บริการ' : 'Show this slip at the counter · Thank you!'}</div>
</div>
<button class="noprint">🖨 ${th ? 'พิมพ์ / บันทึกเป็น PDF' : 'Print / Save as PDF'}</button>
</body></html>`)
  w.document.close()
  // bind from opener — inline onclick would be blocked by CSP (script-src 'self')
  setTimeout(() => {
    try {
      w.document.querySelector('.noprint')?.addEventListener('click', () => w.print())
      w.focus(); w.print()
    } catch { /* user closed */ }
  }, 450)
}

// ── pagination ────────────────────────────────────────────────────────────
// const pager = usePager(filteredItems, 10) → render pager.slice, then <Pager {...pager} lang={lang} />
export const usePager = (items, perPage = 10) => {
  const [page, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(items.length / perPage))
  const cur = Math.min(page, pages) // clamp when the list shrinks (filters, deletes)
  return {
    slice: items.slice((cur - 1) * perPage, cur * perPage),
    page: cur, pages, setPage, total: items.length, perPage,
  }
}

export const Pager = ({ page, pages, setPage, total, perPage, lang = 'th' }) => {
  if (pages <= 1) return null
  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)
  const win = 5
  let start = Math.max(1, page - 2)
  const end = Math.min(pages, start + win - 1)
  start = Math.max(1, end - win + 1)
  const nums = []
  for (let i = start; i <= end; i++) nums.push(i)
  return (
    <div className="pager">
      <span className="pager-info">
        {lang === 'th' ? `${from}–${to} จาก ${total} รายการ` : `${from}–${to} of ${total} items`}
      </span>
      <div className="row gap-1 wrap">
        <button className="pager-btn" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous">‹</button>
        {start > 1 && (
          <>
            <button className="pager-btn" onClick={() => setPage(1)}>1</button>
            {start > 2 && <span className="pager-dots">…</span>}
          </>
        )}
        {nums.map((n) => (
          <button key={n} className={`pager-btn ${n === page ? 'on' : ''}`} onClick={() => setPage(n)}>{n}</button>
        ))}
        {end < pages && (
          <>
            {end < pages - 1 && <span className="pager-dots">…</span>}
            <button className="pager-btn" onClick={() => setPage(pages)}>{pages}</button>
          </>
        )}
        <button className="pager-btn" disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="Next">›</button>
      </div>
    </div>
  )
}

// ── date-range filter (Dashboard / Analytics) ──────────────────────────────
// const range = useDateRange('30d') → range.from/range.to (inclusive ISO dates)
// render <DateRangeBar range={range} lang={lang} /> to let the admin pick it
export const useDateRange = (initialPreset = '30d') => {
  const [preset, setPreset] = useState(initialPreset) // today | 7d | 30d | month | custom
  const [customFrom, setCustomFrom] = useState(() => addDays(todayISO(), -29))
  const [customTo, setCustomTo] = useState(todayISO())

  const today = todayISO()
  let from, to
  if (preset === 'today') { from = today; to = today }
  else if (preset === '7d') { from = addDays(today, -6); to = today }
  else if (preset === '30d') { from = addDays(today, -29); to = today }
  else if (preset === 'month') { from = today.slice(0, 8) + '01'; to = today }
  else { from = customFrom; to = customTo }
  if (from > to) [from, to] = [to, from] // guard a swapped custom range

  return { preset, setPreset, from, to, customFrom, setCustomFrom, customTo, setCustomTo }
}

export const DateRangeBar = ({ range, lang = 'th' }) => {
  const th = lang === 'th'
  const PRESETS = [
    { key: 'today', label: th ? 'วันนี้' : 'Today' },
    { key: '7d', label: th ? '7 วัน' : '7 days' },
    { key: '30d', label: th ? '30 วัน' : '30 days' },
    { key: 'month', label: th ? 'เดือนนี้' : 'This month' },
    { key: 'custom', label: th ? 'กำหนดเอง' : 'Custom' },
  ]
  return (
    <div className="row wrap gap-2" style={{ alignItems: 'center', minWidth: 0 }}>
      {PRESETS.map((p) => (
        <button key={p.key} className={`tab ${range.preset === p.key ? 'on' : ''}`} onClick={() => range.setPreset(p.key)}>
          {p.label}
        </button>
      ))}
      {range.preset === 'custom' && (
        <div className="row gap-2 wrap">
          <input className="input" type="date" style={{ maxWidth: 150 }} value={range.customFrom}
            max={range.customTo} onChange={(e) => range.setCustomFrom(e.target.value)} />
          <span className="tiny">–</span>
          <input className="input" type="date" style={{ maxWidth: 150 }} value={range.customTo}
            min={range.customFrom} onChange={(e) => range.setCustomTo(e.target.value)} />
        </div>
      )}
    </div>
  )
}

export const downloadCSV = (filename, rows) => {
  // quote every cell + neutralize formula injection (=, +, -, @, tab, CR prefixes)
  const cell = (c) => {
    let s = String(c ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return `"${s.replace(/"/g, '""')}"`
  }
  const csv = rows.map((r) => r.map(cell).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
