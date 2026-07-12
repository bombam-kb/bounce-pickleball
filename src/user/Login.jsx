import React from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'

export default function Login({ onDone }) {
  const { lang, login } = useStore()
  const go = (channel) => { login(channel); onDone() }

  return (
    <div className="page" style={{ paddingTop: 40 }}>
      <div className="tc">
        <div className="success-ball" style={{ animation: 'none' }}>🏓</div>
        <h2 className="mt-4" style={{ fontSize: 22 }}>{t('loginTitle', lang)}</h2>
        <p className="tiny mt-2">{t('appName', lang)}</p>
      </div>

      <div className="col gap-3 mt-6">
        <button className="btn btn-line btn-lg btn-full" onClick={() => go('line')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.3 8.3 8 .3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.5 6-3.6 8.2-6.1C21.7 14.2 22 12.7 22 11.1 22 6.6 17.5 3 12 3zM8.7 13.6H6.6a.5.5 0 01-.5-.5V9.4a.5.5 0 011 0v3.2h1.6a.5.5 0 010 1zm1.8-.5a.5.5 0 01-1 0V9.4a.5.5 0 011 0v3.7zm4.5 0a.5.5 0 01-.9.3l-1.9-2.6v2.3a.5.5 0 01-1 0V9.4a.5.5 0 01.9-.3l1.9 2.6V9.4a.5.5 0 011 0v3.7zm3.2-2.4a.5.5 0 010 1h-1.6v.9h1.6a.5.5 0 010 1h-2.1a.5.5 0 01-.5-.5V9.4a.5.5 0 01.5-.5h2.1a.5.5 0 010 1h-1.6v.8h1.6z"/>
          </svg>
          {t('loginLine', lang)}
        </button>
        <div className="tc tiny">{t('loginHintTh', lang)}</div>

        <button className="btn btn-google btn-lg btn-full" onClick={() => go('google')}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/>
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0012 1 11 11 0 002.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          {t('loginGoogle', lang)}
        </button>
        <div className="tc tiny">{t('loginHintEn', lang)}</div>

        <button className="btn btn-lg btn-full" onClick={() => go('email')}>
          ✉️ {t('loginEmail', lang)}
        </button>
      </div>
    </div>
  )
}
