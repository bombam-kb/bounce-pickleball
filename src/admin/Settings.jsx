import React, { useState, useEffect } from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'
import { legalHasText } from '../legalHtml.js'
import { voucherExpiryDays, VOUCHER_EXPIRY_MAX_DAYS } from '../data/index.js'
import LegalEditor from './LegalEditor.jsx'

function VoucherExpiryCard({ settings, saveSettings, logAdmin, lang }) {
  const current = voucherExpiryDays(settings)
  const [mode, setMode] = useState(current ? 'days' : 'never')
  const [days, setDays] = useState(current ? String(current) : '30')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const d = voucherExpiryDays(settings)
    setMode(d ? 'days' : 'never')
    setDays(d ? String(d) : '30')
  }, [settings.voucherExpiryDays])

  const n = Number(days)
  const valid = mode === 'never' || (Number.isInteger(n) && n >= 1 && n <= VOUCHER_EXPIRY_MAX_DAYS)
  const next = mode === 'never' ? 0 : n
  const changed = valid && next !== current

  const save = async () => {
    if (!valid) { setMsg('bad'); return }
    setBusy(true)
    setMsg(null)
    try {
      await saveSettings({ ...settings, voucherExpiryDays: next })
      await logAdmin(next ? `Coupon expiry: ${next} days after issue (new coupons only)` : 'Coupon expiry: none (new coupons only)')
      setMsg('ok')
    } catch {
      setMsg('fail')
    }
    setBusy(false)
  }

  return (
    <div className="card pad-5 mt-4" style={{ maxWidth: 640 }}>
      <h3 style={{ fontSize: 15 }}>{t('voucherExpiryTitle', lang)}</h3>
      <p className="tiny mt-1">{t('voucherExpiryHint', lang)}</p>
      <div className="tabs tabs-split mt-3" role="radiogroup" aria-label={t('voucherExpiryTitle', lang)}>
        <button type="button" role="radio" aria-checked={mode === 'never'}
          className={`tab ${mode === 'never' ? 'on' : ''}`}
          onClick={() => { setMode('never'); setMsg(null) }}>
          {t('voucherExpiryNever', lang)}
        </button>
        <button type="button" role="radio" aria-checked={mode === 'days'}
          className={`tab ${mode === 'days' ? 'on' : ''}`}
          onClick={() => { setMode('days'); setMsg(null) }}>
          {t('voucherExpiryAfter', lang)}
        </button>
      </div>
      {mode === 'days' && (
        <div className="mt-3">
          <label className="label" htmlFor="voucher-expiry-days">{t('voucherExpiryDaysLabel', lang)}</label>
          <div className="row gap-2">
            <input id="voucher-expiry-days" className="input num" style={{ maxWidth: 140 }}
              type="number" inputMode="numeric" min="1" max={VOUCHER_EXPIRY_MAX_DAYS}
              value={days} onChange={(e) => { setDays(e.target.value.replace(/\D/g, '')); setMsg(null) }} />
            <span>{t('days', lang)}</span>
          </div>
        </div>
      )}
      <p className="tiny mt-3">
        {current
          ? t('voucherExpiryNow', lang, { n: current })
          : t('voucherExpiryNowNever', lang)}
      </p>
      <button className="btn btn-lime btn-lg mt-3" disabled={busy || !changed} onClick={save}>{t('save', lang)}</button>
      {msg === 'ok' && <span className="chip chip-green mt-2">✓ {lang === 'th' ? 'บันทึกแล้ว' : 'Saved'}</span>}
      {msg === 'bad' && <span className="chip chip-red mt-2">{t('voucherExpiryBad', lang, { n: VOUCHER_EXPIRY_MAX_DAYS })}</span>}
      {msg === 'fail' && <span className="chip chip-red mt-2">{t('adjustFailed', lang)}</span>}
    </div>
  )
}

function LegalLangPair({ field, form, set, lang }) {
  return (
    <div className="col gap-4 mt-3">
      <div>
        <label className="label">{t('legalCopyTh', lang)} (TH)</label>
        <LegalEditor
          lang={lang}
          value={form[`${field}Th`] || ''}
          onChange={(html) => set(`${field}Th`, html)}
        />
      </div>
      <div>
        <label className="label">{t('legalCopyEn', lang)} (EN)</label>
        <LegalEditor
          lang={lang}
          value={form[`${field}En`] || ''}
          onChange={(html) => set(`${field}En`, html)}
        />
        {!legalHasText(form[`${field}En`]) && (
          <p className="tiny mt-1">{t('legalEnMissing', lang)}</p>
        )}
      </div>
    </div>
  )
}

