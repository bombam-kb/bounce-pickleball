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

export default function AdminApp({ goUser }) {
  const { lang, switchLang, adminAuthed, setAdminAuthed } = useStore()
  const [screen, setScreen] = useState('dashboard')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState(false)

  if (!adminAuthed) {
    return (
      <div className="u-shell" style={{ paddingBottom: 0 }}>
        <div className="page" style={{ paddingTop: 64 }}>
          <div className="card-pine pad-6 tc">
            <div style={{ fontSize: 40 }}>🏓</div>
            <h2 style={{ color: 'var(--lime)', fontSize: 20 }}>{t('adminTitle', lang)}</h2>
            <p className="tiny mt-1" style={{ color: 'var(--cream)' }}>{t('adminLogin', lang)}</p>
            <form className="mt-4" onSubmit={(e) => {
              e.preventDefault()
              if (pass === 'bounce') setAdminAuthed(true)
              else setErr(true)
            }}>
              <input className="input" type="password" placeholder={t('adminPass', lang)}
                value={pass} onChange={(e) => { setPass(e.target.value); setErr(false) }} autoFocus />
              {err && <div className="chip chip-red mt-2">✕ {t('wrongPass', lang)}</div>}
              <button className="btn btn-lime btn-full btn-lg mt-3" type="submit">{t('adminLogin', lang)}</button>
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
        <button className="a-nav-btn" onClick={() => setAdminAuthed(false)}>⎋ {t('logout', lang)}</button>
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
