import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate, DICT } from '../i18n.js'
import { isPeak, sortSlotItems } from '../data/index.js'
import { Icon, Modal, hourRangeLabel, printSlip } from '../components/ui.jsx'

const SLIP_MAX_EDGE = 1600
const SLIP_JPEG_Q = 0.82

function promptPayQrSrc(id, amount) {
  const digits = String(id || '').replace(/\D/g, '')
  if (!digits) return ''
  return `https://promptpay.io/${digits}/${Number(amount).toFixed(2)}.png`
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(new Error('read'))
    r.readAsDataURL(file)
  })
}

function compressSlip(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        let { width: w, height: h } = img
        const scale = Math.min(1, SLIP_MAX_EDGE / Math.max(w, h, 1))
        w = Math.max(1, Math.round(w * scale))
        h = Math.max(1, Math.round(h * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('canvas')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', SLIP_JPEG_Q))
      } catch (e) {
        reject(e)
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    img.src = url
  })
}

async function slipToPayload(file) {
  try {
    return await compressSlip(file)
  } catch {
    const raw = await readFileAsDataUrl(file)
    if (raw.startsWith('data:image/')) return raw
    throw new Error('image')
  }
}

/** Maps a `/api/bookings/pay` error code (or SlipOK numeric code) to a phrase. */
function payErrorKey(code) {
  const key = `slipErr_${code}`
  return DICT[key] ? key : 'slipErr_generic'
}

function PayTransfer({ name, no, qrSrc, amount, lang }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    if (!no) return
    try {
      await navigator.clipboard.writeText(no)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch { /* ignore */ }
  }
  return (
    <div className="pay-transfer">
      <div className="pay-transfer-bank">
        <img src="/kbank.svg" alt="" width={40} height={37} />
        <div>
          <div className="tiny">{t('payAccountLabel', lang)}</div>
          <div className="pay-transfer-bank-name">{t('payBankKbank', lang)}</div>
        </div>
      </div>
      {name && <div className="pay-account-name">{name}</div>}
      {no && (
        <button type="button" className="pay-account-no" onClick={copy}
          aria-label={t('copyAccount', lang)} title={t('copyAccount', lang)}>
          <span className="num">{no}</span>
          <Icon name="copy" size={16} />
        </button>
      )}
      {qrSrc && (
        <div className="pay-qr">
          <img src={qrSrc} alt="QR" />
        </div>
      )}
      {amount != null && (
        <div className="num pay-pair-amt">฿{amount}</div>
      )}
      {copied && <div className="tiny">{t('copied', lang)}</div>}
    </div>
  )
}

