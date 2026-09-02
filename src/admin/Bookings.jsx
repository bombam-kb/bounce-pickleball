import React, { useState, useEffect } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate, DICT } from '../i18n.js'
import { Icon, Modal, StatusChip, hourLabel, AvatarGlyph, downloadCSV, usePager, Pager } from '../components/ui.jsx'
import BookForCustomerModal from './BookFor.jsx'

// "2026-07-12T21:47" → "อา. 12 ก.ค. · 21:47" (seed data may be date-only)
const fmtCreated = (iso, lang) => {
  if (!iso) return '—'
  const [d, tm] = iso.split('T')
  return fmtDate(d, lang) + (tm ? ` · ${tm.slice(0, 5)}` : '')
}

const slipErrKey = (code) => (DICT[`slipErr_${code}`] ? `slipErr_${code}` : 'slipErr_generic')

/**
 * Payment slips are private personal data: the bucket has no public access, so
 * this asks the server for a link that expires in minutes, and the server logs
 * the access. Nothing is prefetched — a slip is only fetched when staff ask.
 */
function SlipViewer({ booking, onClose }) {
  const { lang, fetchSlipUrl } = useStore()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let alive = true
    fetchSlipUrl(booking.id)
      .then((r) => { if (alive) setState({ url: r.url, transRef: r.transRef, slipExpiresAt: r.slipExpiresAt }) })
      .catch((e) => { if (alive) setState({ err: t(slipErrKey(e?.code), lang) }) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id])

  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 18 }}>{t('slipTitle', lang)}</h3>
      <div className="tiny mt-1">
        {booking.ref} · {fmtDate(booking.date, lang)} · {hourLabel(booking.hour)} · ฿{booking.total}
      </div>

      {state.loading && <div className="tc muted mt-4">{t('slipLoading', lang)}</div>}
      {state.err && (
        <div className="chip chip-red mt-3" style={{ width: '100%', whiteSpace: 'normal', justifyContent: 'center' }}>
          {state.err}
        </div>
      )}
      {state.url && (
        <>
          <img className="slip-view mt-3" src={state.url} alt={t('slipTitle', lang)} />
          {state.transRef && (
            <div className="tiny mt-2">{t('slipTransRefLabel', lang)}: <span className="num">{state.transRef}</span></div>
          )}
          {state.slipExpiresAt && (
            <div className="tiny">{t('slipDeleteOn', lang, { d: fmtDate(state.slipExpiresAt, lang) })}</div>
          )}
        </>
      )}

      <p className="tiny slip-pdpa mt-3">{t('slipPdpaNote', lang)}</p>
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
  const [sort, setSort] = useState({ key: 'slot', dir: 'desc' })
  const [bookForOpen, setBookForOpen] = useState(false)
  const [slipFor, setSlipFor] = useState(null)

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
      ['Ref', 'Customer', 'Court', 'Slot Date', 'Slot Time', 'Duration', 'Created At', 'Price', 'Discount', 'Total', 'Payment', 'Slip Ref', 'Status'],
      ...rows.map((b) => {
        const c = courts.find((x) => x.id === b.courtId)
        return [b.ref, memberName(b), c?.name, b.date, hourLabel(b.hour), b.duration, b.createdAt, b.price, b.discount, b.total, b.payMethod, b.slipTransRef ?? '', b.status]
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
              <Th k="slot">{t('bookedSlot', lang)}</Th>
              <Th k="customer">{t('customer', lang)}</Th>
              <Th k="court">{t('location', lang)}</Th>
              <Th k="total">{t('price', lang)}</Th>
              <Th k="status">{t('status', lang)}</Th>
              <Th k="created">{t('createdAtCol', lang)}</Th>
              <Th k="ref">Ref</Th>
              <th>{t('slipCol', lang)}</th>
              <th></th>
            </tr></thead>
            <tbody>
              {pager.slice.map((b) => {
                const m = members.find((x) => x.id === b.userId)
                return (
                  <tr key={b.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.date, lang)} · <b className="num">{hourLabel(b.hour)}</b></td>
                    <td><span className="row gap-1" style={{ alignItems: 'center' }}><AvatarGlyph avatar={m?.avatar} size={16} /> {m?.name}</span></td>
                    <td>{courtName(b) || '—'}</td>
                    <td className="num">{b.voucherUsed || b.total === 0 ? t('free', lang) : `฿${b.total}`}</td>
                    <td><StatusChip status={b.status} lang={lang} /></td>
                    <td className="tiny" style={{ whiteSpace: 'nowrap' }}>{fmtCreated(b.createdAt, lang)}</td>
                    <td className="num">{b.ref}</td>
                    <td>
                      {b.slipPath ? (
                        <button className="btn btn-sm btn-ghost" onClick={() => setSlipFor(b)}
                          title={t('viewSlip', lang)}>
                          <Icon name="image" size={13} /> {t('viewSlip', lang)}
                        </button>
                      ) : <span className="muted">—</span>}
                    </td>
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

      <p className="tiny slip-pdpa mt-3">
        <Icon name="image" size={13} /> {t('slipRetentionHint', lang)}
      </p>

      {bookForOpen && <BookForCustomerModal onClose={() => setBookForOpen(false)} />}
      {slipFor && <SlipViewer booking={slipFor} onClose={() => setSlipFor(null)} />}
    </div>
  )
}
