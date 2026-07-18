import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'
import { Icon } from '../components/ui.jsx'
import Dashboard from './Dashboard.jsx'
import Courts from './Courts.jsx'
import Bookings from './Bookings.jsx'
import Promos from './Promos.jsx'
import Members from './Members.jsx'
import Analytics from './Analytics.jsx'
import Settings from './Settings.jsx'

const SCREENS = [
  { key: 'dashboard', icon: 'chart', comp: Dashboard },
  { key: 'courtMgmt', icon: 'grid', comp: Courts },
  { key: 'bookingMgmt', icon: 'calendar', comp: Bookings },
  { key: 'promoMgmt', icon: 'tag', comp: Promos },
  { key: 'memberMgmt', icon: 'users', comp: Members },
  { key: 'analytics', icon: 'trend', comp: Analytics },
  { key: 'settings', icon: 'gear', comp: Settings },
]

const ADMIN_ERR = {
  notadmin: { th: 'บัญชีนี้ไม่มีสิทธิ์ผู้ดูแล', en: 'This account is not an admin' },
  badpass: { th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', en: 'Wrong email or password' },
  notfound: { th: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', en: 'Wrong email or password' },
  toomany: { th: 'พยายามหลายครั้งเกินไป — ลองใหม่ภายหลัง', en: 'Too many attempts — try later' },
  network: { th: 'เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ต', en: 'Network error' },
  notconfigured: { th: 'ยังไม่ได้ตั้งค่า Firebase', en: 'Firebase not configured' },
  unknown: { th: 'เกิดข้อผิดพลาด — ลองใหม่อีกครั้ง', en: 'Something went wrong' },
}

export default function AdminApp({ goUser }) {
  const { lang, switchLang, isAdmin, adminLogin, adminLogout } = useStore()
  const [screen, setScreen] = useState('dashboard')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  if (!isAdmin) {
    const submit = async (e) => {
      e.preventDefault()
      setBusy(true)
      const r = await adminLogin(email, pass)
      setBusy(false)
      if (r.error) setErr(r.error)
    }
    return (
      <div className="u-shell" style={{ paddingBottom: 0 }}>
        <div className="page" style={{ paddingTop: 64 }}>
          <div className="card-pine pad-6 tc">
            <div style={{ fontSize: 40 }}>🏓</div>
            <h2 style={{ color: 'var(--lime)', fontSize: 20 }}>{t('adminTitle', lang)}</h2>
            <p className="tiny mt-1" style={{ color: 'var(--cream)' }}>{t('adminLogin', lang)}</p>
            <form className="mt-4 col gap-2" onSubmit={submit}>
              <input className="input" type="email" placeholder="admin@email.com"
                value={email} onChange={(e) => { setEmail(e.target.value); setErr(null) }} autoFocus autoComplete="username" />
              <input className="input" type="password" placeholder={t('adminPass', lang)}
                value={pass} onChange={(e) => { setPass(e.target.value); setErr(null) }} autoComplete="current-password" />
              {err && <div className="chip chip-red mt-1">✕ {ADMIN_ERR[err]?.[lang] ?? err}</div>}
              <button className="btn btn-lime btn-full btn-lg mt-2" type="submit" disabled={busy || !email || !pass}>
                {busy ? '…' : t('adminLogin', lang)}
              </button>
            </form>
            <button className="btn btn-ghost btn-sm mt-4" style={{ color: 'var(--cream)' }} onClick={goUser}>
              ← {t('goUserSite', lang)}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const Comp = SCREENS.find((s) => s.key === screen).comp

  return (
    <div className="a-shell">
      <aside className="a-side">
        <div className="u-logo">
          <span style={{ fontSize: 20 }}>🏓</span>
          <span>BOUNCE<small>ADMIN PANEL</small></span>
        </div>
        {SCREENS.map((s) => (
          <button key={s.key} className={`a-nav-btn ${screen === s.key ? 'on' : ''}`} onClick={() => setScreen(s.key)}>
            <Icon name={s.icon} size={18} /> {t(s.key, lang)}
          </button>
        ))}
        <div className="flex-1" />
        <div className="lang-toggle" style={{ alignSelf: 'flex-start', marginLeft: 8 }}>
          <button className={lang === 'th' ? 'on' : ''} onClick={() => switchLang('th')}>TH</button>
          <button className={lang === 'en' ? 'on' : ''} onClick={() => switchLang('en')}>EN</button>
        </div>
        <button className="a-nav-btn" onClick={goUser}>↗ {t('goUserSite', lang)}</button>
        <button className="a-nav-btn" onClick={adminLogout}>⎋ {t('logout', lang)}</button>
      </aside>

      <main className="a-main">
        <Comp />
      </main>

      <nav className="a-mobilenav">
        {SCREENS.map((s) => (
          <button key={s.key} className={screen === s.key ? 'on' : ''} onClick={() => setScreen(s.key)}>
            <Icon name={s.icon} size={17} />
            {t(s.key, lang)}
          </button>
        ))}
      </nav>
    </div>
  )
}
