import React, { useState, useEffect } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { isPeak, todayISO } from '../data/index.js'
import { Icon, Modal, hourLabel, printSlip } from '../components/ui.jsx'

// step: summary → qr (if promptpay) → success
export default function Booking({ cart, onDone, onBack }) {
  const { lang, courts, user, vouchers, validatePromo, createMultiBooking } = useStore()
  const { date, items } = cart

  const [promoInput, setPromoInput] = useState('')
  const [promo, setPromo] = useState(null)
  const [promoErr, setPromoErr] = useState(false)
  const [voucherId, setVoucherId] = useState(null)
  const [payMethod, setPayMethod] = useState('promptpay')
  const [step, setStep] = useState('summary')
  const [result, setResult] = useState(null)

  const priced = items.map((it) => {
    const court = courts.find((c) => c.id === it.courtId)
    const peak = isPeak(date, it.hour)
    return { ...it, court, peak, price: peak ? court.pricePeak : court.priceOff }
  })
  const subtotal = priced.reduce((s, x) => s + x.price, 0)
  const singleItem = items.length === 1
  const myVouchers = vouchers.filter((v) => v.userId === user?.id && !v.used && v.expiry >= todayISO())
  const voucherBlocked = !singleItem || priced[0].peak // off-peak only, and only for a single-item cart

  let discount = 0
  if (voucherId) discount = subtotal
  else if (promo) discount = promo.type === 'fixed' ? Math.min(promo.value, subtotal) : Math.round(subtotal * promo.value / 100)
  const total = subtotal - discount

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
  const finish = async () => {
    try {
      const r = await createMultiBooking(items.map((it) => ({ courtId: it.courtId, date, hour: it.hour })),
        { promo: voucherId ? null : promo, voucherId, payMethod })
      setResult(r)
      setStep('success')
    } catch (e) {
      console.error('[Bounce] booking failed', e)
      alert(lang === 'th' ? 'จองไม่สำเร็จ ลองใหม่อีกครั้ง' : 'Booking failed — please try again')
      setStep('summary')
    }
  }

  // QR: auto-confirm after 3s to simulate bank callback
  useEffect(() => {
    if (step !== 'qr') return
    const id = setTimeout(finish, 3000)
    return () => clearTimeout(id)
  }, [step])

  if (step === 'success' && result) {
    const grandTotal = result.bookings.reduce((s, b) => s + b.total, 0)
    return (
      <div className="page tc" style={{ paddingTop: 48 }}>
        <div className="success-ball">🏓</div>
        <h2 className="mt-4" style={{ fontSize: 24 }}>{t('bookingSuccess', lang)}</h2>
        {result.bookings.length === 1 ? (
          <>
            <p className="muted mt-2">{t('bookingRef', lang)}</p>
            <div className="num" style={{ fontSize: 26, letterSpacing: 1 }}>{result.bookings[0].ref}</div>
          </>
        ) : (
          <p className="muted mt-2">{result.bookings.length} {lang === 'th' ? 'รายการ' : 'bookings'}</p>
        )}
        <div className="card pad-4 mt-4" style={{ textAlign: 'left' }}>
          {result.bookings.map((b, i) => {
            const c = courts.find((x) => x.id === b.courtId)
            return (
              <div key={b.id} className="row between" style={{ padding: '8px 0', borderBottom: i < result.bookings.length - 1 ? '1px dashed #E3E1D5' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{lang === 'th' ? c.nameTh : c.name}</div>
                  <div className="tiny">{fmtDate(b.date, lang)} · {hourLabel(b.hour)} {result.bookings.length > 1 && <span className="num">· {b.ref}</span>}</div>
                </div>
                <div className="row gap-2" style={{ alignItems: 'center' }}>
                  <b className="num">{b.total === 0 ? t('free', lang) : `฿${b.total}`}</b>
                  <button className="btn btn-sm btn-ghost" onClick={() => printSlip(b, c, user, lang)} aria-label="download">
                    <Icon name="download" size={13} />
                  </button>
                </div>
              </div>
            )
          })}
          {result.bookings.length > 1 && (
            <div className="row between mt-2" style={{ paddingTop: 8, borderTop: '2px solid var(--stroke)' }}>
              <b>{t('amountPayable', lang)}</b>
              <b className="num">{grandTotal === 0 ? t('free', lang) : `฿${grandTotal}`}</b>
            </div>
          )}
        </div>
        <div className="chip chip-lime mt-4" style={{ fontSize: 14, padding: '6px 16px' }}>
          +{result.bookings.filter((b) => !b.voucherUsed).length} 🏓 {t('stampEarned', lang)}{result.voucherEarned ? ' → 🎁 Free Voucher!' : ''}
        </div>
        <button className="btn btn-pine btn-full btn-lg mt-6" onClick={onDone}>{t('backHome', lang)}</button>
      </div>
    )
  }

  return (
    <div className="page">
      <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="chevL" size={16} /> {t('back', lang)}</button>
      <h2 className="mt-3" style={{ fontSize: 21 }}>{t('bookingSummary', lang)}</h2>

      <div className="card-flat pad-4 mt-3">
        {priced.map((it, i) => (
          <div key={`${it.courtId}-${it.hour}`} className="row between" style={{ padding: '7px 0', borderBottom: i < priced.length - 1 ? '1px solid #E3E1D5' : 'none' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{lang === 'th' ? it.court.nameTh : it.court.name}</div>
              <div className="tiny">{fmtDate(date, lang)} · {hourLabel(it.hour)} · {it.peak ? t('peak', lang) : t('offPeak', lang)}</div>
            </div>
            <b className="num">฿{it.price}</b>
          </div>
        ))}
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
              ? <div className="tiny">{!singleItem ? t('voucherSingleOnly', lang) : t('voucherOffPeakOnly', lang)}</div>
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
        <div className="row between" style={{ opacity: 0.85, fontSize: 14 }}>
          <span>{t('itemsSelected', lang, { n: items.length })}</span><span>฿{subtotal}</span>
        </div>
        {discount > 0 && (
          <div className="row between" style={{ opacity: 0.85, fontSize: 14 }}>
            <span>{t('discount', lang)}</span><span>−฿{discount}</span>
          </div>
        )}
        <div className="row between mt-1">
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
