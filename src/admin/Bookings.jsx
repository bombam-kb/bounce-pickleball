import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { Icon, StatusChip, hourLabel, downloadCSV, usePager, Pager } from '../components/ui.jsx'

// "2026-07-12T21:47" → "อา. 12 ก.ค. · 21:47" (seed data may be date-only)
const fmtCreated = (iso, lang) => {
  if (!iso) return '—'
  const [d, tm] = iso.split('T')
  return fmtDate(d, lang) + (tm ? ` · ${tm.slice(0, 5)}` : '')
}

// slot start time has already passed but nobody confirmed attendance yet
const isPending = (b) => {
  if (b.status !== 'upcoming') return false
  const slot = new Date(`${b.date}T00:00:00`)
  slot.setHours(b.hour)
  return slot < new Date()
}

export default function Bookings() {
  const {
    lang, bookings, courts, members, cancelBooking, logAdmin,
    checkInBooking, markNoShow, revertBookingStatus,
  } = useStore()
  const [q, setQ] = useState('')
  const [fCourt, setFCourt] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [fSlotDate, setFSlotDate] = useState('')       // วันที่จอง (slot date)
  const [fCreatedDate, setFCreatedDate] = useState('') // วันที่ทำรายการ (transaction date)
  const [pendingOnly, setPendingOnly] = useState(false)
  const [sort, setSort] = useState({ key: 'created', dir: 'desc' }) // newest transactions first

  const memberName = (b) => members.find((x) => x.id === b.userId)?.name ?? ''
  const courtName = (b) => {
    const c = courts.find((x) => x.id === b.courtId)
    return c ? (lang === 'th' ? c.nameTh : c.name) : ''
  }
  const SORTERS = {
    ref: (b) => b.ref,
    customer: memberName,
    court: courtName,
    slot: (b) => b.date + String(b.hour).padStart(2, '0'),
    created: (b) => b.createdAt ?? '',
    total: (b) => b.total,
    status: (b) => b.status,
  }
  const toggleSort = (key) => setSort((s) =>
    s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })

  const pendingCount = bookings.filter(isPending).length

  const rows = bookings
    .filter((b) => fCourt === 'all' || b.courtId === fCourt)
    .filter((b) => fStatus === 'all' || b.status === fStatus)
    .filter((b) => !fSlotDate || b.date === fSlotDate)
    .filter((b) => !fCreatedDate || (b.createdAt ?? '').slice(0, 10) === fCreatedDate)
    .filter((b) => !pendingOnly || isPending(b))
    .filter((b) => !q || (memberName(b) + b.ref).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const get = SORTERS[sort.key]
      const va = get(a), vb = get(b)
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return sort.dir === 'asc' ? cmp : -cmp
    })

  const pager = usePager(rows, 10)

  const exportCsv = () => {
    downloadCSV('bounce-bookings.csv', [
      ['Ref', 'Customer', 'Court', 'Slot Date', 'Slot Time', 'Duration', 'Created At', 'Price', 'Discount', 'Total', 'Payment', 'Status', 'Checked In'],
      ...rows.map((b) => {
        const c = courts.find((x) => x.id === b.courtId)
        return [b.ref, memberName(b), c?.name, b.date, hourLabel(b.hour), b.duration, b.createdAt, b.price, b.discount, b.total, b.payMethod, b.status, b.checkedIn ? 'yes' : 'no']
      }),
    ])
    logAdmin('Export bookings CSV')
  }

  const Th = ({ k, children }) => (
    <th className={`th-sort ${sort.key === k ? 'on' : ''}`} onClick={() => toggleSort(k)}
      title={lang === 'th' ? 'กดเพื่อเรียงลำดับ' : 'Click to sort'}>
      {children}
      <span className="sort-ind">{sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ' ↕'}</span>
    </th>
  )

  const CheckInCell = ({ b }) => {
    if (b.status === 'upcoming') {
      const pending = isPending(b)
      return (
        <div className="col gap-1">
          {pending && <span className="chip chip-amber" style={{ fontSize: 10.5 }}>⏰ {t('pendingCheckIn', lang)}</span>}
          <div className="row gap-2" style={{ whiteSpace: 'nowrap' }}>
            <button className="btn btn-sm btn-outline-green" title={t('confirmArrived', lang)}
              onClick={() => confirm(`${t('confirmArrivedAsk', lang)} (${b.ref})`) && checkInBooking(b.id)}>
              <Icon name="check" size={12} /> {t('checkedInLabel', lang)}
            </button>
            <button className="btn btn-sm btn-outline-red" title={t('markNoShowBtn', lang)}
              onClick={() => confirm(`${t('markNoShowConfirm', lang)} (${b.ref})`) && markNoShow(b.id)}>
              <Icon name="x" size={12} /> {t('markNoShowBtn', lang)}
            </button>
          </div>
        </div>
      )
    }
    if ((b.status === 'completed' && b.checkedIn) || b.status === 'no_show') {
      return (
        <button className="btn btn-sm btn-ghost" onClick={() => revertBookingStatus(b.id)}>
          ↺ {t('undoAction', lang)}
        </button>
      )
    }
    return <span className="tiny muted">—</span>
  }

  return (
    <div>
      <div className="row between wrap gap-3">
        <h1 className="a-title">{t('bookingMgmt', lang)}</h1>
        <button className="btn" onClick={exportCsv}><Icon name="download" size={16} /> {t('exportCsv', lang)}</button>
      </div>

      <div className="row wrap gap-3 mt-4" style={{ alignItems: 'flex-end' }}>
        <div>
          <label className="label">{t('search', lang)}</label>
          <input className="input" style={{ maxWidth: 220 }} maxLength={60} placeholder={`${t('search', lang)}…`}
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('location', lang)}</label>
          <select className="select" style={{ maxWidth: 170 }} value={fCourt} onChange={(e) => setFCourt(e.target.value)}>
            <option value="all">{t('all', lang)}</option>
            {courts.map((c) => <option key={c.id} value={c.id}>{lang === 'th' ? c.nameTh : c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('status', lang)}</label>
          <select className="select" style={{ maxWidth: 150 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="all">{t('all', lang)}</option>
            <option value="upcoming">{t('upcoming', lang)}</option>
            <option value="completed">{t('completed', lang)}</option>
            <option value="no_show">{t('noShowStatus', lang)}</option>
            <option value="cancelled">{t('cancelled', lang)}</option>
          </select>
        </div>
        <div>
          <label className="label">{t('filterSlotDate', lang)}</label>
          <input className="input" style={{ maxWidth: 160 }} type="date" value={fSlotDate} onChange={(e) => setFSlotDate(e.target.value)} />
        </div>
        <div>
          <label className="label">{t('filterCreatedDate', lang)}</label>
          <input className="input" style={{ maxWidth: 160 }} type="date" value={fCreatedDate} onChange={(e) => setFCreatedDate(e.target.value)} />
        </div>
        {pendingCount > 0 && (
          <button className={`chip ${pendingOnly ? 'chip-pine' : 'chip-amber'}`} style={{ cursor: 'pointer' }}
            onClick={() => setPendingOnly((v) => !v)}>
            ⏰ {pendingCount} {t('showPendingOnly', lang)}
          </button>
        )}
      </div>

      <div className="card mt-4">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <Th k="ref">Ref</Th>
              <Th k="customer">{t('customer', lang)}</Th>
              <Th k="court">{t('location', lang)}</Th>
              <Th k="slot">{t('bookedSlot', lang)}</Th>
              <Th k="created">{t('createdAtCol', lang)}</Th>
              <Th k="total">฿</Th>
              <Th k="status">{t('status', lang)}</Th>
              <th title={t('checkInCol', lang)}>{t('checkInCol', lang)}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {pager.slice.map((b) => {
                const m = members.find((x) => x.id === b.userId)
                return (
                  <tr key={b.id} style={isPending(b) ? { background: 'rgba(232,161,59,0.08)' } : undefined}>
                    <td className="num">{b.ref}</td>
                    <td>{m?.avatar} {m?.name}</td>
                    <td>{courtName(b) || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.date, lang)} · <b className="num">{hourLabel(b.hour)}</b></td>
                    <td className="tiny" style={{ whiteSpace: 'nowrap' }}>{fmtCreated(b.createdAt, lang)}</td>
                    <td className="num">{b.voucherUsed ? '🎁 0' : b.total}</td>
                    <td><StatusChip status={b.status} lang={lang} /></td>
                    <td><CheckInCell b={b} /></td>
                    <td>
                      {b.status === 'upcoming' && (
                        <button className="btn btn-sm btn-danger"
                          onClick={() => confirm(`${t('cancelBooking', lang)} ${b.ref}?`) && (cancelBooking(b.id, 'admin'), logAdmin(`Cancel ${b.ref} (manual override)`))}>
                          <Icon name="x" size={13} /> {t('cancel', lang)}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && <tr><td colSpan={9} className="tc muted">—</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager {...pager} lang={lang} />
      </div>
    </div>
  )
}
