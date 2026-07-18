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

// ── "จองให้ลูกค้า" — admin books one or more slots for a phone/walk-in customer ──
function BookForCustomerModal({ onClose }) {
  const { lang, members, courts, slotStatus, adminCreateMultiBooking } = useStore()
  const th = lang === 'th'
  const [q, setQ] = useState('')
  const [customer, setCustomer] = useState(null)
  const [guestMode, setGuestMode] = useState(false)
  const [guest, setGuest] = useState({ name: '', phone: '' })
  const [courtId, setCourtId] = useState(courts.find((c) => c.active)?.id ?? '')
  const [date, setDate] = useState(todayISO())
  const [picks, setPicks] = useState([])   // [{courtId, date, hour}] — may span courts/dates
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(false)

  const court = courts.find((c) => c.id === courtId)
  const matches = q.trim()
    ? members.filter((m) => !m.suspended &&
        (m.name + m.email + m.phone).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : []

  const priceOf = (p) => {
    const c = courts.find((x) => x.id === p.courtId)
    return isPeak(p.date, p.hour) ? c.pricePeak : c.priceOff
  }
  const total = picks.reduce((s, p) => s + priceOf(p), 0)
  const isPicked = (h) => picks.some((p) => p.courtId === courtId && p.date === date && p.hour === h)
  const togglePick = (h) => setPicks((ps) => isPicked(h)
    ? ps.filter((p) => !(p.courtId === courtId && p.date === date && p.hour === h))
    : [...ps, { courtId, date, hour: h }])
  const removePick = (p) => setPicks((ps) => ps.filter((x) => x !== p))

  const confirmBooking = async () => {
    setBusy(true)
    try {
      const bookings = await adminCreateMultiBooking({
        userId: guestMode ? null : customer.id,
        guest: guestMode ? guest : null,
        items: picks,
      })
      setSuccess(bookings)
    } catch (e) {
      console.error('[Bounce] admin booking failed', e)
      alert(th ? 'จองไม่สำเร็จ ลองใหม่อีกครั้ง' : 'Booking failed — please try again')
    }
    setBusy(false)
  }

  if (success) {
    const grand = success.reduce((s, b) => s + b.total, 0)
    return (
      <Modal onClose={onClose}>
        <div className="tc" style={{ paddingTop: 8 }}>
          <div className="success-ball" style={{ width: 60, height: 60, fontSize: 28 }}>🏓</div>
          <h3 className="mt-3" style={{ fontSize: 17 }}>{t('bookForSuccess', lang)}</h3>
          <div className="num mt-1" style={{ fontSize: 20 }}>{success[0].ref}</div>
          <p className="muted mt-1">{success.length} {th ? 'ช่องเวลา' : 'slot(s)'}</p>
          <div className="card-flat pad-4 mt-3" style={{ textAlign: 'left' }}>
            <div className="row between"><span className="muted tiny">{t('customer', lang)}</span><b>{guestMode ? `🎾 ${guest.name} (Guest)` : `${customer.avatar} ${customer.name}`}</b></div>
            {success.map((b) => {
              const c = courts.find((x) => x.id === b.courtId)
              return (
                <div key={b.id} className="row between mt-2">
                  <span className="tiny">{lang === 'th' ? c.nameTh : c.name} · {fmtDate(b.date, lang)} · {hourLabel(b.hour)}</span>
                  <b className="num">฿{b.total}</b>
                </div>
              )
            })}
            <div className="row between mt-2" style={{ borderTop: '2px solid var(--stroke)', paddingTop: 8 }}>
              <b>{th ? 'รวม' : 'Total'}</b><b className="num">฿{grand}</b>
            </div>
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

      {/* step 1: customer — existing member or a walk-in guest */}
      <label className="label">{t('selectCustomer', lang)}</label>
      <div className="row gap-2" style={{ marginBottom: 8 }}>
        <button className={`btn btn-sm ${!guestMode ? 'btn-pine' : ''}`}
          onClick={() => setGuestMode(false)}>{th ? 'สมาชิก' : 'Member'}</button>
        <button className={`btn btn-sm ${guestMode ? 'btn-pine' : ''}`}
          onClick={() => { setGuestMode(true); setCustomer(null); setQ('') }}>
          {th ? 'Guest (ไม่ต้องสมัคร)' : 'Guest (no account)'}
        </button>
      </div>

      {guestMode ? (
        <div className="col gap-2">
          <input className="input" maxLength={60} placeholder={th ? 'ชื่อลูกค้า (จำเป็น)' : 'Guest name (required)'}
            value={guest.name} onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))} />
          <input className="input" maxLength={20} placeholder={th ? 'เบอร์โทร (ไม่บังคับ)' : 'Phone (optional)'}
            value={guest.phone} onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))} />
        </div>
      ) : customer ? (
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

      {/* step 2: court + date (picks persist when you switch court/date) */}
      <div className="row gap-3 mt-4">
        <div className="flex-1">
          <label className="label">{t('pickCourt', lang)}</label>
          <select className="select" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
            {courts.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{lang === 'th' ? c.nameTh : c.name}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="label">{t('pickDate', lang)}</label>
          <input className="input" type="date" min={todayISO()} value={date}
            onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {/* step 3: time slots — tap to add/remove, multiple allowed */}
      <label className="label mt-4">{t('pickSlot', lang)} <span className="tiny muted">({th ? 'เลือกได้หลายช่อง' : 'select multiple'})</span></label>
      {!court ? (
        <p className="tiny muted">{t('pickSlotFirst', lang)}</p>
      ) : (
        <div className="slot-grid">
          {Array.from({ length: court.close - court.open }, (_, i) => {
            const h = court.open + i
            const st = slotStatus(court, date, h)
            const peak = isPeak(date, h)
            const picked = isPicked(h)
            return (
              <button key={h} type="button"
                className={`slot ${st} ${peak ? 'peak' : ''} ${picked ? 'selected' : ''}`}
                disabled={st !== 'free'} onClick={() => togglePick(h)}>
                {hourLabel(h)}
                <small>{st === 'free' ? `฿${peak ? court.pricePeak : court.priceOff}` : t('slot' + st[0].toUpperCase() + st.slice(1), lang)}</small>
              </button>
            )
          })}
        </div>
      )}

      {/* selected slots summary */}
      {picks.length > 0 && (
        <div className="card-flat pad-3 mt-4">
          <div className="label" style={{ marginBottom: 6 }}>{th ? `เลือกแล้ว ${picks.length} ช่อง` : `${picks.length} slot(s) selected`}</div>
          {picks.map((p) => {
            const c = courts.find((x) => x.id === p.courtId)
            return (
              <div key={`${p.courtId}-${p.date}-${p.hour}`} className="row between" style={{ padding: '4px 0' }}>
                <span className="tiny">{lang === 'th' ? c.nameTh : c.name} · {fmtDate(p.date, lang)} · {hourLabel(p.hour)}</span>
                <span className="row gap-2" style={{ alignItems: 'center' }}>
                  <b className="num">฿{priceOf(p)}</b>
                  <button className="btn btn-sm btn-ghost" onClick={() => removePick(p)} aria-label="remove"><Icon name="x" size={12} /></button>
                </span>
              </div>
            )
          })}
          <div className="row between mt-2" style={{ borderTop: '1px solid #E3E1D5', paddingTop: 6 }}>
            <b>{th ? 'รวม' : 'Total'}</b><b className="num">฿{total}</b>
          </div>
        </div>
      )}

      <div className="modal-foot">
        <button className="btn" onClick={onClose}>{t('cancel', lang)}</button>
        <button className="btn btn-lime" onClick={confirmBooking}
          disabled={busy || picks.length === 0 || (guestMode ? !guest.name.trim() : !customer)}>
          <Icon name="check" size={16} /> {busy ? '…' : `${t('confirmBooking', lang)}${picks.length > 1 ? ` (${picks.length})` : ''}`}
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
