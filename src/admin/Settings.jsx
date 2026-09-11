import React, { useState, useEffect } from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'
import { legalHasText } from '../legalHtml.js'
import LegalEditor from './LegalEditor.jsx'

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
