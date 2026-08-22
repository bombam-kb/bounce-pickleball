import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate, DAY_NAMES } from '../i18n.js'
import { todayISO, addDays, isPeak } from '../data/index.js'
import { Icon, Modal, StatusChip, hourLabel, hourRangeLabel, CalendarModal, AvatarGlyph } from '../components/ui.jsx'
import BookForCustomerModal from './BookFor.jsx'

function isBlocked(court, date, hour) {
  return (court.blocked || []).some((b) => b.date === date && b.hour === hour)
}

function isPastSlot(date, hour) {
  const now = new Date()
  const slotTime = new Date(date + 'T00:00:00')
  slotTime.setHours(hour)
  return slotTime <= now
}

function findBooking(bookings, courtId, date, hour) {
  return bookings.find((b) =>
    b.courtId === courtId && b.date === date && b.hour === hour && b.status !== 'cancelled')
}

function shortName(name) {
  const s = String(name || '').trim()
  if (!s) return ''
  const first = s.split(/\s+/)[0]
  return first.length > 8 ? `${first.slice(0, 8)}…` : first
}

function shortCourt(c, lang) {
  const n = lang === 'th' ? c.nameTh : c.name
  return String(n || '').split(/\s*[—–-]\s*/)[0]
}

function dayFreeCount(date, courts, bookings) {
  let free = 0
  let total = 0
  for (const c of courts) {
    for (let h = c.open; h < c.close; h += 1) {
      if (isBlocked(c, date, h)) continue
      if (isPastSlot(date, h)) continue
      total += 1
      if (!findBooking(bookings, c.id, date, h)) free += 1
    }
  }
  return { free, total }
}

function startOfWeek(iso) {
  const d = new Date(iso + 'T00:00:00')
  return addDays(iso, -d.getDay())
}