// step: summary → qr (if promptpay) → success
export default function Booking({ cart, onDone, onBack }) {
  const { lang, courts, user, vouchers, createMultiBooking, settings } = useStore()
  const { date, items: rawItems } = cart
  const items = sortSlotItems(rawItems, courts.map((c) => c.id))

  const [voucherId, setVoucherId] = useState(null)
  const [step, setStep] = useState('summary')
  const [result, setResult] = useState(null)
  const [slipPreview, setSlipPreview] = useState('')
  const [slipData, setSlipData] = useState('')
  const [slipBusy, setSlipBusy] = useState(false)
  const [slipErr, setSlipErr] = useState('')
  const fileRef = useRef(null)
  const pickGen = useRef(0)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  useEffect(() => () => {
    if (slipPreview) URL.revokeObjectURL(slipPreview)
  }, [slipPreview])

  const priced = items.map((it) => {
    const court = courts.find((c) => c.id === it.courtId)
    const peak = isPeak(it.hour, court)
    return { ...it, court, peak, price: peak ? (court?.pricePeak ?? 0) : (court?.priceOff ?? 0) }
  })
  const subtotal = priced.reduce((s, x) => s + x.price, 0)
  const myVouchers = vouchers.filter((v) => v.userId === user?.id && !v.used)
  const cheapestOffPeakIdx = priced.reduce((best, it, i) => {
    if (it.peak) return best
    if (best < 0) return i
    return it.price < priced[best].price ? i : best
  }, -1)
  const discount = voucherId && cheapestOffPeakIdx >= 0 ? (priced[cheapestOffPeakIdx]?.price ?? 0) : 0
  const total = subtotal - discount
  // No hardcoded fallback: the server verifies the slip's receiver against
  // these exact settings, so showing an account it doesn't know would invite a
  // transfer nobody can confirm. A PromptPay ID is a phone/tax id, never a bank
  // account number — so the QR only appears when one is actually configured.
  const payName = String(settings.payAccountName || '').trim()
  const payNo = String(settings.payAccountNo || '').replace(/\D/g, '')
  const promptPayId = String(settings.promptPayId || '').replace(/\D/g, '')
  const qrSrc = promptPayQrSrc(promptPayId, total)
  const payReady = !!payNo || !!promptPayId

  const toggleVoucher = (id) => {
    if (cheapestOffPeakIdx < 0) return
    setVoucherId((cur) => (cur === id ? null : id))
  }

  const clearSlip = () => {
    setSlipPreview('')
    setSlipData('')
    setSlipErr('')
    setSlipBusy(false)
  }

  const closeQr = () => {
    if (slipBusy) return
    clearSlip()
    setStep('summary')
  }

  // Nothing is booked until the server says so: price, slip and voucher are all
  // re-checked in `/api/bookings/pay`. Throws with `code` on failure.
  const finish = async (opts = {}) => {
    const r = await createMultiBooking(
      items.map((it) => ({ courtId: it.courtId, date, hour: it.hour })),
      { voucherId, slip: opts.slip })
    setResult(r)
    setStep('success')
    clearSlip()
  }

  const doPay = async () => {
    if (total > 0) {
      if (!payReady) { alert(t('promptPayMissing', lang)); return }
      setStep('qr')
      return
    }
    if (slipBusy) return
    setSlipBusy(true)
    try {
      await finish()
    } catch (e) {
      console.error('[Bounce] booking failed', e)
      setSlipBusy(false)
      alert(t(payErrorKey(e?.code), lang))
    }
  }

  const onPickSlip = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || slipBusy) return
    const gen = ++pickGen.current
    setSlipErr('')
    setSlipData('')
    setSlipPreview(URL.createObjectURL(file))
    try {
      const data = await slipToPayload(file)
      if (gen !== pickGen.current) return
      setSlipData(data)
    } catch {
      if (gen !== pickGen.current) return
      setSlipPreview('')
      setSlipErr(t('slipErr_image', lang))
    }
  }

  const confirmAndPay = async () => {
    if (!slipData || slipBusy) return
    const ok = window.confirm(t('confirmSlipAsk', lang, { n: total }))
    if (!ok) return
    setSlipBusy(true)
    setSlipErr('')
    try {
      await finish({ slip: slipData })
    } catch (e) {
      console.error('[Bounce] checkout failed', e)
      setSlipErr(t(payErrorKey(e?.code), lang))
      setSlipBusy(false)
    }
  }

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
            {voucherId && i === cheapestOffPeakIdx ? (
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
                  disabled={cheapestOffPeakIdx < 0}
                  onClick={() => toggleVoucher(v.id)}>
                  {on ? `✓ ${t('promoApplied', lang)}` : t('tapUseCode', lang)}
                </button>
              </div>
            )
          })}
        </div>
        {voucherId && <div className="chip chip-green mt-2">✓ {t('voucherApplied', lang)}</div>}
        {myVouchers.length > 0 && cheapestOffPeakIdx < 0 && (
          <div className="chip chip-amber mt-2">{t('voucherOffPeakOnly', lang)}</div>
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

      {total > 0 && (payReady ? (
        <div className="mt-3">
          <PayTransfer name={payName} no={payNo} qrSrc={qrSrc} lang={lang} />
        </div>
      ) : (
        <div className="chip chip-red mt-3" style={{ width: '100%', whiteSpace: 'normal', justifyContent: 'center' }}>
          {t('promptPayMissing', lang)}
        </div>
      ))}

      <button className="btn btn-lime btn-full btn-lg mt-4" onClick={doPay}
        disabled={slipBusy || (total > 0 && !payReady)}>
        {total === 0 ? t('confirmBooking', lang) : `${t('payNow', lang)} · ฿${total}`}
      </button>

      {step === 'qr' && (
        <Modal onClose={closeQr}>
          <h3 className="tc" style={{ fontSize: 18 }}>{t('transferTitle', lang)}</h3>
          <p className="tc tiny mt-2">{t('scanToPay', lang)}</p>
          <div className="mt-3">
            <PayTransfer name={payName} no={payNo} qrSrc={qrSrc} amount={total} lang={lang} />
          </div>

          <input ref={fileRef} className="sr-only" type="file" accept="image/*"
            onChange={onPickSlip} disabled={slipBusy} />
          {slipPreview ? (
            <div className="mt-4">
              <img className="slip-preview" src={slipPreview} alt="" />
              <button type="button" className="btn btn-ghost btn-full slip-change mt-2" disabled={slipBusy}
                onClick={() => fileRef.current?.click()}>
                <Icon name="image" size={16} /> {t('changeSlip', lang)}
              </button>
            </div>
          ) : (
            <button type="button" className="slip-drop mt-4" disabled={slipBusy}
              onClick={() => fileRef.current?.click()}>
              <Icon name="image" size={22} />
              <span>{t('uploadSlip', lang)}</span>
              <span className="tiny">{t('slipJpgHint', lang)}</span>
            </button>
          )}

          {slipErr && (
            <div className="chip chip-red mt-3" style={{ width: '100%', whiteSpace: 'normal', justifyContent: 'center' }}>
              {slipErr}
            </div>
          )}

          <button className="btn btn-lime btn-full btn-lg mt-4"
            disabled={!slipData || slipBusy}
            onClick={confirmAndPay}>
            {slipBusy ? t('slipChecking', lang)
              : !slipPreview ? t('confirmSlip', lang)
                : !slipData ? t('slipPreparing', lang)
                  : t('confirmSlip', lang)}
          </button>
        </Modal>
      )}
    </div>
  )
}
