import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { todayISO } from '../data/index.js'
import { StatusChip, hourLabel, Icon, usePager, Pager, printSlip } from '../components/ui.jsx'

export default function MyBookings() {
  const { lang, user, bookings, courts, settings, cancelBooking } = useStore()
  const [tab, setTab] = useState('upcoming')

  const mine = bookings
    .filter((b) => b.userId === user.id)
    .map((b) => {
      // auto-mark past upcoming as completed for display
      const past = b.date < todayISO() || (b.date === todayISO() && b.hour < new Date().getHours())
      return { ...b, status: b.status === 'upcoming' && past ? 'completed' : b.status }
    })
    .filter((b) => b.status === tab)
    .sort((a, b) => (tab === 'upcoming' ? 1 : -1) * ((a.date + a.hour) < (b.date + b.hour) ? -1 : 1))

  const pager = usePager(mine, 5)

  const canCancel = (b) => {
    const start = new Date(b.date + 'T00:00:00'); start.setHours(b.hour)
    return (start - new Date()) / 36e5 >= settings.cancelHours
  }

  return (
    <div className="page">
      <h2 style={{ fontSize: 21 }}>{t('navBookings', lang)}</h2>
      <div className="tabs mt-3">
        {['upcoming', 'completed', 'cancelled'].map((k) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {t(k, lang)}
          </button>
        ))}
      </div>

      <div className="col gap-3 mt-4">
        {mine.length === 0 && <div className="card-flat pad-6 tc muted">🏓 {t('noBookings', lang)}</div>}
        {pager.slice.map((b) => {
          const court = courts.find((c) => c.id === b.courtId) || { photo: '#ccc', nameTh: '—', name: '—' }
          return (
            <div key={b.id} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ height: 8, background: court.photo }} />
              <div className="pad-4">
                <div className="row between wrap gap-2">
                  <strong style={{ fontFamily: 'var(--font-display)' }}>{lang === 'th' ? court.nameTh : court.name}</strong>
                  <StatusChip status={b.status} lang={lang} />
                </div>
                <div className="row gap-2 mt-2 tiny wrap">
                  <span><Icon name="calendar" size={13} /> {fmtDate(b.date, lang)}</span>
                  <span><Icon name="clock" size={13} /> {hourLabel(b.hour)} · {b.duration} {t('min', lang)}</span>
                  <span className="num">{b.ref}</span>
                </div>
                <div className="row between mt-3">
                  <span className="num" style={{ fontSize: 17 }}>
                    {b.voucherUsed ? '🎁 ' + t('free', lang) : `฿${b.total}`}
                  </span>
                  <div className="row gap-2">
                    {b.status !== 'cancelled' && (
                      <button className="btn btn-sm btn-ghost" onClick={() => printSlip(b, court, user, lang)}>
                        <Icon name="download" size={14} /> {t('downloadSlip', lang)}
                      </button>
                    )}
                    {b.status === 'upcoming' && (
                      canCancel(b)
                        ? <button className="btn btn-sm btn-danger" onClick={() => confirm(t('cancelBooking', lang) + '?') && cancelBooking(b.id)}>{t('cancelBooking', lang)}</button>
                        : <span className="tiny">{t('cancelTooLate', lang)}</span>
                    )}
                  </div>
                </div>
                {b.status === 'upcoming' && (
                  <div className="tiny mt-2">
                    {t('cancelPolicy', lang)} {settings.cancelHours} {t('cancelPolicyEnd', lang)}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <Pager {...pager} lang={lang} />
      </div>
    </div>
  )
}
