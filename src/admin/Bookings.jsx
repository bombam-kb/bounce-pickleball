import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { todayISO, isPeak } from '../data/index.js'
import { Icon, Modal, StatusChip, hourLabel, downloadCSV, usePager, Pager } from '../components/ui.jsx'

// "2026-07-12T21:47" → "อา. 12 ก.ค. · 21:47" (seed data may be date-only)
const fmtCreated = (iso, lang) => {
  if (!iso) return '—'
  const [d, tm] = iso.split('T')
  return fmtDate(d, lang) + (tm ? ` · ${tm.slice(0, 5)}` : '')
}

// ── "จองให้ลูกค้า" — admin books a slot on behalf of a phone/walk-in customer ──
function BookForCustomerModal({ onClose }) {
  const { lang, members, courts, settings, slotStatus, adminCreateBooking } = useStore()
  const [q, setQ] = useState('')
  const [customer, setCustomer] = useState(null)
  const [courtId, setCourtId] = useState(courts.find((c) => c.active)?.id ?? '')
  const [date, setDate] = useState(todayISO())
  const [hour, setHour] = useState(null)
  const [duration, setDuration] = useState(settings.slotDuration)
  const [success, setSuccess] = useState(null)

  const court = courts.find((c) => c.id === courtId)
  const matches = q.trim()
    ? members.filter((m) => !m.suspended &&
        (m.name + m.email + m.phone).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : []

  const confirmBooking = () => {
    const booking = adminCreateBooking({ userId: customer.id, courtId, date, hour, duration })
    setSuccess(booking)
  }

  if (success) {
    const price = isPeak(date, hour) ? court.pricePeak : court.priceOff
    return (
      <Modal onClose={onClose}>
        <div className="tc" style={{ paddingTop: 8 }}>
          <div className="success-ball" style={{ width: 60, height: 60, fontSize: 28 }}>🏓</div>
          <h3 className="mt-3" style={{ fontSize: 17 }}>{t('bookForSuccess', lang)}</h3>
          <div className="num mt-1" style={{ fontSize: 22 }}>{success.ref}</div>
          <div className="card-flat pad-4 mt-4" style={{ textAlign: 'left' }}>
            <div className="row between"><span className="muted tiny">{t('customer', lang)}</span><b>{customer.avatar} {customer.name}</b></div>
            <div className="row between mt-2"><span className="muted tiny">{t('location', lang)}</span><b>{lang === 'th' ? court.nameTh : court.name}</b></div>
            <div className="row between mt-2"><span className="muted tiny">{t('dateTime', lang)}</span><b>{fmtDate(date, lang)} · {hourLabel(hour)}</b></div>
            <div className="row between mt-2"><span className="muted tiny">{t('price', lang)}</span><b className="num">฿{price * (duration / 60)}</b></div>
          </div>
          <button className="btn btn-pine btn-full btn-lg mt-4" onClick={onClose}>{t('close', lang)}</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose}>
      <div className="modal-header">
        <h3 style={{ fontSize: 17 }}>{t('bookForTitle', lang)}</h3>
      </div>

      {/* step 1: customer */}
      <label className="label">{t('selectCustomer', lang)}</label>
      {customer ? (
        <div className="card-flat pad-3 row between">
          <span>{customer.avatar} <b>{customer.name}</b> <span className="tiny muted">· {customer.email}</span></span>
          <button className="btn btn-sm btn-ghost" onClick={() => { setCustomer(null); setQ('') }}>{t('changeCustomer', lang)}</button>
        </div>
      ) : (
        <>
          <input className="input" maxLength={60} placeholder={t('searchCustomerPlaceholder', lang)}
            value={q} onChange={(e) => setQ(e.target.value)} />
          {q.trim() && (
            <div className="card-flat mt-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {matches.map((m) => (
                <button key={m.id} className="row between pad-3" style={{ width: '100%', textAlign: 'left', borderBottom: '1px solid #E3E1D5' }}
                  onClick={() => setCustomer(m)}>
                  <span>{m.avatar} <b>{m.name}</b></span>
                  <span className="tiny muted">{m.email || m.phone}</span>
                </button>
              ))}
              {matches.length === 0 && <div className="tc tiny muted pad-4">{t('noCustomerFound', lang)}</div>}
            </div>
          )}
        </>
      )}

      {/* step 2: court + date */}
      <div className="row gap-3 mt-4">
        <div className="flex-1">
          <label className="label">{t('pickCourt', lang)}</label>
          <select className="select" value={courtId} onChange={(e) => { setCourtId(e.target.value); setHour(null) }}>
            {courts.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{lang === 'th' ? c.nameTh : c.name}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="label">{t('pickDate', lang)}</label>
          <input className="input" type="date" min={todayISO()} value={date}
            onChange={(e) => { setDate(e.target.value); setHour(null) }} />
        </div>
      </div>

      {/* step 3: time slot */}
      <label className="label mt-4">{t('pickSlot', lang)}</label>
      {!court ? (
        <p className="tiny muted">{t('pickSlotFirst', lang)}</p>
      ) : (
        <div className="slot-grid">
          {Array.from({ length: court.close - court.open }, (_, i) => {
            const h = court.open + i
            const st = slotStatus(court, date, h)
            const peak = isPeak(date, h)
            return (
              <button key={h} type="button"
                className={`slot ${st} ${peak ? 'peak' : ''} ${hour === h ? 'selected' : ''}`}
                disabled={st !== 'free'} onClick={() => setHour(h)}>
                {hourLabel(h)}
                <small>{st === 'free' ? `฿${peak ? court.pricePeak : court.priceOff}` : t('slot' + st[0].toUpperCase() + st.slice(1), lang)}</small>
              </button>
            )
          })}
        </div>
      )}

      {/* duration */}
      <div className="row between mt-4" style={{ alignItems: 'center' }}>
        <span className="label" style={{ margin: 0 }}>{t('duration', lang)}</span>
        <div className="row gap-2">
          {[60, 90].map((d) => (
            <button key={d} className={`btn btn-sm ${duration === d ? 'btn-pine' : ''}`} onClick={() => setDuration(d)}>
              {d} {t('min', lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{t('cancel', lang)}</button>
        <button className="btn btn-lime" disabled={!customer || !court || hour === null} onClick={confirmBooking}>
          <Icon name="check" size={16} /> {t('confirmBooking', lang)}
        </button>
      </div>
    </Modal>
  )
}

export default function Bookings() {
  const { lang, bookings, courts, members, cancelBooking, logAdmin } = useStore()
  const [q, setQ] = useState('')
  const [fCourt, setFCourt] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [fSlotDate, setFSlotDate] = useState('')       // วันที่จอง (slot date)
  const [fCreatedDate, setFCreatedDate] = useState('') // วันที่ทำรายการ (transaction date)
  const [sort, setSort] = useState({ key: 'created', dir: 'desc' }) // newest transactions first
  const [bookForOpen, setBookForOpen] = useState(false)

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

  const rows = bookings
    .filter((b) => fCourt === 'all' || b.courtId === fCourt)
    .filter((b) => fStatus === 'all' || b.status === fStatus)
    .filter((b) => !fSlotDate || b.date === fSlotDate)
    .filter((b) => !fCreatedDate || (b.createdAt ?? '').slice(0, 10) === fCreatedDate)
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
      ['Ref', 'Customer', 'Court', 'Slot Date', 'Slot Time', 'Duration', 'Created At', 'Price', 'Discount', 'Total', 'Payment', 'Status'],
      ...rows.map((b) => {
        const c = courts.find((x) => x.id === b.courtId)
        return [b.ref, memberName(b), c?.name, b.date, hourLabel(b.hour), b.duration, b.createdAt, b.price, b.discount, b.total, b.payMethod, b.status]
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

  return (
    <div>
      <div className="row between wrap gap-3">
        <h1 className="a-title">{t('bookingMgmt', lang)}</h1>
        <div className="row gap-2">
          <button className="btn btn-lime" onClick={() => setBookForOpen(true)}>
            <Icon name="plus" size={16} /> {t('bookFor', lang)}
          </button>
          <button className="btn" onClick={exportCsv}><Icon name="download" size={16} /> {t('exportCsv', lang)}</button>
        </div>
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
              <th></th>
            </tr></thead>
            <tbody>
              {pager.slice.map((b) => {
                const m = members.find((x) => x.id === b.userId)
                return (
                  <tr key={b.id}>
                    <td className="num">{b.ref}</td>
                    <td>{m?.avatar} {m?.name}</td>
                    <td>{courtName(b) || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.date, lang)} · <b className="num">{hourLabel(b.hour)}</b></td>
                    <td className="tiny" style={{ whiteSpace: 'nowrap' }}>{fmtCreated(b.createdAt, lang)}</td>
                    <td className="num">{b.voucherUsed ? '🎁 0' : b.total}</td>
                    <td><StatusChip status={b.status} lang={lang} /></td>
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
              {rows.length === 0 && <tr><td colSpan={8} className="tc muted">—</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager {...pager} lang={lang} />
      </div>

      {bookForOpen && <BookForCustomerModal onClose={() => setBookForOpen(false)} />}
    </div>
  )
}
