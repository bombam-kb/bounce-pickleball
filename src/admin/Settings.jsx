import React, { useState, useEffect } from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'

export default function Settings() {
  const { lang, settings, saveSettings, logAdmin, resetDemo } = useStore()
  const [form, setForm] = useState(settings)
  const [saved, setSaved] = useState(false)
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false) }

  // settings arrive asynchronously from Firestore — sync the form once loaded
  useEffect(() => { setForm(settings) }, [settings])

  const save = () => {
    saveSettings(form)
    logAdmin('Update general settings')
    setSaved(true)
  }

  return (
    <div>
      <h1 className="a-title">{t('settings', lang)}</h1>
      <div className="card pad-5 mt-4" style={{ maxWidth: 560 }}>
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
            <label className="label">{t('gatewayKey', lang)}</label>
            <input className="input num" maxLength={80} value={form.gatewayKey} onChange={(e) => set('gatewayKey', e.target.value)} />
          </div>
          <button className="btn btn-lime btn-lg" onClick={save}>{t('save', lang)}</button>
          {saved && <span className="chip chip-green">✓ {lang === 'th' ? 'บันทึกแล้ว' : 'Saved'}</span>}
        </div>
      </div>

      <div className="card pad-5 mt-4" style={{ maxWidth: 560 }}>
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
