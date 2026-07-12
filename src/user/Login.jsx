import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'
import { Icon } from '../components/ui.jsx'

const LineLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.3 8.3 8 .3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.5 6-3.6 8.2-6.1C21.7 14.2 22 12.7 22 11.1 22 6.6 17.5 3 12 3zM8.7 13.6H6.6a.5.5 0 01-.5-.5V9.4a.5.5 0 011 0v3.2h1.6a.5.5 0 010 1zm1.8-.5a.5.5 0 01-1 0V9.4a.5.5 0 011 0v3.7zm4.5 0a.5.5 0 01-.9.3l-1.9-2.6v2.3a.5.5 0 01-1 0V9.4a.5.5 0 01.9-.3l1.9 2.6V9.4a.5.5 0 011 0v3.7zm3.2-2.4a.5.5 0 010 1h-1.6v.9h1.6a.5.5 0 010 1h-2.1a.5.5 0 01-.5-.5V9.4a.5.5 0 01.5-.5h2.1a.5.5 0 010 1h-1.6v.8h1.6z"/>
  </svg>
)
const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0012 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 010-4.2V7.06H2.18a11 11 0 000 9.88l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0012 1 11 11 0 002.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
)

// demo inbox: shows the OTP that a real system would email
const DemoInbox = ({ otp, lang }) => (
  <div className="card-flat pad-3 mt-3" style={{ background: '#FCF0DC', borderStyle: 'dashed' }}>
    <div className="tiny" style={{ color: '#A86A12' }}>
      📬 {lang === 'th'
        ? 'Demo: ระบบจริงจะส่งรหัสนี้เข้า Email ของคุณ'
        : 'Demo: a real system emails you this code'}
    </div>
    <div className="num tc" style={{ fontSize: 28, letterSpacing: 6, color: '#A86A12' }}>{otp}</div>
  </div>
)

// top-level so React keeps input identity across renders (inline definition
// would remount the input on every keystroke and drop focus)
const Field = ({ label, type = 'text', value, onChange, placeholder, maxLength = 60 }) => (
  <div>
    <label className="label">{label}</label>
    <input className="input" type={type} value={value} onChange={onChange}
      placeholder={placeholder} maxLength={maxLength} autoComplete="off" />
  </div>
)

