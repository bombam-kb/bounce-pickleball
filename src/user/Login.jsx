import React, { useState } from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'
import { Icon } from '../components/ui.jsx'

const LineLogo = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.5 7.3 8.3 8 .3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.5 6-3.6 8.2-6.1C21.7 14.2 22 12.7 22 11.1 22 6.6 17.5 3 12 3zM8.7 13.6H6.6a.5.5 0 01-.5-.5V9.4a.5.5 0 011 0v3.2h1.6a.5.5 0 010 1zm1.8-.5a.5.5 0 01-1 0V9.4a.5.5 0 011 0v3.7zm4.5 0a.5.5 0 01-.9.3l-1.9-2.6v2.3a.5.5 0 01-1 0V9.4a.5.5 0 01.9-.3l1.9 2.6V9.4a.5.5 0 011 0v3.7zm3.2-2.4a.5.5 0 010 1h-1.6v.9h1.6a.5.5 0 010 1h-2.1a.5.5 0 01-.5-.5V9.4a.5.5 0 01.5-.5h2.1a.5.5 0 010 1h-1.6v.8h1.6z"/>
  </svg>
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
  notfound: { th: 'ไม่พบบัญชีนี้', en: 'Account not found' },
  badpass: { th: 'Email หรือรหัสผ่านไม่ถูกต้อง', en: 'Wrong email or password' },
  notverified: { th: 'ยังไม่ได้ยืนยัน Email — เช็คลิงก์ในกล่องจดหมาย', en: 'Email not verified yet — check your inbox for the link' },
  suspended: { th: 'บัญชีนี้ถูกระงับ — ติดต่อเจ้าหน้าที่', en: 'Account suspended — contact staff' },
  mismatch: { th: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน', en: 'Passwords do not match' },
  toomany: { th: 'พยายามหลายครั้งเกินไป — ลองใหม่ภายหลัง', en: 'Too many attempts — try again later' },
  network: { th: 'เชื่อมต่อไม่ได้ — ตรวจสอบอินเทอร์เน็ต', en: 'Network error — check your connection' },
  notconfigured: { th: 'ยังไม่ได้ตั้งค่า Firebase — ดู FIREBASE_SETUP.md', en: 'Firebase not configured — see FIREBASE_SETUP.md' },
  unknown: { th: 'เกิดข้อผิดพลาด — ลองใหม่อีกครั้ง', en: 'Something went wrong — please try again' },
}

// generic "check your email" confirmation panel
const CheckMail = ({ title, body, email }) => (
  <div className="card-flat pad-4 mt-2 tc" style={{ background: '#FCF0DC', borderStyle: 'dashed' }}>
    <div style={{ fontSize: 34 }}>📬</div>
    <div className="mt-2" style={{ fontWeight: 700 }}>{title}</div>
    <div className="tiny mt-2" style={{ color: '#A86A12' }}>{body}</div>
    <div className="mt-2" style={{ fontWeight: 700, wordBreak: 'break-all' }}>{email}</div>
  </div>
)

