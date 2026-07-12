import React from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { todayISO, addDays } from '../data/index.js'
import { hourLabel, StatusChip } from '../components/ui.jsx'

export default function Dashboard() {
  const { lang, bookings, courts, members } = useStore()
  const T = todayISO()
  const weekAgo = addDays(T, -6)
  const monthAgo = addDays(T, -29)
  const live = bookings.filter((b) => b.status !== 'cancelled')

  const todayBk = live.filter((b) => b.date === T)
  const weekBk = live.filter((b) => b.date >= weekAgo && b.date <= T)
  const monthBk = live.filter((b) => b.date >= monthAgo && b.date <= T)
  const monthRevenue = monthBk.reduce((s, b) => s + b.total, 0)

  // last 7 days revenue
  const days = Array.from({ length: 7 }, (_, i) => addDays(T, i - 6))
  const daily = days.map((d) => live.filter((b) => b.date === d).reduce((s, b) => s + b.total, 0))
  const max = Math.max(...daily, 1)

  const nowHour = new Date().getHours()
  const upcomingToday = todayBk
    .filter((b) => b.hour >= nowHour)
    .sort((a, b) => a.hour - b.hour)

  return (
    <div>
      <h1 className="a-title">{t('dashboard', lang)}</h1>
      <div className="kpi-grid mt-4">
        <div className="kpi"><div className="v">{todayBk.length}</div><div className="l">{t('todayBookings', lang)}</div></div>
        <div className="kpi"><div className="v">{weekBk.length}</div><div className="l">{t('weekBookings', lang)}</div></div>
        <div className="kpi"><div className="v">{monthBk.length}</div><div className="l">{t('monthBookings', lang)}</div></div>
        <div className="kpi" style={{ background: 'var(--lime)' }}>
          <div className="v">฿{monthRevenue.toLocaleString()}</div>
          <div className="l">{t('revenue', lang)} · {t('monthBookings', lang)}</div>
        </div>
      </div>

      <div className="a-grid-2 mt-4">
        <div className="card pad-5">
          <h3 style={{ fontSize: 15 }}>{t('revenueChart', lang)}</h3>
          <div className="bars mt-2">
            {days.map((d, i) => (
              <div className="bar-col" key={d}>
                <span className="tiny num">฿{daily[i]}</span>
                <div className={`bar ${d === T ? 'today-bar' : ''}`}
                  style={{ height: `${(daily[i] / max) * 100}%`, animationDelay: `${i * 0.06}s` }} />
                <span className="tiny">{fmtDate(d, lang).split(' ').slice(1).join(' ')}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card pad-5">
          <h3 style={{ fontSize: 15 }}>{t('courtStatusNow', lang)}</h3>
          <div className="col gap-2 mt-3">
            {courts.map((c) => {
              const busy = todayBk.some((b) => b.courtId === c.id && b.hour <= nowHour && nowHour < b.hour + b.duration / 60)
              return (
                <div key={c.id} className="card-flat pad-3 row between">
                  <div className="row gap-2">
                    <span style={{ width: 12, height: 12, borderRadius: 3, background: c.photo, border: '1.5px solid var(--stroke)' }} />
                    <strong style={{ fontSize: 13.5 }}>{lang === 'th' ? c.nameTh : c.name}</strong>
                  </div>
                  <span className={`chip ${busy ? 'chip-red' : 'chip-green'}`}>
                    {busy ? t('inUse', lang) : t('vacant', lang)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card pad-5 mt-4">
        <h3 style={{ fontSize: 15 }}>{t('upcomingToday', lang)} ({upcomingToday.length})</h3>
        <div className="tbl-wrap mt-2">
          <table className="tbl">
            <thead><tr><th>Ref</th><th>{t('customer', lang)}</th><th>{t('location', lang)}</th><th>{t('dateTime', lang)}</th><th>฿</th><th>{t('status', lang)}</th></tr></thead>
            <tbody>
              {upcomingToday.map((b) => {
                const m = members.find((x) => x.id === b.userId)
                const c = courts.find((x) => x.id === b.courtId)
                return (
                  <tr key={b.id}>
                    <td className="num">{b.ref}</td>
                    <td>{m?.avatar} {m?.name}</td>
                    <td>{lang === 'th' ? c.nameTh : c.name}</td>
                    <td className="num">{hourLabel(b.hour)}</td>
                    <td className="num">{b.total}</td>
                    <td><StatusChip status={b.status} lang={lang} /></td>
                  </tr>
                )
              })}
              {upcomingToday.length === 0 && <tr><td colSpan={6} className="tc muted">—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
