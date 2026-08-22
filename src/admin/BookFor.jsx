import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { todayISO, isPeak, sortSlotItems } from '../data/index.js'
import { Icon, Modal, hourLabel, AvatarGlyph } from '../components/ui.jsx'

// "จองให้ลูกค้า" — admin books one or more slots for a phone/walk-in customer
export default function BookForCustomerModal({ onClose, seed }) {
  const { lang, members, courts, slotStatus, adminCreateMultiBooking } = useStore()
  const th = lang === 'th'
  const [q, setQ] = useState('')
  const [customer, setCustomer] = useState(null)
  const [guestMode, setGuestMode] = useState(false)
  const [guest, setGuest] = useState({ name: '', phone: '' })
  const [courtId, setCourtId] = useState(seed?.courtId || (courts.find((c) => c.active)?.id ?? ''))
  const [date, setDate] = useState(seed?.date || todayISO())
  const [picks, setPicks] = useState(() => (
    seed?.courtId && seed?.date && seed?.hour != null
      ? [{ courtId: seed.courtId, date: seed.date, hour: seed.hour }]
      : []
  ))
  const [success, setSuccess] = useState(null)
  const [busy, setBusy] = useState(false)

  const court = courts.find((c) => c.id === courtId)
  const matches = q.trim()
    ? members.filter((m) => !m.suspended &&
        (m.name + m.email + m.phone).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : []

  const priceOf = (p) => {
    const c = courts.find((x) => x.id === p.courtId)
    return isPeak(p.hour, c) ? c.pricePeak : c.priceOff
  }
  const total = picks.reduce((s, p) => s + priceOf(p), 0)
  const isPicked = (h) => picks.some((p) => p.courtId === courtId && p.date === date && p.hour === h)
  const togglePick = (h) => setPicks((ps) => isPicked(h)
    ? ps.filter((p) => !(p.courtId === courtId && p.date === date && p.hour === h))
    : sortSlotItems([...ps, { courtId, date, hour: h }], courts.map((c) => c.id)))
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
      alert(e?.message === 'slot_taken'
        ? t('slotTaken', lang)
        : (th ? 'จองไม่สำเร็จ ลองใหม่อีกครั้ง' : 'Booking failed — please try again'))
    }
    setBusy(false)
  }

  if (success) {
    const grand = success.reduce((s, b) => s + b.total, 0)
    return (
      <Modal onClose={onClose}>
        <div className="tc" style={{ paddingTop: 8 }}>
          <img src="/ball.png" className="success-ball" alt="" style={{ width: 60, height: 60 }} />
          <h3 className="mt-3" style={{ fontSize: 17 }}>{t('bookForSuccess', lang)}</h3>
          <div className="num mt-1" style={{ fontSize: 20 }}>{success[0].ref}</div>
          <p className="muted mt-1">{success.length} {th ? 'ช่องเวลา' : 'slot(s)'}</p>
          <div className="card-flat pad-4 mt-3" style={{ textAlign: 'left' }}>
            <div className="row between"><span className="muted tiny">{t('customer', lang)}</span><b className="row gap-1" style={{ alignItems: 'center' }}>{guestMode ? <><Icon name="ball" size={14} /> {guest.name} (Guest)</> : <><AvatarGlyph avatar={customer.avatar} size={16} /> {customer.name}</>}</b></div>
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
          <span className="row gap-1" style={{ alignItems: 'center' }}><AvatarGlyph avatar={customer.avatar} size={16} /> <b>{customer.name}</b> <span className="tiny muted">· {customer.email}</span></span>
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
                  <span className="row gap-1" style={{ alignItems: 'center' }}><AvatarGlyph avatar={m.avatar} size={16} /> <b>{m.name}</b></span>
                  <span className="tiny muted">{m.email || m.phone}</span>
                </button>
              ))}
              {matches.length === 0 && <div className="tc tiny muted pad-4">{t('noCustomerFound', lang)}</div>}
            </div>
          )}
        </>
      )}

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

      <label className="label mt-4">{t('pickSlot', lang)} <span className="tiny muted">({th ? 'เลือกได้หลายช่อง' : 'select multiple'})</span></label>
      {!court ? (
        <p className="tiny muted">{t('pickSlotFirst', lang)}</p>
      ) : (
        <div className="slot-grid">
          {Array.from({ length: court.close - court.open }, (_, i) => {
            const h = court.open + i
            const st = slotStatus(court, date, h)
            const peak = isPeak(h, court)
            const picked = isPicked(h)
            return (
              <button key={h} type="button"
                className={`slot ${st} ${peak ? 'peak' : ''} ${picked ? 'selected' : ''}`}
                disabled={st !== 'free' && !picked} onClick={() => togglePick(h)}>
                {hourLabel(h)}
                <small>{st === 'free' || picked ? `฿${peak ? court.pricePeak : court.priceOff}` : t('slot' + st[0].toUpperCase() + st.slice(1), lang)}</small>
              </button>
            )
          })}
        </div>
      )}

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