export default function Settings() {
  const { lang, settings, saveSettings, logAdmin, resetDemo } = useStore()
  const [form, setForm] = useState(settings)
  const [saved, setSaved] = useState(false)
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false) }

  useEffect(() => { setForm(settings) }, [settings])

  const save = () => {
    const next = {
      ...form,
      promptPayId: String(form.promptPayId || '').replace(/\D/g, ''),
      payAccountName: String(form.payAccountName || '').trim(),
      payAccountNo: String(form.payAccountNo || '').replace(/\D/g, ''),
    }
    delete next.gatewayKey
    saveSettings(next)
    logAdmin('Update general settings')
    setSaved(true)
  }

  return (
    <div>
      <h1 className="a-title">{t('settings', lang)}</h1>
      <div className="card pad-5 mt-4" style={{ maxWidth: 640 }}>
        <div className="col gap-4">
          <div>
            <label className="label">{t('advanceBookingLabel', lang)}</label>
            <input className="input" type="number" min="1" max="90" value={form.advanceBookingDays}
              onChange={(e) => set('advanceBookingDays', Math.max(1, +e.target.value || 1))} />
          </div>
          <div>
            <label className="label">{t('defaultLang', lang)}</label>
            <select className="select" value={form.defaultLang} onChange={(e) => set('defaultLang', e.target.value)}>
              <option value="th">ไทย (TH)</option>
              <option value="en">English (EN)</option>
            </select>
          </div>
          <div>
            <label className="label">{t('payAccountNameLabel', lang)}</label>
            <input className="input" maxLength={80}
              value={form.payAccountName || ''}
              onChange={(e) => set('payAccountName', e.target.value)} />
          </div>
          <div>
            <label className="label">{t('payAccountNoLabel', lang)}</label>
            <input className="input num" type="tel" inputMode="numeric" autoComplete="off"
              maxLength={20}
              value={form.payAccountNo || ''}
              onChange={(e) => set('payAccountNo', e.target.value.replace(/\D/g, ''))} />
          </div>
          <div>
            <label className="label">{t('promptPayIdLabel', lang)}</label>
            <input className="input num" type="tel" inputMode="numeric" autoComplete="off"
              maxLength={13} placeholder="0812345678"
              value={form.promptPayId || ''}
              onChange={(e) => set('promptPayId', e.target.value.replace(/\D/g, ''))} />
            <p className="tiny mt-1">{t('promptPayIdHint', lang)}</p>
          </div>
          <button className="btn btn-lime btn-lg" onClick={save}>{t('save', lang)}</button>
          {saved && <span className="chip chip-green">✓ {lang === 'th' ? 'บันทึกแล้ว' : 'Saved'}</span>}
        </div>
      </div>

      <VoucherExpiryCard settings={settings} saveSettings={saveSettings} logAdmin={logAdmin} lang={lang} />

      <div className="card pad-5 mt-4" style={{ maxWidth: 640 }}>
        <h3 style={{ fontSize: 15 }}>{t('payTermsTitle', lang)}</h3>
        <p className="tiny mt-1">{t('legalPayHint', lang)}</p>
        <LegalLangPair field="payTerms" form={form} set={set} lang={lang} />
        <button className="btn btn-lime btn-lg mt-4" onClick={save}>{t('save', lang)}</button>
        {saved && <span className="chip chip-green mt-2">✓ {lang === 'th' ? 'บันทึกแล้ว' : 'Saved'}</span>}
      </div>

      <div className="card pad-5 mt-4" style={{ maxWidth: 640 }}>
        <h3 style={{ fontSize: 15 }}>{t('appTermsTitle', lang)}</h3>
        <p className="tiny mt-1">{t('legalAppHint', lang)}</p>
        <LegalLangPair field="appTerms" form={form} set={set} lang={lang} />
        <button className="btn btn-lime btn-lg mt-4" onClick={save}>{t('save', lang)}</button>
        {saved && <span className="chip chip-green mt-2">✓ {lang === 'th' ? 'บันทึกแล้ว' : 'Saved'}</span>}
      </div>

      <div className="card pad-5 mt-4" style={{ maxWidth: 640 }}>
        <h3 style={{ fontSize: 15 }}>🗄️ Demo Data</h3>
        <p className="tiny mt-1">{t('demoNote', lang)}</p>
        <div className="act-row">
          <button className="btn btn-danger" onClick={() => confirm(t('resetConfirm', lang)) && resetDemo()}>
            ♻︎ {t('resetDemo', lang)}
          </button>
        </div>
      </div>
    </div>
  )
}
