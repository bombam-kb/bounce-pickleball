import React, { useState, useEffect } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { isPeak, todayISO } from '../data/index.js'
import { Icon, Modal, hourLabel } from '../components/ui.jsx'

// step: summary → qr (if promptpay) → success
export default function Booking({ sel, onDone, onBack }) {
  const { lang, courts, user, vouchers, settings, validatePromo, createBooking } = useStore()
  const court = courts.find((c) => c.id === sel.courtId)
  const [duration, setDuration] = useState(settings.slotDuration)
  const [promoInput, setPromoInput] = useState('')
  const [promo, setPromo] = useState(null)
  const [promoErr, setPromoErr] = useState(false)
  const [voucherId, setVoucherId] = useState(null)
  const [payMethod, setPayMethod] = useState('promptpay')
  const [step, setStep] = useState('summary')
  const [result, setResult] = useState(null)

  const peak = isPeak(sel.date, sel.hour)
  const base = (peak ? court.pricePeak : court.priceOff) * (duration / 60)
  const myVouchers = vouchers.filter((v) => v.userId === user?.id && !v.used && v.expiry >= todayISO())
  const voucherBlocked = peak // off-peak only per SRS

  let discount = 0
  if (voucherId) discount = base
  else if (promo) discount = promo.type === 'fixed' ? Math.min(promo.value, base) : Math.round(base * promo.value / 100)
  const total = base - discount

  const applyPromo = () => {
    const p = validatePromo(promoInput)
    setPromo(p)
    setPromoErr(!p)
    if (p) setVoucherId(null)
  }

  const doPay = () => {
    if (total > 0 && payMethod === 'promptpay') { setStep('qr'); return }
    finish()
  }
  const finish = () => {
    const r = createBooking({ courtId: court.id, date: sel.date, hour: sel.hour, duration, promo: voucherId ? null : promo, voucherId, payMethod })
    setResult(r)
    setStep('success')
  }

  // QR: auto-confirm after 3s to simulate bank callback
  useEffect(() => {
    if (step !== 'qr') return
    const id = setTimeout(finish, 3000)
    return () => clearTimeout(id)
  }, [step])

  if (step === 'success' && result) {
    return (
      <div className="page tc" style={{ paddingTop: 48 }}>
        <div className="success-ball">🏓</div>
        <h2 className="mt-4" style={{ fontSize: 24 }}>{t('bookingSuccess', lang)}</h2>
        <p className="muted mt-2">{t('bookingRef', lang)}</p>
        <div className="num" style={{ fontSize: 26, letterSpacing: 1 }}>{result.booking.ref}</div>
        <div className="card pad-4 mt-4" style={{ textAlign: 'left' }}>
          <Row k={t('location', lang)} v={lang === 'th' ? court.nameTh : court.name} />
          <Row k={t('dateTime', lang)} v={`${fmtDate(sel.date, lang)} · ${hourLabel(sel.hour)}`} />
          <Row k={t('duration', lang)} v={`${duration} ${t('min', lang)}`} />
          <Row k={t('amountPayable', lang)} v={total === 0 ? t('free', lang) : `฿${total}`} bold />
        </div>
        {!result.booking.voucherUsed && (
          <div className="chip chip-lime mt-4" style={{ fontSize: 14, padding: '6px 16px' }}>
            +1 🏓 {t('stampEarned', lang)}{result.voucherEarned ? ' → 🎁 Free Voucher!' : ''}
          </div>
        )}
        <button className="btn btn-pine btn-full btn-lg mt-6" onClick={onDone}>{t('backHome', lang)}</button>
      </div>
    )
  }

  return (
    <div className="page">
      <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="chevL" size={16} /> {t('back', lang)}</button>
      <h2 className="mt-3" style={{ fontSize: 21 }}>{t('bookingSummary', lang)}</h2>

      <div className="card mt-3" style={{ overflow: 'hidden' }}>
        <div className="court-photo" style={{ background: court.photo, height: 70 }}>
          <h3>{lang === 'th' ? court.nameTh : court.name}</h3>
        </div>
        <div className="pad-4">
          <Row k={t('dateTime', lang)} v={`${fmtDate(sel.date, lang)} · ${hourLabel(sel.hour)}`} />
          <div className="row between mt-2">
            <span className="muted" style={{ fontSize: 13.5 }}>{t('duration', lang)}</span>
            <div className="row gap-2">
              {[60, 90].map((d) => (
                <button key={d} className={`btn btn-sm ${duration === d ? 'btn-pine' : ''}`} onClick={() => setDuration(d)}>
                  {d} {t('min', lang)}
                </button>
              ))}
            </div>
          </div>
          <Row k={`${t('price', lang)} (${peak ? t('peak', lang) : t('offPeak', lang)})`} v={`฿${base}`} />
        </div>
      </div>

      {/* promo + voucher */}
      <div className="card-flat pad-4 mt-3">
        <label className="label"><Icon name="tag" size={14} /> {t('promoCode', lang)} ({t('optional', lang)})</label>
        <div className="row gap-2">
          <input className="input flex-1" maxLength={24} placeholder={t('promoPlaceholder', lang)} value={promoInput}
            onChange={(e) => { setPromoInput(e.target.value); setPromoErr(false) }} disabled={!!voucherId} />
          <button className="btn btn-lime" onClick={applyPromo} disabled={!promoInput || !!voucherId}>{t('apply', lang)}</button>
        </div>
        {promo && <div className="chip chip-green mt-2">✓ {promo.code} — {t('promoApplied', lang)}</div>}
        {promoErr && <div className="chip chip-red mt-2">✕ {t('promoInvalid', lang)}</div>}

        {myVouchers.length > 0 && (
          <div className="mt-3">
            <label className="label">🎁 {t('useVoucher', lang)}</label>
            {voucherBlocked
              ? <div className="tiny">{t('voucherOffPeakOnly', lang)}</div>
              : (
                <button className={`btn btn-sm ${voucherId ? 'btn-pine' : ''}`}
                  onClick={() => { setVoucherId(voucherId ? null : myVouchers[0].id); setPromo(null); setPromoInput('') }}>
                  {voucherId ? '✓ ' : ''}{t('voucherFreeBooking', lang)} · {t('expires', lang)} {fmtDate(myVouchers[0].expiry, lang)}
                </button>
              )}
            {voucherId && <div className="chip chip-green mt-2">✓ {t('voucherApplied', lang)}</div>}
          </div>
        )}
      </div>

      {/* totals */}
      <div className="card-pine pad-4 mt-3">
        {discount > 0 && (
          <div className="row between" style={{ opacity: 0.85, fontSize: 14 }}>
            <span>{t('discount', lang)}</span><span>−฿{discount}</span>
          </div>
        )}
        <div className="row between">
          <span style={{ fontWeight: 600 }}>{t('amountPayable', lang)}</span>
          <span className="num" style={{ fontSize: 28, color: 'var(--lime)' }}>{total === 0 ? t('free', lang) : `฿${total}`}</span>
        </div>
      </div>

      {/* payment method */}
      {total > 0 && (
        <div className="mt-3">
          <label className="label">{t('payMethod', lang)}</label>
          <div className="col gap-2">
            <PayOpt icon="qr" label={t('payPromptPay', lang)} on={payMethod === 'promptpay'} onClick={() => setPayMethod('promptpay')} />
            <PayOpt icon="card" label={t('payCard', lang)} on={payMethod === 'card'} onClick={() => setPayMethod('card')} />
            <PayOpt icon="coin" label={`${t('payCredits', lang)}: ฿${user?.credits ?? 0}`} on={payMethod === 'credits'}
              onClick={() => setPayMethod('credits')} disabled={(user?.credits ?? 0) < total} />
          </div>
        </div>
      )}

      <button className="btn btn-lime btn-full btn-lg mt-4" onClick={doPay}>
        {total === 0 ? t('confirmBooking', lang) : `${t('payNow', lang)} · ฿${total}`}
      </button>

      {step === 'qr' && (
        <Modal onClose={() => setStep('summary')}>
          <h3 className="tc" style={{ fontSize: 18 }}>{t('payPromptPay', lang)}</h3>
          <p className="tc tiny mt-2">{t('scanToPay', lang)}</p>
          <div className="qr-box mt-4" />
          <div className="tc num mt-3" style={{ fontSize: 24 }}>฿{total}</div>
          <p className="tc tiny mt-2" style={{ animation: 'fadeIn 1s infinite alternate' }}>⏳ {t('waitingPayment', lang)}</p>
        </Modal>
      )}
    </div>
  )
}

const Row = ({ k, v, bold }) => (
  <div className="row between mt-2" style={{ fontSize: bold ? 15 : 13.5 }}>
    <span className="muted">{k}</span>
    <span style={{ fontWeight: bold ? 800 : 600 }}>{v}</span>
  </div>
)

const PayOpt = ({ icon, label, on, onClick, disabled }) => (
  <button className="card-flat pad-3 row gap-3" onClick={onClick} disabled={disabled}
    style={{
      background: on ? 'var(--lime-soft)' : 'var(--paper)', width: '100%',
      boxShadow: on ? 'var(--shadow-pop-sm)' : 'none', opacity: disabled ? 0.45 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left', fontSize: 14.5, fontWeight: 600,
    }}>
    <Icon name={icon} />
    <span className="flex-1">{label}</span>
    <span style={{
      width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--stroke)',
      background: on ? 'var(--pine)' : 'transparent', flexShrink: 0,
    }} />
  </button>
)
