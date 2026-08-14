import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { todayISO, addDays, isPeak } from '../data/index.js'
import { Icon, CalendarModal } from '../components/ui.jsx'

export default function Home({ onCheckout, cartHost }) {
  const { lang, courts, slotStatus, settings } = useStore()
  const [date, setDate] = useState(todayISO())
  const [calOpen, setCalOpen] = useState(false)
  const [selected, setSelected] = useState([]) // [{ courtId, hour }]
  const today = todayISO()
  const maxDate = addDays(today, settings.advanceBookingDays - 1)

  // switching date starts a fresh selection for that day
  useEffect(() => { setSelected([]) }, [date])

  const activeCourts = courts.filter((c) => c.active)
  const openHour = activeCourts.length ? Math.min(...activeCourts.map((c) => c.open)) : 0
  const closeHour = activeCourts.length ? Math.max(...activeCourts.map((c) => c.close)) : 0
  const hours = Array.from({ length: Math.max(0, closeHour - openHour) }, (_, i) => openHour + i)

  const isSelected = (courtId, hour) => selected.some((s) => s.courtId === courtId && s.hour === hour)
  const toggleSlot = (court, hour) => {
    if (isSelected(court.id, hour)) {
      setSelected((sel) => sel.filter((s) => !(s.courtId === court.id && s.hour === hour)))
      return
    }
    if (slotStatus(court, date, hour) !== 'free') return
    setSelected((sel) => [...sel, { courtId: court.id, hour }])
  }

  const priceOf = (courtId, hour) => {
    const c = activeCourts.find((x) => x.id === courtId)
    return isPeak(hour, c) ? c.pricePeak : c.priceOff
  }
  const total = selected.reduce((s, x) => s + priceOf(x.courtId, x.hour), 0)

  const checkout = () => onCheckout({ date, items: selected })

  const cartBar = selected.length > 0 && (
    <div className="cart-bar">
      <div className="row between" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div className="tiny" style={{ opacity: 0.85 }}>{t('itemsSelected', lang, { n: selected.length })}</div>
          <div className="num" style={{ fontSize: 20, color: 'var(--lime)' }}>฿{total}</div>
        </div>
        <div className="row gap-2">
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--cream)' }} onClick={() => setSelected([])}>
            {t('clearSelection', lang)}
          </button>
          <button className="btn btn-lime" onClick={checkout}>{t('confirmBooking', lang)}</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="page">
      <h3 style={{ fontSize: 16 }}>{t('pickDate', lang)}</h3>
      <button className="date-trigger mt-2" onClick={() => setCalOpen(true)}>
        <Icon name="calendar" size={20} />
        <span className="flex-1">
          {date === today && <span className="dt-sub">{t('todayLabel', lang)}</span>}
          {fmtDate(date, lang)}
        </span>
        <span style={{ display: 'inline-block', transform: 'rotate(-90deg)' }}>
          <Icon name="chevL" size={16} stroke={2.2} />
        </span>
      </button>

      {calOpen && (
        <CalendarModal value={date} onSelect={setDate} onClose={() => setCalOpen(false)}
          minDate={today} maxDate={maxDate} advanceDays={settings.advanceBookingDays} lang={lang} />
      )}

      <div className="row between mt-4">
        <h3 style={{ fontSize: 16 }}>{t('pickSlot', lang)} · {fmtDate(date, lang)}</h3>
      </div>
      <p className="tiny muted mt-1">{t('selectHint', lang)}</p>
      <div className="legend mt-2">
        <span><i style={{ background: 'var(--paper)' }} />{t('slotFree', lang)}</span>
        <span><i style={{ background: 'var(--lime-soft)' }} />{t('peak', lang)}</span>
        <span><i style={{ background: 'var(--pine)' }} />{t('yourBooking', lang)}</span>
        <span><i style={{ background: '#EEEEE8' }} />{t('slotBooked', lang)}</span>
      </div>

      <div className="card mt-3">
        <div className="tbl-wrap">
          <table className="avail-table">
            <thead>
              <tr>
                <th>{t('timeCol', lang)}</th>
                {activeCourts.map((c) => <th key={c.id}>{lang === 'th' ? c.nameTh : c.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {hours.map((hour) => (
                <tr key={hour}>
                  <td className="avail-time">{String(hour).padStart(2, '0')}:00 - {String(hour + 1).padStart(2, '0')}:00</td>
                  {activeCourts.map((c) => {
                    const st = slotStatus(c, date, hour)
                    const peak = isPeak(hour, c)
                    const sel = isSelected(c.id, hour)
                    return (
                      <td key={c.id}>
                        <button type="button"
                          className={`avail-cell ${st} ${peak ? 'peak' : ''} ${sel ? 'selected' : ''}`}
                          disabled={st !== 'free' && !sel}
                          onClick={() => toggleSlot(c, hour)}>
                          {sel ? `✓ ฿${priceOf(c.id, hour)}` : st === 'free' ? t('slotFree', lang) : t('slot' + st[0].toUpperCase() + st.slice(1), lang)}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cartBar && cartHost && createPortal(cartBar, cartHost)}
      {selected.length > 0 && <div className="cart-bar-spacer" />}
    </div>
  )
}
