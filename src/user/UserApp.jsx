import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'
import { Icon, Modal } from '../components/ui.jsx'
import Logo from '../components/Logo.jsx'
import Home from './Home.jsx'
import Booking from './Booking.jsx'
import MyBookings from './MyBookings.jsx'
import Membership from './Membership.jsx'
import Login from './Login.jsx'

export default function UserApp() {
  const { lang, switchLang, user, notifications, markNotifsRead } = useStore()
  const [cartHost, setCartHost] = useState(null)
  const [screen, setScreen] = useState('home')   // home | booking | bookings | membership | login
  const [cart, setCart] = useState(null)         // { date, items: [{courtId, hour}] }
  const [afterLogin, setAfterLogin] = useState(null)
  const [notifOpen, setNotifOpen] = useState(false)
  const unread = notifications.filter((n) => !n.read).length

  const goCheckout = (c) => {
    setCart(c)
    window.scrollTo(0, 0)
    if (!user) { setAfterLogin('booking'); setScreen('login') }
    else setScreen('booking')
  }
  const nav = (key) => {
    if ((key === 'bookings' || key === 'membership') && !user) {
      setAfterLogin(key); setScreen('login'); return
    }
    setScreen(key)
  }

  const NAV = [
    { key: 'home', icon: 'ball', label: t('navHome', lang) },
    { key: 'bookings', icon: 'calendar', label: t('navBookings', lang) },
    { key: 'membership', icon: 'ticket', label: t('navMembership', lang) },
  ]

  return (
    <div className="u-shell">
      {screen !== 'login' && (
      <header className="u-head">
        <button type="button" className="u-logo-btn" onClick={() => setScreen('home')} aria-label="Bounce Pickleball House">
          <Logo variant="light" size="md" />
        </button>
        <div className="u-head-tools">
          {screen === 'booking' ? (
            <button className="btn btn-ghost btn-sm" onClick={() => { setCart(null); setScreen('home') }}>
              <Icon name="chevL" size={16} /> {t('back', lang)}
            </button>
          ) : user ? (
            <span className="u-hello">
              {lang === 'th' ? `สวัสดี ${user.name}` : `Hi ${user.name}`}
            </span>
          ) : (
            <span />
          )}
          <div className="u-head-tools-end">
            <div className="lang-toggle">
              <button className={lang === 'th' ? 'on' : ''} onClick={() => switchLang('th')}>TH</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => switchLang('en')}>EN</button>
            </div>
            {user && (
              <button className="bell-btn" aria-label="Notifications"
                onClick={() => { setNotifOpen(true) }}>
                <Icon name="bell" size={17} />
                {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
              </button>
            )}
            {!user && (
              <button className="btn btn-lime btn-sm" onClick={() => { setAfterLogin('home'); setScreen('login') }}>
                <Icon name="user" size={14} /> {lang === 'th' ? 'เข้าสู่ระบบ' : 'Log in'}
              </button>
            )}
          </div>
        </div>
      </header>
      )}

      {screen === 'home' && <Home onCheckout={goCheckout} cartHost={cartHost} />}
      {screen === 'booking' && cart && (
        <Booking cart={cart} onBack={() => setScreen('home')} onDone={() => { setCart(null); setScreen('bookings') }} />
      )}
      {screen === 'bookings' && user && <MyBookings />}
      {screen === 'membership' && user && <Membership />}
      {screen === 'login' && (
        <Login onDone={() => {
          window.scrollTo(0, 0)
          setScreen(afterLogin && afterLogin !== 'login' ? afterLogin : 'home')
        }} />
      )}

      {notifOpen && (
        <Modal onClose={() => { setNotifOpen(false); markNotifsRead() }}>
          <h3 style={{ fontSize: 18 }}>🔔 {lang === 'th' ? 'การแจ้งเตือน' : 'Notifications'}</h3>
          <div className="col mt-3" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {notifications.length === 0 && (
              <div className="tc tiny pad-6">{lang === 'th' ? 'ยังไม่มีการแจ้งเตือน' : 'No notifications yet'}</div>
            )}
            {notifications.map((n) => (
              <div key={n.id} className="row gap-2" style={{
                padding: '10px 4px', borderBottom: '1px solid #E3E1D5', alignItems: 'flex-start',
                opacity: n.read ? 0.65 : 1,
              }}>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--lime-deep)', marginTop: 7, flexShrink: 0 }} />}
                <div className="flex-1">
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</div>
                  <div className="tiny">{n.body}</div>
                  <div className="tiny num" style={{ opacity: 0.7 }}>{n.date?.replace('T', ' · ')}</div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      <div className="u-dock">
        <div className="u-dock-cart" ref={setCartHost} />
        <nav className="u-nav">
          <div className="u-nav-inner">
            {NAV.map((n) => (
              <button key={n.key} className={screen === n.key ? 'on' : ''} onClick={() => nav(n.key)}>
                <span className="nav-dot"><Icon name={n.icon} size={18} /></span>
                {n.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
