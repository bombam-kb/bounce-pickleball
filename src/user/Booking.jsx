import React, { useState, useEffect } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { isPeak, sortSlotItems } from '../data/index.js'
import { Icon, Modal, hourRangeLabel, printSlip } from '../components/ui.jsx'
import Logo from '../components/Logo.jsx'

// step: summary → qr (if promptpay) → success
export default function Booking({ cart, onDone, onBack }) {
  const { lang, courts, user, vouchers, createMultiBooking } = useStore()
  const { date, items: rawItems } = cart
  const items = sortSlotItems(rawItems, courts.map((c) => c.id))

  const [voucherId, setVoucherId] = useState(null)
  const [step, setStep] = useState('summary')
  const [result, setResult] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  const priced = items.map((it) => {
    const court = courts.find((c) => c.id === it.courtId)
    const peak = isPeak(it.hour, court)
    return { ...it, court, peak, price: peak ? (court?.pricePeak ?? 0) : (court?.priceOff ?? 0) }
  })
  const subtotal = priced.reduce((s, x) => s + x.price, 0)
  const myVouchers = vouchers.filter((v) => v.userId === user?.id && !v.used)
  const cheapestIdx = priced.reduce((best, it, i) => it.price < priced[best].price ? i : best, 0)
  const discount = voucherId ? (priced[cheapestIdx]?.price ?? 0) : 0
  const total = subtotal - discount

  const toggleVoucher = (id) => {
    setVoucherId((cur) => (cur === id ? null : id))
  }

  const doPay = () => {
    if (total > 0) { setStep('qr'); return }
    finish()
  }
  const finish = async () => {
    try {
      const r = await createMultiBooking(items.map((it) => ({ courtId: it.courtId, date, hour: it.hour })),
        { voucherId, payMethod: 'promptpay' })
      setResult(r)
      setStep('success')
    } catch (e) {
      console.error('[Bounce] booking failed', e)
      alert(e?.message === 'slot_taken'
        ? t('slotTaken', lang)
        : (lang === 'th' ? 'จองไม่สำเร็จ ลองใหม่อีกครั้ง' : 'Booking failed — please try again'))
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
    const stampsGot = result.bookings.filter((b) => !b.voucherUsed).length
    return (
      <div className="page tc" style={{ paddingTop: 48 }}>
        <img src="/ball.png" className="success-ball" alt="" />
        <h2 className="mt-4" style={{ fontSize: 24 }}>{t('bookingSuccess', lang)}</h2>
        <p className="muted mt-2">{t('bookingRef', lang)}</p>
        <div className="num" style={{ fontSize: 26, letterSpacing: 1 }}>{result.bookings[0].ref}</div>
        {result.bookings.length > 1 && (
          <p className="muted mt-1">{result.bookings.length} {lang === 'th' ? 'ช่องเวลา' : 'slots'}</p>
        )}
        <div className="card pad-4 mt-4" style={{ textAlign: 'left' }}>
          {result.bookings.map((b, i) => {
            const c = courts.find((x) => x.id === b.courtId)
            return (
              <div key={b.id} className="row between" style={{ padding: '8px 0', borderBottom: i < result.bookings.length - 1 ? '1px dashed #E3E1D5' : 'none' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{lang === 'th' ? (c?.nameTh || '—') : (c?.name || '—')}</div>
                  <div className="tiny">{fmtDate(b.date, lang)} · {hourRangeLabel(b.hour, b.duration)}</div>
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
        {(stampsGot > 0 || result.voucherEarned) && (
          <div className="card-flat pad-3 mt-4" style={{ background: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
            <Icon name="ball" size={18} />
            {stampsGot > 0 && `+${stampsGot} ${t('stampEarned', lang, { n: stampsGot, s: stampsGot === 1 ? '' : 's' })}`}
            {result.voucherEarned ? (lang === 'th' ? ' → ได้โค้ดฟรี 1 ชม.!' : ' → Free hour code!') : ''}
          </div>
        )}
        <button className="btn btn-pine btn-full btn-lg mt-6" onClick={onDone}>{t('backHome', lang)}</button>
      </div>
    )
  }

  return (
    <div className="page">
      <h2 style={{ fontSize: 21 }}>{t('bookingSummary', lang)}</h2>

      <div className="card-flat pad-4 mt-3">
        {priced.map((it, i) => (
          <div key={`${it.courtId}-${it.hour}`} className="row between" style={{ padding: '7px 0', borderBottom: i < priced.length - 1 ? '1px solid #E3E1D5' : 'none' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{lang === 'th' ? (it.court?.nameTh || '—') : (it.court?.name || '—')}</div>
              <div className="tiny">{fmtDate(date, lang)} · {hourRangeLabel(it.hour)} · {it.peak ? t('peak', lang) : t('offPeak', lang)}</div>
            </div>
            {voucherId && i === cheapestIdx ? (
              <span className="num" style={{ textAlign: 'right' }}>
                <span style={{ textDecoration: 'line-through', opacity: 0.45, fontSize: 12 }}>฿{it.price}</span>
                {' '}<b>{t('free', lang)}</b>
              </span>
            ) : (
              <b className="num">฿{it.price}</b>
            )}
          </div>
        ))}
      </div>

      {/* stamp codes — tap to apply, no typing */}
      <div className="card-flat pad-4 mt-3">
        <label className="label"><Icon name="tag" size={14} /> {t('usableCodes', lang)}</label>
        {myVouchers.length === 0 && (
          <div className="tiny mt-1">{t('noUsableCodes', lang)}</div>
        )}
        <div className="col gap-2 mt-2">
          {myVouchers.map((v) => {
            const on = voucherId === v.id
            return (
              <div key={v.id} className="card-flat pad-3 row gap-2" style={{ alignItems: 'center' }}>
                <div className="flex-1">
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{t('codeHourOff', lang)}</div>
                  <div className="tiny">{t('codeNoExpiry', lang)}</div>
                </div>
                <button className={`btn btn-sm ${on ? 'btn-pine' : 'btn-lime'}`}
                  onClick={() => toggleVoucher(v.id)}>
                  {on ? `✓ ${t('promoApplied', lang)}` : t('tapUseCode', lang)}
                </button>
              </div>
            )
          })}
        </div>
        {voucherId && <div className="chip chip-green mt-2">✓ {t('voucherApplied', lang)}</div>}
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

      {total > 0 && (
        <div className="mt-3">
          <label className="label">{t('payMethod', lang)}</label>
          <div className="card-flat pad-3 row gap-3" style={{ background: 'var(--lime-soft)', boxShadow: 'var(--shadow-pop-sm)' }}>
            <Icon name="qr" />
            <span className="flex-1" style={{ fontSize: 14.5, fontWeight: 600 }}>{t('payPromptPay', lang)}</span>
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
          <div className="tc mt-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Logo variant="light" size="md" animate />
            <p className="tiny mt-3">{t('waitingPayment', lang)}</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
