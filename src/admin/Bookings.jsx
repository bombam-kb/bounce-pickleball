import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { Icon, StatusChip, hourLabel, downloadCSV, usePager, Pager } from '../components/ui.jsx'

export default function Bookings() {
  const { lang, bookings, courts, members, cancelBooking, logAdmin } = useStore()
  const [q, setQ] = useState('')
  const [fCourt, setFCourt] = useState('all')
  const [fStatus, setFStatus] = useState('all')
  const [fDate, setFDate] = useState('')

  const rows = bookings
    .filter((b) => fCourt === 'all' || b.courtId === fCourt)
    .filter((b) => fStatus === 'all' || b.status === fStatus)
    .filter((b) => !fDate || b.date === fDate)
    .filter((b) => {
      if (!q) return true
      const m = members.find((x) => x.id === b.userId)
      return (m?.name + b.ref).toLowerCase().includes(q.toLowerCase())
    })
    .sort((a, b) => (a.date + String(a.hour).padStart(2, '0') < b.date + String(b.hour).padStart(2, '0') ? 1 : -1))

  const pager = usePager(rows, 10)

  const exportCsv = () => {
    downloadCSV('bounce-bookings.csv', [
      ['Ref', 'Customer', 'Court', 'Date', 'Time', 'Duration', 'Price', 'Discount', 'Total', 'Payment', 'Status'],
      ...rows.map((b) => {
        const m = members.find((x) => x.id === b.userId)
        const c = courts.find((x) => x.id === b.courtId)
        return [b.ref, m?.name, c?.name, b.date, hourLabel(b.hour), b.duration, b.price, b.discount, b.total, b.payMethod, b.status]
      }),
    ])
    logAdmin('Export bookings CSV')
  }

  return (
    <div>
      <div className="row between wrap gap-3">
        <h1 className="a-title">{t('bookingMgmt', lang)}</h1>
        <button className="btn" onClick={exportCsv}><Icon name="download" size={16} /> {t('exportCsv', lang)}</button>
      </div>

      <div className="row wrap gap-2 mt-4">
        <input className="input" style={{ maxWidth: 220 }} maxLength={60} placeholder={`${t('search', lang)}…`}
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ maxWidth: 170 }} value={fCourt} onChange={(e) => setFCourt(e.target.value)}>
          <option value="all">{t('all', lang)} — {t('location', lang)}</option>
          {courts.map((c) => <option key={c.id} value={c.id}>{lang === 'th' ? c.nameTh : c.name}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 150 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">{t('all', lang)} — {t('status', lang)}</option>
          <option value="upcoming">{t('upcoming', lang)}</option>
          <option value="completed">{t('completed', lang)}</option>
          <option value="cancelled">{t('cancelled', lang)}</option>
        </select>
        <input className="input" style={{ maxWidth: 160 }} type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
      </div>

      <div className="card mt-4">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Ref</th><th>{t('customer', lang)}</th><th>{t('location', lang)}</th>
              <th>{t('dateTime', lang)}</th><th>฿</th><th>{t('status', lang)}</th><th></th>
            </tr></thead>
            <tbody>
              {pager.slice.map((b) => {
                const m = members.find((x) => x.id === b.userId)
                const c = courts.find((x) => x.id === b.courtId)
                return (
                  <tr key={b.id}>
                    <td className="num">{b.ref}</td>
                    <td>{m?.avatar} {m?.name}</td>
                    <td>{c ? (lang === 'th' ? c.nameTh : c.name) : '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.date, lang)} · <span className="num">{hourLabel(b.hour)}</span></td>
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
              {rows.length === 0 && <tr><td colSpan={7} className="tc muted">—</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager {...pager} lang={lang} />
      </div>
    </div>
  )
}
