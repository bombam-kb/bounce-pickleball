import React, { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'
import { finishLineLogin } from '../lineAuth.js'
import Logo from '../components/Logo.jsx'

const MSG = {
  th: {
    working: 'กำลังเข้าสู่ระบบด้วย LINE…',
    ok: 'สำเร็จ — กำลังพาคุณกลับหน้าหลัก',
    badstate: 'ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือหมดอายุ — ลองใหม่จากปุ่มเข้าสู่ระบบ (โหมดส่วนตัวอาจต้องกดใหม่)',
    line_denied: 'คุณยกเลิกการเข้าสู่ระบบ LINE',
    suspended: 'บัญชีนี้ถูกระงับ — ติดต่อเจ้าหน้าที่',
    notconfigured: 'ยังไม่ได้ตั้งค่า LINE / Firebase Admin — ดู FIREBASE_SETUP.md',
    line_token: 'แลก token จาก LINE ไม่สำเร็จ — ตรวจ Callback URL',
    badredirect: 'โดเมนนี้ยังไม่ได้รับอนุญาตให้เข้าสู่ระบบ LINE',
    line_id_token: 'ยืนยันตัวตนกับ LINE ไม่สำเร็จ — ลองใหม่',
    line_profile: 'อ่านโปรไฟล์ LINE ไม่สำเร็จ — ลองใหม่',
    too_many: 'พยายามหลายครั้งเกินไป — ลองใหม่ภายหลัง',
    unknown: 'เกิดข้อผิดพลาด — ลองใหม่อีกครั้ง',
  },
  en: {
    working: 'Signing in with LINE…',
    ok: 'Done — taking you home',
    badstate: 'Login link invalid or expired — tap Log in again (private browsing may need a retry)',
    line_denied: 'LINE login was cancelled',
    suspended: 'Account suspended — contact staff',
    notconfigured: 'LINE / Firebase Admin not configured — see FIREBASE_SETUP.md',
    line_token: 'LINE token exchange failed — check Callback URL',
    badredirect: 'This domain is not allowed for LINE login',
    line_id_token: 'LINE identity check failed — try again',
    line_profile: 'Could not read the LINE profile — try again',
    too_many: 'Too many attempts — try later',
    unknown: 'Something went wrong — please try again',
  },
}

export default function LineCallback() {
  const { lang, completeLineLogin } = useStore()
  const [status, setStatus] = useState('working') // working | ok | error
  const [err, setErr] = useState(null)
  const [detail, setDetail] = useState(null)
  const copy = MSG[lang] || MSG.th

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await finishLineLogin()
        if (cancelled) return
        const r = await completeLineLogin(token)
        if (cancelled) return
        if (r?.error) {
          setErr(r.error)
          setStatus('error')
          return
        }
        setStatus('ok')
        window.setTimeout(() => { window.location.replace('/') }, 600)
      } catch (e) {
        if (cancelled) return
        setErr(e?.code || 'unknown')
        setDetail(e?.message || null)
        setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [completeLineLogin])

  return (
    <div className="page" style={{ paddingTop: 48, textAlign: 'center', minHeight: '100dvh', background: '#fff' }}>
      <Logo variant="light" size="md" animate={status === 'working'} />
      <h2 className="mt-4" style={{ fontSize: 20 }}>
        {status === 'working' && copy.working}
        {status === 'ok' && copy.ok}
        {status === 'error' && (copy[err] || copy.unknown)}
      </h2>
      {status === 'error' && import.meta.env.DEV && detail && (
        <p className="tiny mt-3" style={{ color: 'var(--ink-3)', wordBreak: 'break-word' }}>{detail}</p>
      )}
      {status === 'error' && (
        <button className="btn btn-lime btn-lg mt-5" onClick={() => { window.location.replace('/') }}>
          {lang === 'th' ? 'กลับหน้าหลัก' : 'Back home'}
        </button>
      )}
    </div>
  )
}
