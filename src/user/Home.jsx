import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate, DAY_NAMES, MONTH_NAMES } from '../i18n.js'
import { todayISO, addDays, isPeak } from '../data/index.js'
import { hourLabel } from '../components/ui.jsx'

export default function Home({ onSelectSlot }) {
  const { lang, courts, slotStatus, user } = useStore()
  const [date, setDate] = useState(todayISO())
  const days = Array.from({ length: 7 }, (_, i) => addDays(todayISO(), i))

  return (
    <div className="page">
      <div className="hero">
        <h1>{user ? (lang === 'th' ? `สวัสดี ${user.name.split(' ')[0]}! 🏓` : `Hi ${user.name.split(' ')[0]}! 🏓`) : t('appName', lang)}</h1>
        <p>{t('tagline', lang)}</p>
      </div>

      <h3 className="mt-6" style={{ fontSize: 16 }}>{t('pickDate', lang)}</h3>
      <div className="date-scroll mt-2">
        {days.map((d) => {
          const dd = new Date(d + 'T00:00:00')
          return (
            <button key={d} className={`date-pill ${d === date ? 'on' : ''}`} onClick={() => setDate(d)}>
              <div className="dow">{DAY_NAMES[lang][dd.getDay()]}</div>
              <div className="dnum">{dd.getDate()}</div>
              <div className="dmon">{MONTH_NAMES[lang][dd.getMonth()]}</div>
            </button>
          )
        })}
      </div>

      <div className="row between mt-3">
        <h3 style={{ fontSize: 16 }}>{t('pickCourt', lang)} · {fmtDate(date, lang)}</h3>
      </div>
      <div className="legend mt-2">
        <span><i style={{ background: 'var(--paper)' }} />{t('slotFree', lang)}</span>
        <span><i style={{ background: 'var(--lime-soft)' }} />{t('peak', lang)}</span>
        <span><i style={{ background: '#EEEEE8' }} />{t('slotBooked', lang)}</span>
        <span><i style={{ background: 'transparent', borderStyle: 'dashed' }} />{t('slotClosed', lang)}</span>
      </div>

      <div className="mt-3">
        {courts.filter((c) => c.active).map((court) => (
          <div key={court.id} className="court-card">
            <div className="court-photo" style={{ background: court.photo }}>
              <h3>{lang === 'th' ? court.nameTh : court.name}</h3>
            </div>
            <div className="pad-4">
              <div className="row between wrap gap-2">
                <span className="tiny">{lang === 'th' ? court.descTh : court.desc}</span>
              </div>
              <div className="row gap-2 mt-2 wrap">
                <span className="chip chip-lime">฿{court.priceOff}–{court.pricePeak}{t('perHour', lang)}</span>
                <span className="chip chip-grey">{t('maxPlayers', lang)} {court.maxPlayers}</span>
                {court.openCourt && <span className="chip chip-blue">Open Court</span>}
              </div>
              <div className="slot-grid mt-3">
                {Array.from({ length: court.close - court.open }, (_, i) => {
                  const hour = court.open + i
                  const st = slotStatus(court, date, hour)
                  const peak = isPeak(date, hour)
                  return (
                    <button key={hour}
                      className={`slot ${st} ${peak ? 'peak' : ''}`}
                      disabled={st !== 'free'}
                      onClick={() => onSelectSlot({ courtId: court.id, date, hour })}>
                      {hourLabel(hour)}
                      <small>
                        {st === 'free' ? `฿${peak ? court.pricePeak : court.priceOff}` : t('slot' + st[0].toUpperCase() + st.slice(1), lang)}
                      </small>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
