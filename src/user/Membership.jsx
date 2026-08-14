import React from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate } from '../i18n.js'
import { StampCard, ChannelChip, Icon, AvatarGlyph } from '../components/ui.jsx'

export default function Membership() {
  const { lang, user, vouchers, stampLog, logout } = useStore()
  const myVouchers = vouchers.filter((v) => v.userId === user.id)
  const myLog = stampLog.filter((s) => s.userId === user.id)

  return (
    <div className="page">
      <div className="card-pine pad-5">
        <div className="row gap-3">
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--lime)',
            border: '2px solid var(--stroke)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 28,
          }}><AvatarGlyph avatar={user.avatar} size={28} /></div>
          <div className="flex-1">
            <h2 style={{ fontSize: 19, color: 'var(--lime)' }}>{user.name}</h2>
            <div className="tiny" style={{ color: 'var(--cream)', opacity: 0.8 }}>{user.email}</div>
            <div className="tiny mt-1" style={{ color: 'var(--cream)' }}>
              {t('bookingsPerYear', lang)}: <b>{user.bookingsYear}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="card pad-5 mt-4">
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 17 }}>{t('stampCard', lang)}</h3>
            <p className="tiny mt-1">{t('stampRule', lang)}</p>
          </div>
          <span className="chip chip-lime num">{user.stamps}/10</span>
        </div>
        <div className="mt-3"><StampCard stamps={user.stamps} lang={lang} /></div>
      </div>

      <h3 className="mt-6" style={{ fontSize: 16 }}>{t('vouchers', lang)}</h3>
      <div className="col gap-3 mt-2">
        {myVouchers.length === 0 && <div className="card-flat pad-4 tc tiny">{t('noVouchers', lang)}</div>}
        {myVouchers.map((v) => (
          <div key={v.id} className={`ticket ${v.used ? 'used' : ''}`}>
            <div className="ticket-left">{t('free', lang)}</div>
            <div className="pad-4 flex-1">
              <strong style={{ fontFamily: 'var(--font-display)' }}>{t('voucherFreeBooking', lang)}</strong>
              <div className="tiny mt-1">
                {v.used ? (lang === 'th' ? 'ใช้แล้ว' : 'Used') : t('codeNoExpiry', lang)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-6" style={{ fontSize: 16 }}>{t('stampHistory', lang)}</h3>
      <div className="card-flat mt-2">
        {myLog.length === 0 && <div className="pad-4 tc tiny">—</div>}
        {myLog.map((s, i) => (
          <div key={s.id} className="row between pad-3" style={{ borderTop: i ? '1px solid #E3E1D5' : 'none', fontSize: 13.5 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{s.note}</div>
              <div className="tiny">{fmtDate(s.date, lang)} · {s.by}</div>
            </div>
            <span className={`chip ${s.delta > 0 ? 'chip-green' : 'chip-red'}`}>{s.delta > 0 ? '+' : ''}{s.delta} <Icon name="ball" size={13} /></span>
          </div>
        ))}
      </div>

      <h3 className="mt-6" style={{ fontSize: 16 }}>{t('linkedAccounts', lang)}</h3>
      <div className="card-flat pad-4 mt-2 row gap-2 wrap">
        <ChannelChip channel={user.channel} />
        <span className="tiny">{user.email}</span>
        {user.phone && <span className="tiny">· {user.phone}</span>}
      </div>

      <button className="btn btn-full mt-6" onClick={logout}>{t('logout', lang)}</button>
    </div>
  )
}