export default function CourtQueue() {
  const { lang, courts, bookings, members, cancelBooking, logAdmin } = useStore()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [calOpen, setCalOpen] = useState(false)
  const [seed, setSeed] = useState(null)
  const [detail, setDetail] = useState(null)

  const activeCourts = courts.filter((c) => c.active)
  const openHour = activeCourts.length ? Math.min(...activeCourts.map((c) => c.open)) : 0
  const closeHour = activeCourts.length ? Math.max(...activeCourts.map((c) => c.close)) : 0
  const hours = Array.from({ length: Math.max(0, closeHour - openHour) }, (_, i) => openHour + i)
  const nowHour = new Date().getHours()
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i))
  const counts = {}
  for (const d of week) counts[d] = dayFreeCount(d, activeCourts, bookings)
  counts[date] = dayFreeCount(date, activeCourts, bookings)

  const cellInfo = (court, hour) => {
    if (hour < court.open || hour >= court.close || isBlocked(court, date, hour)) {
      return { kind: 'closed' }
    }
    const booking = findBooking(bookings, court.id, date, hour)
    if (booking) {
      const member = members.find((m) => m.id === booking.userId)
      return { kind: 'booked', booking, member, past: isPastSlot(date, hour) }
    }
    if (isPastSlot(date, hour)) return { kind: 'past' }
    return { kind: 'free', peak: isPeak(hour, court) }
  }

  const onCell = (court, hour, info) => {
    if (info.kind === 'free') setSeed({ courtId: court.id, date, hour })
    if (info.kind === 'booked') setDetail(info)
  }

  const cancelDetail = () => {
    const b = detail?.booking
    if (!b) return
    if (!confirm(`${t('cancelBooking', lang)} ${b.ref}?`)) return
    cancelBooking(b.id, 'admin')
    logAdmin(`Cancel ${b.ref} (from court queue)`)
    setDetail(null)
  }

  const selectedFill = counts[date] || { free: 0, total: 0 }

  return (
    <div className="card pad-5 mt-4">
      <div className="row between wrap gap-2">
        <div>
          <h3 style={{ fontSize: 15 }}>{t('courtQueue', lang)}</h3>
          <p className="tiny muted mt-1">{t('courtQueueHint', lang)}</p>
        </div>
        <div className="row gap-2 wrap" style={{ alignItems: 'center' }}>
          {selectedFill.total > 0 && selectedFill.free === selectedFill.total ? (
            <span className="chip chip-green">{t('queueAllFree', lang)}</span>
          ) : (
            <>
              <span className="chip chip-green">{t('queueFreeN', lang, { n: selectedFill.free })}</span>
              <span className="chip chip-grey">{t('queueOpenN', lang, { n: selectedFill.free })}</span>
            </>
          )}
        </div>
      </div>

      <div className="row wrap gap-2 mt-3" style={{ alignItems: 'center' }}>
        <button className={`btn btn-sm ${date === today ? 'btn-lime' : ''}`} onClick={() => setDate(today)}>
          {t('todayLabel', lang)}
        </button>
        <button className="btn btn-sm btn-ghost" aria-label={t('prevDay', lang)}
          onClick={() => setDate((d) => addDays(d, -1))}>
          <Icon name="chevL" size={16} />
        </button>
        <button className="date-trigger" style={{ width: 'auto', minWidth: 180, padding: '8px 12px' }}
          onClick={() => setCalOpen(true)}>
          <Icon name="calendar" size={18} />
          <span>
            {date === today && <span className="dt-sub">{t('todayLabel', lang)}</span>}
            {fmtDate(date, lang)}
          </span>
        </button>
        <button className="btn btn-sm btn-ghost" aria-label={t('nextDay', lang)}
          onClick={() => setDate((d) => addDays(d, 1))}>
          <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}><Icon name="chevL" size={16} /></span>
        </button>
      </div>

      <div className="queue-strip mt-3">
        {week.map((d) => {
          const fill = counts[d] || { free: 0, total: 0 }
          const packed = fill.total > 0 && fill.free === 0
          return (
            <button key={d} type="button"
              className={`queue-day ${d === date ? 'on' : ''} ${packed ? 'packed' : ''}`}
              onClick={() => setDate(d)}>
              <div className="q-dow">{DAY_NAMES[lang][new Date(d + 'T00:00:00').getDay()]}</div>
              <div className="q-num">{new Date(d + 'T00:00:00').getDate()}</div>
              <div className="q-fill">{
                fill.total === 0 ? '—'
                  : fill.free === fill.total ? t('queueAllDay', lang)
                    : String(fill.free)
              }</div>
            </button>
          )
        })}
      </div>

      {calOpen && (
        <CalendarModal value={date} onSelect={setDate} onClose={() => setCalOpen(false)} lang={lang} />
      )}

      <div className="legend mt-3">
        <span><i style={{ background: 'var(--paper)' }} />{t('slotFree', lang)}</span>
        <span><i style={{ background: 'var(--lime-soft)' }} />{t('slotBooked', lang)}</span>
        <span><i style={{ background: '#EEEEE8' }} />{t('slotPast', lang)}</span>
        <span><i style={{ background: 'transparent', borderStyle: 'dashed' }} />{t('slotClosed', lang)}</span>
      </div>

      <div className="tbl-wrap mt-3">
        <table className="avail-table queue-table">
          <thead>
            <tr>
              <th>{t('timeCol', lang)}</th>
              {activeCourts.map((c) => <th key={c.id}>{shortCourt(c, lang)}</th>)}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => {
              const isNow = date === today && hour === nowHour
              return (
                <tr key={hour} className={isNow ? 'queue-now' : ''}>
                  <td className={`avail-time${isNow ? ' now' : ''}`}>
                    {hourLabel(hour)}
                    {isNow && <div className="tiny" style={{ fontWeight: 700 }}>{t('nowSlot', lang)}</div>}
                  </td>
                  {activeCourts.map((c) => {
                    const info = cellInfo(c, hour)
                    const label = info.kind === 'booked'
                      ? (shortName(info.member?.name) || t('slotBooked', lang))
                      : info.kind === 'free' ? t('slotFree', lang)
                        : info.kind === 'past' ? t('slotPast', lang)
                          : t('slotClosed', lang)
                    const clickable = info.kind === 'free' || info.kind === 'booked'
                    return (
                      <td key={c.id}>
                        <button type="button"
                          className={`queue-cell ${info.kind}${info.peak ? ' peak' : ''}`}
                          disabled={!clickable}
                          onClick={() => onCell(c, hour, info)}>
                          {info.kind === 'booked' ? (
                            <span className="q-name">{label}</span>
                          ) : label}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {seed && (
        <BookForCustomerModal seed={seed} onClose={() => setSeed(null)} />
      )}

      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <h3 style={{ fontSize: 17 }}>{t('slotBooked', lang)}</h3>
          <div className="card-flat pad-4 mt-3 col gap-2">
            <div className="row between">
              <span className="tiny muted">{t('customer', lang)}</span>
              <b className="row gap-1" style={{ alignItems: 'center' }}>
                <AvatarGlyph avatar={detail.member?.avatar} size={16} />
                {detail.member?.name || '—'}
              </b>
            </div>
            <div className="row between">
              <span className="tiny muted">{t('location', lang)}</span>
              <b>{lang === 'th'
                ? (activeCourts.find((c) => c.id === detail.booking.courtId)?.nameTh || '—')
                : (activeCourts.find((c) => c.id === detail.booking.courtId)?.name || '—')}</b>
            </div>
            <div className="row between">
              <span className="tiny muted">{t('dateTime', lang)}</span>
              <b>{fmtDate(detail.booking.date, lang)} · {hourRangeLabel(detail.booking.hour, detail.booking.duration)}</b>
            </div>
            <div className="row between">
              <span className="tiny muted">Ref</span>
              <b className="num">{detail.booking.ref}</b>
            </div>
            <div className="row between">
              <span className="tiny muted">{t('status', lang)}</span>
              <StatusChip status={detail.booking.status} lang={lang} />
            </div>
          </div>
          <div className="row gap-2 mt-4">
            {detail.booking.status === 'upcoming' && !detail.past && (
              <button className="btn btn-danger flex-1" onClick={cancelDetail}>
                <Icon name="x" size={14} /> {t('cancelBooking', lang)}
              </button>
            )}
            <button className="btn flex-1" onClick={() => setDetail(null)}>{t('close', lang)}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
