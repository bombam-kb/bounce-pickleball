import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { tierOf, todayISO } from '../data/index.js'
import { Icon, Modal, TierBadge, ChannelChip, StampCard, downloadCSV, usePager, Pager } from '../components/ui.jsx'

export default function Members() {
  const { lang, members, setMembers, vouchers, stampLog, adminAdjustStamps, adminIssueVoucher, adminLog, logAdmin } = useStore()
  const [q, setQ] = useState('')
  const [fTier, setFTier] = useState('all')
  const [fChannel, setFChannel] = useState('all')
  const [detail, setDetail] = useState(null)      // member id in detail view
  const [adjust, setAdjust] = useState(null)      // {delta, reason}
  const [voucherReason, setVoucherReason] = useState(null)

  const rows = members
    .filter((m) => fTier === 'all' || tierOf(m.bookingsYear).key === fTier)
    .filter((m) => fChannel === 'all' || m.channel === fChannel)
    .filter((m) => !q || (m.name + m.email).toLowerCase().includes(q.toLowerCase()))

  const pager = usePager(rows, 10)
  const logPager = usePager(adminLog, 8)

  const m = detail ? members.find((x) => x.id === detail) : null

  const exportCsv = () => {
    downloadCSV('bounce-members.csv', [
      ['Name', 'Email', 'Phone', 'Channel', 'Country', 'Tier', 'Stamps', 'Bookings/Year', 'Credits', 'Vouchers', 'Suspended'],
      ...rows.map((x) => [
        x.name, x.email, x.phone, x.channel, x.country, tierOf(x.bookingsYear).name,
        x.stamps, x.bookingsYear, x.credits,
        vouchers.filter((v) => v.userId === x.id).length, x.suspended ? 'yes' : 'no',
      ]),
    ])
    logAdmin('Export members CSV')
  }

  const toggleSuspend = (x) => {
    setMembers((ms) => ms.map((y) => (y.id === x.id ? { ...y, suspended: !y.suspended } : y)))
    logAdmin(`${x.suspended ? 'Unsuspend' : 'Suspend'} ${x.name}`)
  }
  const addCredits = (x) => {
    const v = prompt(lang === 'th' ? 'จำนวน Credits (+/-)' : 'Credits amount (+/-)', '100')
    if (v === null || isNaN(+v)) return
    setMembers((ms) => ms.map((y) => (y.id === x.id ? { ...y, credits: Math.max(0, y.credits + +v) } : y)))
    logAdmin(`Credits ${+v > 0 ? '+' : ''}${v} for ${x.name}`)
  }

  return (
    <div>
      <div className="row between wrap gap-3">
        <h1 className="a-title">{t('memberMgmt', lang)}</h1>
        <button className="btn" onClick={exportCsv}><Icon name="download" size={16} /> {t('exportCsv', lang)}</button>
      </div>

      <div className="row wrap gap-2 mt-4">
        <input className="input" style={{ maxWidth: 220 }} maxLength={60} placeholder={`${t('search', lang)}…`}
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select" style={{ maxWidth: 150 }} value={fTier} onChange={(e) => setFTier(e.target.value)}>
          <option value="all">{t('all', lang)} — {t('tier', lang)}</option>
          <option value="bronze">🟤 Bronze</option>
          <option value="silver">⚪ Silver</option>
          <option value="gold">🟡 Gold</option>
        </select>
        <select className="select" style={{ maxWidth: 160 }} value={fChannel} onChange={(e) => setFChannel(e.target.value)}>
          <option value="all">{t('all', lang)} — {t('channel', lang)}</option>
          <option value="line">LINE</option>
          <option value="google">Google</option>
          <option value="email">Email</option>
        </select>
      </div>

      <div className="card mt-4">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>{t('customer', lang)}</th><th>{t('channel', lang)}</th><th>{t('tier', lang)}</th>
              <th>{t('stamps', lang)}</th><th>{t('credits', lang)}</th><th>{t('status', lang)}</th><th></th>
            </tr></thead>
            <tbody>
              {pager.slice.map((x) => (
                <tr key={x.id} style={{ opacity: x.suspended ? 0.55 : 1 }}>
                  <td>
                    <div className="row gap-2">
                      <span style={{ fontSize: 18 }}>{x.avatar}</span>
                      <div><b>{x.name}</b><div className="tiny">{x.email} · {x.country}</div></div>
                    </div>
                  </td>
                  <td><ChannelChip channel={x.channel} /></td>
                  <td><TierBadge bookingsYear={x.bookingsYear} /></td>
                  <td className="num">{x.stamps}/10</td>
                  <td className="num">฿{x.credits}</td>
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

      {/* admin action log */}
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
        <Modal onClose={() => { setDetail(null); setAdjust(null); setVoucherReason(null) }}>
          <div className="row gap-3">
            <span style={{ fontSize: 34 }}>{m.avatar}</span>
            <div className="flex-1">
              <h3 style={{ fontSize: 18 }}>{m.name}</h3>
              <div className="tiny">{m.email} {m.phone && `· ${m.phone}`}</div>
            </div>
            <TierBadge bookingsYear={m.bookingsYear} />
          </div>

          <div className="row gap-2 mt-3 wrap">
            <span className="chip chip-lime num">🏓 {m.stamps}/10</span>
            <span className="chip chip-grey num">{t('bookingsPerYear', lang)}: {m.bookingsYear}</span>
            <span className="chip chip-grey num">฿{m.credits}</span>
            <ChannelChip channel={m.channel} />
          </div>

          <div className="mt-3"><StampCard stamps={m.stamps} /></div>

          {/* vouchers */}
          <h4 className="mt-4" style={{ fontSize: 14 }}>🎁 {t('vouchers', lang)}</h4>
          <div className="col gap-1 mt-1">
            {vouchers.filter((v) => v.userId === m.id).map((v) => (
              <div key={v.id} className="tiny row between">
                <span>{v.source === 'stamps' ? '🏓 Stamps' : '👤 Manual'} · {t('expires', lang)} {fmtDate(v.expiry, lang)}</span>
                <span>{v.used ? '✓ used' : v.expiry < todayISO() ? 'expired' : <b style={{ color: 'var(--green-ok)' }}>active</b>}</span>
              </div>
            ))}
            {vouchers.filter((v) => v.userId === m.id).length === 0 && <div className="tiny">—</div>}
          </div>

          {/* stamp history */}
          <h4 className="mt-4" style={{ fontSize: 14 }}>{t('stampHistory', lang)}</h4>
          <div className="col gap-1 mt-1" style={{ maxHeight: 120, overflowY: 'auto' }}>
            {stampLog.filter((s) => s.userId === m.id).map((s) => (
              <div key={s.id} className="tiny row between">
                <span>{fmtDate(s.date, lang)} — {s.note}</span>
                <b style={{ color: s.delta > 0 ? 'var(--green-ok)' : 'var(--red)' }}>{s.delta > 0 ? '+' : ''}{s.delta}</b>
              </div>
            ))}
          </div>

          {/* actions */}
          {!adjust && !voucherReason && (
            <div className="act-row">
              <span className="act-label">{lang === 'th' ? 'จัดการ' : 'Actions'}</span>
              <button className="btn btn-sm btn-lime" onClick={() => setAdjust({ delta: 1, reason: '' })}>🏓 {t('adjustStamps', lang)}</button>
              <button className="btn btn-sm" onClick={() => setVoucherReason('')}>🎁 {t('issueVoucher', lang)}</button>
              <button className="btn btn-sm" onClick={() => addCredits(m)}>💰 {t('credits', lang)}</button>
              <button className={`btn btn-sm ${m.suspended ? '' : 'btn-danger'}`} onClick={() => toggleSuspend(m)}>
                <Icon name={m.suspended ? 'check' : 'block'} size={14} />
                {m.suspended ? t('unsuspend', lang) : t('suspend', lang)}
              </button>
            </div>
          )}

          {adjust && (
            <div className="card-flat pad-4 mt-4">
              <h4 style={{ fontSize: 14 }}>{t('adjustStamps', lang)}</h4>
              <div className="row gap-2 mt-2">
                {[-1, 1].map((d) => (
                  <button key={d} className={`btn btn-sm ${adjust.delta === d ? 'btn-pine' : ''}`}
                    onClick={() => setAdjust((a) => ({ ...a, delta: d }))}>{d > 0 ? '+1' : '−1'}</button>
                ))}
                <input className="input flex-1" maxLength={120} placeholder={t('reason', lang)} value={adjust.reason}
                  onChange={(e) => setAdjust((a) => ({ ...a, reason: e.target.value }))} />
              </div>
              <div className="row gap-2 mt-2">
                <button className="btn btn-sm btn-lime" disabled={!adjust.reason}
                  onClick={() => { adminAdjustStamps(m.id, adjust.delta, adjust.reason); setAdjust(null) }}>{t('confirm', lang)}</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setAdjust(null)}>{t('cancel', lang)}</button>
              </div>
            </div>
          )}

          {voucherReason !== null && (
            <div className="card-flat pad-4 mt-4">
              <h4 style={{ fontSize: 14 }}>{t('issueVoucher', lang)}</h4>
              <input className="input mt-2" maxLength={120} placeholder={t('reason', lang)} value={voucherReason}
                onChange={(e) => setVoucherReason(e.target.value)} />
              <div className="row gap-2 mt-2">
                <button className="btn btn-sm btn-lime" disabled={!voucherReason}
                  onClick={() => { adminIssueVoucher(m.id, voucherReason); setVoucherReason(null) }}>{t('confirm', lang)}</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setVoucherReason(null)}>{t('cancel', lang)}</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
