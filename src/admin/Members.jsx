import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { memberMatches, formatAccountNo, ADJUST_LIMIT } from '../data/index.js'
import { Icon, Modal, ChannelChip, StampCard, AvatarGlyph, downloadCSV, usePager, Pager } from '../components/ui.jsx'

export default function Members() {
  const { lang, members, vouchers, updateMember, stampLog, adminAdjustStamps, adminAdjustVouchers, adminMergeMembers, adminLog, logAdmin } = useStore()
  const [q, setQ] = useState('')
  const [fChannel, setFChannel] = useState('all')
  const [detail, setDetail] = useState(null)
  const [adjust, setAdjust] = useState(null)
  const [mergeFrom, setMergeFrom] = useState('')
  const [mergeBusy, setMergeBusy] = useState(false)
  const [adjustBusy, setAdjustBusy] = useState(false)

  const rows = members
    .filter((m) => fChannel === 'all' || m.channel === fChannel)
    .filter((m) => memberMatches(m, q))

  const pager = usePager(rows, 10)
  const logPager = usePager(adminLog, 8)

  const m = detail ? members.find((x) => x.id === detail) : null
  const unusedCoupons = m
    ? vouchers.filter((v) => v.userId === m.id && !v.used && !v.revoked).length
    : 0

  const exportCsv = () => {
    downloadCSV('bounce-members.csv', [
      ['Account No', 'Name', 'Email', 'Phone', 'Channel', 'Country', 'Stamps', 'Bookings/Year', 'Suspended'],
      ...rows.map((x) => [
        x.accountNo || '', x.name, x.email, x.phone, x.channel, x.country,
        x.stamps, x.bookingsYear, x.suspended ? 'yes' : 'no',
      ]),
    ])
    logAdmin('Export members CSV')
  }

  const toggleSuspend = (x) => {
    updateMember(x.id, { suspended: !x.suspended })
    logAdmin(`${x.suspended ? 'Unsuspend' : 'Suspend'} ${x.name}`)
  }

  return (
    <div>
      <div className="row between wrap gap-3">
        <h1 className="a-title">{t('memberMgmt', lang)}</h1>
        <button className="btn" onClick={exportCsv}><Icon name="download" size={16} /> {t('exportCsv', lang)}</button>
      </div>

      <div className="row wrap gap-2 mt-4">
        <input className="input" style={{ maxWidth: 320 }} maxLength={60} placeholder={t('searchMember', lang)}
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ maxWidth: 160 }} value={fChannel} onChange={(e) => setFChannel(e.target.value)}>
          <option value="all">{t('all', lang)} — {t('channel', lang)}</option>
          <option value="line">LINE</option>
          <option value="email">Email</option>
        </select>
      </div>

      <div className="card mt-4">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>{t('customer', lang)}</th><th>{t('mobilePhone', lang)}</th><th>{t('channel', lang)}</th>
              <th>{t('stamps', lang)}</th><th>{t('status', lang)}</th><th></th>
            </tr></thead>
            <tbody>
              {pager.slice.map((x) => (
                <tr key={x.id} style={{ opacity: x.suspended ? 0.55 : 1 }}>
                  <td>
                    <div className="row gap-2">
                      <span><AvatarGlyph avatar={x.avatar} size={18} /></span>
                      <div>
                        <b>{x.name}</b>
                        <div className="tiny">{[x.email, x.country].filter(Boolean).join(' · ') || '—'}</div>
                        {x.accountNo ? <div className="acct-no">{formatAccountNo(x.accountNo)}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{x.phone || '—'}</td>
                  <td><ChannelChip channel={x.channel} /></td>
                  <td className="num">{x.stamps}/10</td>
                  <td>{x.suspended
                    ? <span className="chip chip-red">Suspended</span>
                    : <span className="chip chip-green">{t('active', lang)}</span>}</td>
                  <td><button className="btn btn-sm" onClick={() => setDetail(x.id)}>
                    <Icon name="gear" size={14} /> {lang === 'th' ? 'จัดการ' : 'Manage'}
                  </button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager {...pager} lang={lang} />
      </div>

      <div className="card pad-4 mt-4">
        <h3 style={{ fontSize: 15 }}>📋 {t('actionLog', lang)}</h3>
        <div className="col mt-2">
          {adminLog.length === 0 && <div className="tiny">—</div>}
          {logPager.slice.map((l) => (
            <div key={l.id} className="tiny" style={{ padding: '4px 0', borderBottom: '1px solid #E3E1D5' }}>
              <span className="num">{l.date}</span> — {l.action}
            </div>
          ))}
        </div>
        <Pager {...logPager} lang={lang} />
      </div>

      {m && (
        <Modal onClose={() => { setDetail(null); setAdjust(null) }}>
          <div className="row gap-3">
            <span><AvatarGlyph avatar={m.avatar} size={34} /></span>
            <div className="flex-1">
              <h3 style={{ fontSize: 18 }}>{m.name}</h3>
              <div className="tiny">{m.email || '—'}</div>
              <div className="num mt-1" style={{ fontSize: 15 }}>{m.phone || '—'}</div>
              {m.accountNo ? <div className="acct-no acct-no-lg">{formatAccountNo(m.accountNo)}</div> : null}
            </div>
          </div>

          <div className="row gap-2 mt-3 wrap">
            <span className="chip chip-lime num"><Icon name="ball" size={13} /> {m.stamps}/10</span>
            <span className="chip chip-grey num" title={t('couponsLeft', lang)}><Icon name="ticket" size={13} /> {unusedCoupons}</span>
            <span className="chip chip-grey num">{t('bookingsPerYear', lang)}: {m.bookingsYear}</span>
            <ChannelChip channel={m.channel} />
          </div>

          <div className="mt-3"><StampCard stamps={m.stamps} lang={lang} /></div>
          <p className="tiny mt-2">{t('stampAutoCode', lang)}</p>

          <h4 className="mt-4" style={{ fontSize: 14 }}>{t('stampHistory', lang)}</h4>
          <div className="col gap-1 mt-1" style={{ maxHeight: 120, overflowY: 'auto' }}>
            {stampLog.filter((s) => s.userId === m.id).map((s) => (
              <div key={s.id} className="tiny row between">
                <span>{fmtDate(s.date, lang)} — {s.note}</span>
                <b style={{ color: s.delta > 0 ? 'var(--green-ok)' : 'var(--red)' }}>{s.delta > 0 ? '+' : ''}{s.delta}</b>
              </div>
            ))}
          </div>

          {!adjust && (
            <div className="act-row">
              <span className="act-label">{lang === 'th' ? 'จัดการ' : 'Actions'}</span>
              <button className="btn btn-sm btn-lime" onClick={() => setAdjust({ kind: 'stamps', sign: 1, count: '1', reason: '' })}><Icon name="ball" size={14} /> {t('adjustStamps', lang)}</button>
              <button className="btn btn-sm" onClick={() => setAdjust({ kind: 'coupons', sign: unusedCoupons > 0 ? -1 : 1, count: '1', reason: '' })}><Icon name="ticket" size={14} /> {t('adjustCoupons', lang)}</button>
              <button className={`btn btn-sm ${m.suspended ? '' : 'btn-danger'}`} onClick={() => toggleSuspend(m)}>
                <Icon name={m.suspended ? 'check' : 'block'} size={14} />
                {m.suspended ? t('unsuspend', lang) : t('suspend', lang)}
              </button>
            </div>
          )}

          {!adjust && members.filter((x) => x.id !== m.id).length > 0 && (
            <div className="card-flat pad-3 mt-3">
              <label className="label">{t('mergeFrom', lang)}</label>
              <p className="tiny mt-1">{t('mergePick', lang)}</p>
              <select className="select mt-2" value={mergeFrom} onChange={(e) => setMergeFrom(e.target.value)}>
                <option value="">—</option>
                {members.filter((x) => x.id !== m.id).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.accountNo ? `${formatAccountNo(x.accountNo)} · ` : ''}{x.channel} · {x.stamps}/10
                  </option>
                ))}
              </select>
              <button className="btn btn-sm btn-pine mt-2" disabled={!mergeFrom || mergeBusy}
                onClick={async () => {
                  if (!confirm(t('mergeConfirm', lang))) return
                  setMergeBusy(true)
                  const r = await adminMergeMembers(mergeFrom, m.id)
                  setMergeBusy(false)
                  if (r?.error) {
                    alert(lang === 'th' ? 'ย้ายไม่สำเร็จ' : 'Merge failed')
                    return
                  }
                  setMergeFrom('')
                  alert(t('mergeOk', lang))
                }}>
                {t('mergeNow', lang)}
              </button>
            </div>
          )}

          {adjust && (() => {
            const count = Math.min(ADJUST_LIMIT, Math.max(0, parseInt(adjust.count, 10) || 0))
            const maxDown = adjust.kind === 'coupons' ? unusedCoupons : (m.stamps || 0)
            const blockedDown = adjust.sign < 0 && (count < 1 || count > maxDown)
            return (
            <div className="card-flat pad-4 mt-4">
              <h4 style={{ fontSize: 14 }}>{adjust.kind === 'coupons' ? t('adjustCoupons', lang) : t('adjustStamps', lang)}</h4>
              {adjust.kind === 'coupons' && <p className="tiny mt-1">{t('couponAdjustHint', lang)} · {t('couponsLeft', lang)}: <b className="num">{unusedCoupons}</b></p>}
              <div className="row gap-2 mt-2">
                {[-1, 1].map((sign) => (
                  <button key={sign} type="button" className={`btn btn-sm ${adjust.sign === sign ? 'btn-pine' : ''}`}
                    style={{ minHeight: 44, minWidth: 72 }}
                    disabled={sign < 0 && maxDown < 1}
                    onClick={() => setAdjust((a) => ({ ...a, sign }))}>{sign > 0 ? t('adjustUp', lang) : t('adjustDown', lang)}</button>
                ))}
              </div>
              <label className="label mt-3">{t('adjustCount', lang)}</label>
              <input className="input mt-1" inputMode="numeric" maxLength={2} value={adjust.count}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 2)
                  const next = digits === '' ? '' : String(Math.min(ADJUST_LIMIT, parseInt(digits, 10)))
                  setAdjust((a) => ({ ...a, count: next }))
                }} />
              <input className="input mt-2" maxLength={120} placeholder={t('reason', lang)} value={adjust.reason}
                onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))} />
              <div className="row gap-2 mt-2">
                <button className="btn btn-sm btn-lime" style={{ minHeight: 44 }} disabled={!adjust.reason || adjustBusy || count < 1 || blockedDown}
                  onClick={async () => {
                    const delta = adjust.sign * count
                    setAdjustBusy(true)
                    try {
                      const r = adjust.kind === 'coupons'
                        ? await adminAdjustVouchers(m.id, delta, adjust.reason)
                        : await adminAdjustStamps(m.id, delta, adjust.reason)
                      if (r?.error === 'short') {
                        alert(t('notEnoughCoupons', lang, { n: r.have ?? 0 }))
                        return
                      }
                      if (r?.error === 'none') {
                        alert(adjust.kind === 'coupons' ? t('noCouponToReduce', lang) : t('noStampsToReduce', lang))
                        return
                      }
                      if (r?.error) {
                        alert(t('adjustFailed', lang))
                        return
                      }
                      setAdjust(null)
                    } catch (e) {
                      console.error('[Bounce] adjust', e)
                      alert(t('adjustFailed', lang))
                    } finally {
                      setAdjustBusy(false)
                    }
                  }}>{t('confirm', lang)}</button>
                <button className="btn btn-sm btn-ghost" style={{ minHeight: 44 }} onClick={() => setAdjust(null)}>{t('cancel', lang)}</button>
              </div>
            </div>
            )
          })()}
        </Modal>
      )}
    </div>
  )
}
