import React, { useState } from 'react'
import { TIERS, tierOf } from '../data/index.js'

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

export const TierBadge = ({ bookingsYear, size = 'md' }) => {
  const tier = tierOf(bookingsYear)
  return (
    <span className="chip" style={{
      background: tier.color + '22', borderColor: tier.color, color: '#3a3a2e',
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
    google: ['#4285F4', 'Google'],
    email: ['#8A968E', 'Email'],
  }
  const [color, label] = map[channel] || ['#8A968E', channel]
  return <span className="chip" style={{ borderColor: color, color, background: color + '14' }}>{label}</span>
}

export const hourLabel = (h) => `${String(h).padStart(2, '0')}:00`

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
