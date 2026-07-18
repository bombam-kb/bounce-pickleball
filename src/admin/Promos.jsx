import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { todayISO, addDays } from '../data/index.js'
import { Icon, Modal, Toggle, usePager, Pager } from '../components/ui.jsx'

const EMPTY = { code: '', type: 'fixed', value: 50, expiry: addDays(todayISO(), 30), limit: 100, used: 0, active: true }

export default function Promos() {
  const { lang, promos, savePromo, updatePromo, logAdmin } = useStore()
  const [editing, setEditing] = useState(null)
  const pager = usePager(promos, 6)

  const save = () => {
    if (!editing.code) return
    const code = editing.code.toUpperCase().replace(/\s/g, '')
    savePromo({ ...editing, code })
    logAdmin(`${editing.id ? 'Edit' : 'Create'} promo ${code}`)
    setEditing(null)
  }
  const toggle = (p, v) => {
    updatePromo(p.id, { active: v })
    logAdmin(`${v ? 'Enable' : 'Disable'} promo ${p.code}`)
  }
  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }))

  return (
    <div>
      <div className="row between wrap gap-3">
        <h1 className="a-title">{t('promoMgmt', lang)}</h1>
        <button className="btn btn-lime" onClick={() => setEditing({ ...EMPTY })}>
          <Icon name="plus" size={16} /> {t('createPromo', lang)}
        </button>
      </div>

      <div className="col gap-3 mt-4">
        {pager.slice.map((p) => {
          const expired = p.expiry < todayISO()
          const pct = Math.min(100, Math.round((p.used / p.limit) * 100))
          return (
            <div key={p.id} className="card pad-4">
              <div className="row between wrap gap-2">
                <div className="row gap-3">
                  <span className="chip chip-pine num" style={{ fontSize: 15, padding: '5px 14px' }}>{p.code}</span>
                  <strong>{p.type === 'fixed' ? `−฿${p.value}` : `−${p.value}%`}</strong>
                </div>
                <div className="row gap-3">
                  {expired && <span className="chip chip-red">{lang === 'th' ? 'หมดอายุ' : 'Expired'}</span>}
                  <Toggle checked={p.active} onChange={(v) => toggle(p, v)} />
                </div>
              </div>
              <div className="row between wrap gap-2 mt-3 tiny">
                <span>{t('expires', lang)}: {fmtDate(p.expiry, lang)}</span>
                <span>{t('used', lang)}: <b className="num">{p.used}/{p.limit}</b></span>
              </div>
              <div className="progress-track mt-2" style={{ height: 10 }}>
                <div className="progress-fill" style={{ width: pct + '%' }} />
              </div>
              <div className="act-row">
                <span className="act-label">{lang === 'th' ? 'จัดการ' : 'Actions'}</span>
                <button className="btn btn-sm" onClick={() => setEditing({ ...p })}>
                  <Icon name="pencil" size={14} /> {t('edit', lang)}
                </button>
              </div>
            </div>
          )
        })}
        <Pager {...pager} lang={lang} />
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3 style={{ fontSize: 18 }}>{editing.id ? t('edit', lang) : t('createPromo', lang)}</h3>
          <div className="col gap-3 mt-3">
            <div><label className="label">Code</label>
              <input className="input" maxLength={20} value={editing.code} placeholder="BOUNCE50"
                style={{ textTransform: 'uppercase', fontFamily: 'var(--font-display)', fontWeight: 700 }}
                onChange={(e) => set('code', e.target.value)} /></div>
            <div className="row gap-3">
              <div className="flex-1"><label className="label">{t('discountType', lang)}</label>
                <select className="select" value={editing.type} onChange={(e) => set('type', e.target.value)}>
                  <option value="fixed">{t('fixedBaht', lang)}</option>
                  <option value="percent">{t('percentOff', lang)}</option>
                </select></div>
              <div className="flex-1"><label className="label">{editing.type === 'fixed' ? '฿' : '%'}</label>
                <input className="input" type="number" min="0" value={editing.value} onChange={(e) => set('value', Math.max(0, +e.target.value || 0))} /></div>
            </div>
            <div className="row gap-3">
              <div className="flex-1"><label className="label">{t('expires', lang)}</label>
                <input className="input" type="date" value={editing.expiry} onChange={(e) => set('expiry', e.target.value)} /></div>
              <div className="flex-1"><label className="label">{t('usageLimit', lang)}</label>
                <input className="input" type="number" min="1" value={editing.limit} onChange={(e) => set('limit', Math.max(1, +e.target.value || 1))} /></div>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setEditing(null)}>{t('cancel', lang)}</button>
            <button className="btn btn-lime" onClick={save} disabled={!editing.code}>
              <Icon name="check" size={16} /> {t('save', lang)}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