const ERR = {
  bademail: { th: 'รูปแบบ Email ไม่ถูกต้อง', en: 'Invalid email format' },
  shortpass: { th: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร', en: 'Password must be at least 8 characters' },
  exists: { th: 'Email นี้ถูกใช้แล้ว — ลองเข้าสู่ระบบ', en: 'Email already registered — try logging in' },
  badcode: { th: 'รหัสยืนยันไม่ถูกต้อง', en: 'Wrong verification code' },
  notfound: { th: 'ไม่พบบัญชีนี้ หรือยังไม่ยืนยัน Email', en: 'Account not found or not verified' },
  badpass: { th: 'รหัสผ่านไม่ถูกต้อง', en: 'Wrong password' },
  suspended: { th: 'บัญชีนี้ถูกระงับ — ติดต่อเจ้าหน้าที่', en: 'Account suspended — contact staff' },
  mismatch: { th: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน', en: 'Passwords do not match' },
}

export default function Login({ onDone }) {
  const { lang, login, registerEmail, verifyEmail, loginEmail, requestReset, confirmReset } = useStore()
  const [mode, setMode] = useState('menu') // menu | elogin | eregister | everify | ereset | eresetcode
  const [f, setF] = useState({ name: '', email: '', pass: '', pass2: '', code: '' })
  const [err, setErr] = useState(null)
  const [otp, setOtp] = useState(null)
  const [busy, setBusy] = useState(false)

  const th = lang === 'th'
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErr(null) }
  const social = (channel) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    login(channel); onDone()
  }
  const run = async (fn) => { setBusy(true); const r = await fn(); setBusy(false); return r }

  const doRegister = async () => {
    if (f.pass !== f.pass2) { setErr('mismatch'); return }
    const r = await run(() => registerEmail(f.name, f.email, f.pass))
    if (r.error) setErr(r.error)
    else { setOtp(r.otp); setMode('everify') }
  }
  const doVerify = () => {
    const r = verifyEmail(f.email, f.code)
    if (r.error) setErr(r.error)
    else onDone()
  }
  const doLogin = async () => {
    const r = await run(() => loginEmail(f.email, f.pass))
    if (r.error) setErr(r.error)
    else onDone()
  }
  const doReqReset = () => {
    const r = requestReset(f.email)
    if (r.error) setErr(r.error)
    else { setOtp(r.otp); setMode('eresetcode') }
  }
  const doConfirmReset = async () => {
    if (f.pass !== f.pass2) { setErr('mismatch'); return }
    const r = await run(() => confirmReset(f.email, f.code, f.pass))
    if (r.error) setErr(r.error)
    else { setMode('elogin'); setErr(null); setF((x) => ({ ...x, pass: '', pass2: '', code: '' })) }
  }

  const errChip = err && <div className="chip chip-red mt-2">✕ {ERR[err]?.[lang] ?? err}</div>
  const backBtn = (to) => (
    <button className="btn btn-ghost btn-sm" onClick={() => { setMode(to); setErr(null) }}>
      <Icon name="chevL" size={14} /> {t('back', lang)}
    </button>
  )

  return (
    <div className="page" style={{ paddingTop: 28 }}>
      <div className="tc">
        <div className="success-ball" style={{ animation: 'none' }}>🏓</div>
        <h2 className="mt-4" style={{ fontSize: 22 }}>{t('loginTitle', lang)}</h2>
        <p className="tiny mt-2">{t('appName', lang)}</p>
      </div>

      {mode === 'menu' && (
        <div className="col gap-3 mt-6">
          <button className="btn btn-line btn-lg btn-full" onClick={() => social('line')}>
            <LineLogo /> {t('loginLine', lang)}
          </button>
          <div className="tc tiny">{t('loginHintTh', lang)}</div>
          <button className="btn btn-google btn-lg btn-full" onClick={() => social('google')}>
            <GoogleLogo /> {t('loginGoogle', lang)}
          </button>
          <div className="tc tiny">{t('loginHintEn', lang)}</div>
          <button className="btn btn-lg btn-full" onClick={() => setMode('elogin')}>
            ✉️ {t('loginEmail', lang)}
          </button>
        </div>
      )}

      {mode === 'elogin' && (
        <div className="col gap-3 mt-5">
          {backBtn('menu')}
          <Field label="Email" type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" />
          <Field label={th ? 'รหัสผ่าน' : 'Password'} type="password" value={f.pass} onChange={set('pass')} maxLength={64} />
          {errChip}
          <button className="btn btn-lime btn-lg btn-full" onClick={doLogin} disabled={busy || !f.email || !f.pass}>
            {th ? 'เข้าสู่ระบบ' : 'Log in'}
          </button>
          <div className="row between">
            <button className="btn btn-ghost btn-sm" onClick={() => { setMode('eregister'); setErr(null) }}>
              {th ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'No account? Sign up'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setMode('ereset'); setErr(null) }}>
              {th ? 'ลืมรหัสผ่าน?' : 'Forgot password?'}
            </button>
          </div>
        </div>
      )}

      {mode === 'eregister' && (
        <div className="col gap-3 mt-5">
          {backBtn('elogin')}
          <Field label={th ? 'ชื่อ - นามสกุล' : 'Full name'} value={f.name} onChange={set('name')} placeholder={th ? 'ชื่อของคุณ' : 'Your name'} />
          <Field label="Email" type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" />
          <Field label={th ? 'รหัสผ่าน (อย่างน้อย 8 ตัว)' : 'Password (min 8 chars)'} type="password" value={f.pass} onChange={set('pass')} maxLength={64} />
          <Field label={th ? 'ยืนยันรหัสผ่าน' : 'Confirm password'} type="password" value={f.pass2} onChange={set('pass2')} maxLength={64} />
          {errChip}
          <button className="btn btn-lime btn-lg btn-full" onClick={doRegister}
            disabled={busy || !f.name || !f.email || !f.pass || !f.pass2}>
            {th ? 'สมัครสมาชิก' : 'Sign up'}
          </button>
        </div>
      )}

      {mode === 'everify' && (
        <div className="col gap-3 mt-5">
          {backBtn('eregister')}
          <p style={{ fontSize: 14.5 }}>
            {th ? `กรอกรหัสยืนยัน 6 หลักที่ส่งไปที่ ` : 'Enter the 6-digit code sent to '}<b>{f.email}</b>
          </p>
          {otp && <DemoInbox otp={otp} lang={lang} />}
          <Field label={th ? 'รหัสยืนยัน' : 'Verification code'} value={f.code} onChange={set('code')} placeholder="000000" maxLength={6} />
          {errChip}
          <button className="btn btn-lime btn-lg btn-full" onClick={doVerify} disabled={f.code.length !== 6}>
            {th ? 'ยืนยัน Email' : 'Verify email'}
          </button>
        </div>
      )}

      {mode === 'ereset' && (
        <div className="col gap-3 mt-5">
          {backBtn('elogin')}
          <p style={{ fontSize: 14.5 }}>{th ? 'กรอก Email ที่ใช้สมัคร เพื่อรับรหัสรีเซ็ต' : 'Enter your account email to receive a reset code'}</p>
          <Field label="Email" type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" />
          {errChip}
          <button className="btn btn-lime btn-lg btn-full" onClick={doReqReset} disabled={!f.email}>
            {th ? 'ส่งรหัสรีเซ็ต' : 'Send reset code'}
          </button>
        </div>
      )}

      {mode === 'eresetcode' && (
        <div className="col gap-3 mt-5">
          {backBtn('ereset')}
          {otp && <DemoInbox otp={otp} lang={lang} />}
          <Field label={th ? 'รหัสรีเซ็ต 6 หลัก' : '6-digit reset code'} value={f.code} onChange={set('code')} placeholder="000000" maxLength={6} />
          <Field label={th ? 'รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)' : 'New password (min 8 chars)'} type="password" value={f.pass} onChange={set('pass')} maxLength={64} />
          <Field label={th ? 'ยืนยันรหัสผ่านใหม่' : 'Confirm new password'} type="password" value={f.pass2} onChange={set('pass2')} maxLength={64} />
          {errChip}
          <button className="btn btn-lime btn-lg btn-full" onClick={doConfirmReset}
            disabled={busy || f.code.length !== 6 || !f.pass || !f.pass2}>
            {th ? 'ตั้งรหัสผ่านใหม่' : 'Set new password'}
          </button>
        </div>
      )}
    </div>
  )
}