export default function Login({ onDone }) {
  const { lang, login, registerEmail, loginEmail, requestReset, resendVerification } = useStore()
  const [mode, setMode] = useState('menu') // menu | elogin | eregister | echeck | ereset | eresetsent
  const [f, setF] = useState({ name: '', email: '', pass: '', pass2: '' })
  const [err, setErr] = useState(null)
  const [note, setNote] = useState(null)
  const [busy, setBusy] = useState(false)

  const th = lang === 'th'
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErr(null); setNote(null) }
  const social = (channel) => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
    login(channel); onDone()
  }
  const run = async (fn) => { setBusy(true); const r = await fn(); setBusy(false); return r }
  const goto = (to) => { setMode(to); setErr(null); setNote(null) }

  const doRegister = async () => {
    if (f.pass !== f.pass2) { setErr('mismatch'); return }
    const r = await run(() => registerEmail(f.name, f.email, f.pass))
    if (r.error) setErr(r.error)
    else setMode('echeck')
  }
  const doLogin = async () => {
    const r = await run(() => loginEmail(f.email, f.pass))
    if (r.error) setErr(r.error)
    else onDone()
  }
  const doReqReset = async () => {
    const r = await run(() => requestReset(f.email))
    if (r.error) setErr(r.error)
    else setMode('eresetsent')
  }
  const doResend = async () => {
    const r = await run(() => resendVerification(f.email, f.pass))
    if (r.error) setErr(r.error)
    else if (r.alreadyVerified) { setNote(th ? 'ยืนยันแล้ว — เข้าสู่ระบบได้เลย' : 'Already verified — you can log in'); setMode('elogin') }
    else setNote(th ? 'ส่งลิงก์ยืนยันอีกครั้งแล้ว' : 'Verification link sent again')
  }

  const errChip = err && <div className="chip chip-red mt-2">✕ {ERR[err]?.[lang] ?? err}</div>
  const noteChip = note && <div className="chip chip-lime mt-2">✓ {note}</div>
  const backBtn = (to) => (
    <button className="btn btn-ghost btn-sm" onClick={() => goto(to)}>
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
          <button className="btn btn-lg btn-full" onClick={() => goto('elogin')}>
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
          {noteChip}
          <button className="btn btn-lime btn-lg btn-full" onClick={doLogin} disabled={busy || !f.email || !f.pass}>
            {th ? 'เข้าสู่ระบบ' : 'Log in'}
          </button>
          <div className="row between">
            <button className="btn btn-ghost btn-sm" onClick={() => goto('eregister')}>
              {th ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'No account? Sign up'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => goto('ereset')}>
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
            {busy ? (th ? 'กำลังสมัคร…' : 'Signing up…') : (th ? 'สมัครสมาชิก' : 'Sign up')}
          </button>
        </div>
      )}

      {mode === 'echeck' && (
        <div className="col gap-3 mt-5">
          {backBtn('elogin')}
          <CheckMail
            title={th ? 'ยืนยัน Email ของคุณ' : 'Verify your email'}
            body={th ? 'เราส่งลิงก์ยืนยันไปที่อีเมลนี้ กดลิงก์เพื่อยืนยัน แล้วกลับมาเข้าสู่ระบบ'
              : 'We sent a verification link to this address. Click it, then come back and log in.'}
            email={f.email}
          />
          {errChip}
          {noteChip}
          <button className="btn btn-lime btn-lg btn-full" onClick={() => goto('elogin')}>
            {th ? 'ฉันยืนยันแล้ว — เข้าสู่ระบบ' : "I've verified — log in"}
          </button>
          <button className="btn btn-ghost btn-sm btn-full" onClick={doResend} disabled={busy || !f.pass}>
            {th ? 'ส่งลิงก์ยืนยันอีกครั้ง' : 'Resend verification link'}
          </button>
        </div>
      )}

      {mode === 'ereset' && (
        <div className="col gap-3 mt-5">
          {backBtn('elogin')}
          <p style={{ fontSize: 14.5 }}>{th ? 'กรอก Email ที่ใช้สมัคร เพื่อรับลิงก์รีเซ็ตรหัสผ่าน' : 'Enter your account email to receive a password-reset link'}</p>
          <Field label="Email" type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" />
          {errChip}
          <button className="btn btn-lime btn-lg btn-full" onClick={doReqReset} disabled={busy || !f.email}>
            {busy ? (th ? 'กำลังส่ง…' : 'Sending…') : (th ? 'ส่งลิงก์รีเซ็ต' : 'Send reset link')}
          </button>
        </div>
      )}

      {mode === 'eresetsent' && (
        <div className="col gap-3 mt-5">
          {backBtn('elogin')}
          <CheckMail
            title={th ? 'ส่งลิงก์รีเซ็ตแล้ว' : 'Reset link sent'}
            body={th ? 'กดลิงก์ในอีเมลเพื่อตั้งรหัสผ่านใหม่ แล้วกลับมาเข้าสู่ระบบ'
              : 'Click the link in the email to set a new password, then log in.'}
            email={f.email}
          />
          <button className="btn btn-lime btn-lg btn-full" onClick={() => goto('elogin')}>
            {th ? 'กลับไปหน้าเข้าสู่ระบบ' : 'Back to log in'}
          </button>
        </div>
      )}
    </div>
  )
}
