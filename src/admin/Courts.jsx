import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'
import { todayISO } from '../data/index.js'
import { Icon, Modal, Toggle, hourLabel } from '../components/ui.jsx'

const PHOTOS = [
  'linear-gradient(135deg,#2456D6 0%,#173B9E 60%,#102A73 100%)',
  'linear-gradient(135deg,#1E7A4C 0%,#16382B 70%)',
  'linear-gradient(135deg,#E8743B 0%,#B33A2B 60%,#6E1F33 100%)',
  'linear-gradient(135deg,#7A4CC9 0%,#3D2373 70%)',
]

const EMPTY = {
  name: '', nameTh: '', desc: '', descTh: '', maxPlayers: 4,
  priceOff: 200, pricePeak: 320, open: 9, close: 21,
  openCourt: false, active: true, photo: PHOTOS[3], blocked: [],
}

export default function Courts() {
  const { lang, courts, setCourts, logAdmin } = useStore()
  const [editing, setEditing] = useState(null)   // court object or EMPTY clone
  const [blocking, setBlocking] = useState(null) // court being blocked
  const [blockForm, setBlockForm] = useState({ date: todayISO(), hour: 12, reason: '' })

  const saveCourt = () => {
    if (!editing.name) return
    if (editing.id) {
      setCourts((cs) => cs.map((c) => (c.id === editing.id ? editing : c)))
      logAdmin(`Edit court ${editing.name}`)
    } else {
      const id = 'c' + Date.now()
      setCourts((cs) => [...cs, { ...editing, id, nameTh: editing.nameTh || editing.name, descTh: editing.descTh || editing.desc }])
      logAdmin(`Add court ${editing.name}`)
    }
    setEditing(null)
  }
  const removeCourt = (c) => {
    if (!confirm(`${t('delete', lang)} ${c.name}?`)) return
    setCourts((cs) => cs.filter((x) => x.id !== c.id))
    logAdmin(`Delete court ${c.name}`)
  }
  const saveBlock = () => {
    setCourts((cs) => cs.map((c) => (c.id === blocking.id
      ? { ...c, blocked: [...c.blocked, { ...blockForm, hour: +blockForm.hour }] }
      : c)))
    logAdmin(`Block ${blocking.name} ${blockForm.date} ${hourLabel(+blockForm.hour)} — ${blockForm.reason}`)
    setBlocking(null)
  }
  const unblock = (courtId, i) => {
    setCourts((cs) => cs.map((c) => (c.id === courtId
      ? { ...c, blocked: c.blocked.filter((_, j) => j !== i) }
      : c)))
  }
  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }))

  return (
    <div>
      <div className="row between wrap gap-3">
        <h1 className="a-title">{t('courtMgmt', lang)}</h1>
        <button className="btn btn-lime" onClick={() => setEditing({ ...EMPTY })}>
          <Icon name="plus" size={16} /> {t('addCourt', lang)}
        </button>
      </div>

      <div className="col gap-4 mt-4">
        {courts.map((c) => (
          <div key={c.id} className="card" style={{ overflow: 'hidden' }}>
            <div className="court-photo" style={{ background: c.photo, height: 64 }}>
              <h3>{lang === 'th' ? c.nameTh : c.name}</h3>
            </div>
            <div className="pad-4">
              <div className="row wrap gap-2">
                <span className="chip chip-lime">{t('offPeak', lang)} ฿{c.priceOff}</span>
                <span className="chip chip-amber">{t('peak', lang)} ฿{c.pricePeak}</span>
                <span className="chip chip-grey">{hourLabel(c.open)}–{hourLabel(c.close)}</span>
                <span className="chip chip-grey">{t('maxPlayers', lang)} {c.maxPlayers}</span>
                {c.openCourt && <span className="chip chip-blue">Open Court</span>}
                {!c.active && <span className="chip chip-red">{t('inactive', lang)}</span>}
              </div>
              {c.blocked.length > 0 && (
                <div className="row wrap gap-2 mt-2">
                  {c.blocked.map((b, i) => (
                    <span key={i} className="chip chip-red">
                      🚫 {b.date} {hourLabel(b.hour)} — {b.reason}
                      <button onClick={() => unblock(c.id, i)} style={{ border: 'none', background: 'none', color: 'inherit', fontWeight: 800 }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="act-row">
                <span className="act-label">{lang === 'th' ? 'จัดการ' : 'Actions'}</span>
                <button className="btn btn-sm" onClick={() => setEditing({ ...c })}>
                  <Icon name="pencil" size={14} /> {t('edit', lang)}
                </button>
                <button className="btn btn-sm" onClick={() => { setBlocking(c); setBlockForm({ date: todayISO(), hour: 12, reason: '' }) }}>
                  <Icon name="block" size={14} /> {t('blockSlot', lang)}
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => removeCourt(c)}>
                  <Icon name="trash" size={14} /> {t('delete', lang)}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <h3 style={{ fontSize: 18 }}>{editing.id ? t('edit', lang) : t('addCourt', lang)}</h3>
          <div className="col gap-3 mt-3">
            <div><label className="label">{t('courtName', lang)} (EN)</label>
              <input className="input" maxLength={60} value={editing.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div><label className="label">{t('courtName', lang)} (TH)</label>
              <input className="input" maxLength={60} value={editing.nameTh} onChange={(e) => set('nameTh', e.target.value)} /></div>
            <div><label className="label">{t('courtDesc', lang)}</label>
              <input className="input" maxLength={140} value={editing.desc} onChange={(e) => set('desc', e.target.value)} /></div>
            <div className="row gap-3">
              <div className="flex-1"><label className="label">{t('priceOffPeak', lang)}</label>
                <input className="input" type="number" min="0" max="99999" value={editing.priceOff} onChange={(e) => set('priceOff', Math.max(0, +e.target.value || 0))} /></div>
              <div className="flex-1"><label className="label">{t('pricePeak', lang)}</label>
                <input className="input" type="number" min="0" max="99999" value={editing.pricePeak} onChange={(e) => set('pricePeak', Math.max(0, +e.target.value || 0))} /></div>
            </div>
            <div className="row gap-3">
              <div className="flex-1"><label className="label">{t('openTime', lang)}</label>
                <select className="select" value={editing.open} onChange={(e) => set('open', +e.target.value)}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select></div>
              <div className="flex-1"><label className="label">{t('closeTime', lang)}</label>
                <select className="select" value={editing.close} onChange={(e) => set('close', +e.target.value)}>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                </select></div>
            </div>
            <div>
              <label className="label">{lang === 'th' ? 'รูปสนาม (เลือกธีมสี)' : 'Court photo (pick a theme)'}</label>
              <div className="row gap-2">
                {PHOTOS.map((p) => (
                  <button key={p} onClick={() => set('photo', p)} style={{
                    width: 48, height: 34, borderRadius: 8, background: p, cursor: 'pointer',
                    border: editing.photo === p ? '3px solid var(--stroke)' : '2px solid #ccc',
                  }} />
                ))}
              </div>
            </div>
            <div className="row between">
              <span className="label" style={{ margin: 0 }}>{t('openCourtMode', lang)}</span>
              <Toggle checked={editing.openCourt} onChange={(v) => set('openCourt', v)} />
            </div>
            <div className="row between">
              <span className="label" style={{ margin: 0 }}>{t('active', lang)}</span>
              <Toggle checked={editing.active} onChange={(v) => set('active', v)} />
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setEditing(null)}>{t('cancel', lang)}</button>
            <button className="btn btn-lime" onClick={saveCourt} disabled={!editing.name}>
              <Icon name="check" size={16} /> {t('save', lang)}
            </button>
          </div>
        </Modal>
      )}

      {blocking && (
        <Modal onClose={() => setBlocking(null)}>
          <h3 style={{ fontSize: 18 }}>🚫 {t('blockSlot', lang)} — {blocking.name}</h3>
          <div className="col gap-3 mt-3">
            <div><label className="label">{t('pickDate', lang)}</label>
              <input className="input" type="date" value={blockForm.date}
                onChange={(e) => setBlockForm((f) => ({ ...f, date: e.target.value }))} /></div>
            <div><label className="label">{t('pickSlot', lang)}</label>
              <select className="select" value={blockForm.hour}
                onChange={(e) => setBlockForm((f) => ({ ...f, hour: e.target.value }))}>
                {Array.from({ length: blocking.close - blocking.open }, (_, i) => {
                  const h = blocking.open + i
                  return <option key={h} value={h}>{hourLabel(h)}</option>
                })}
              </select></div>
            <div><label className="label">{t('blockReason', lang)}</label>
              <input className="input" maxLength={120} value={blockForm.reason} placeholder="Maintenance…"
                onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))} /></div>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setBlocking(null)}>{t('cancel', lang)}</button>
            <button className="btn btn-danger" onClick={saveBlock} disabled={!blockForm.reason}>
              <Icon name="block" size={15} /> {t('confirm', lang)}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
