import React, { useEffect, useState } from 'react'
import { useStore } from '../store.jsx'
import { t, fmtDate, fmtDateYear } from '../i18n.js'
import { StampCard, ChannelChip, Icon, AvatarGlyph, Modal } from '../components/ui.jsx'
import { LegalHtml } from '../components/LegalHtml.jsx'
import { legalHasText, pickLegal } from '../legalHtml.js'
import { formatAccountNo, hasContactPhone, isoDay, voucherUsedDayMap, voucherExpired } from '../data/index.js'

const usedOnLabel = (day, lang) => (
  day ? t('voucherUsedOn', lang, { d: fmtDateYear(day, lang) }) : t('voucherUsedPlain', lang)
)

const expiryLabel = (v, lang) => {
  const day = isoDay(v.expiry)
  if (!day) return t('voucherNoExpiry', lang)
  return voucherExpired(v)
    ? t('voucherExpiredOn', lang, { d: fmtDateYear(day, lang) })
    : t('voucherValidUntil', lang, { d: fmtDateYear(day, lang) })
}

export default function Membership({ onUseVoucher }) {
  const { lang, user, vouchers, bookings, stampLog, logout, settings, saveMyPhone } = useStore()
  const myVouchers = vouchers.filter((v) => v.userId === user.id && !v.revoked)
  const usedDay = voucherUsedDayMap(myVouchers, bookings)
  const readyCodes = myVouchers
    .filter((v) => !v.used && !voucherExpired(v))
    .sort((a, b) => String(a.expiry || '9999').localeCompare(String(b.expiry || '9999'))
      || String(b.issued || '').localeCompare(String(a.issued || '')))
  const historyDay = (v) => (v.used ? usedDay.get(v.id) || '' : isoDay(v.expiry))
  const usedCodes = myVouchers
    .filter((v) => v.used || voucherExpired(v))
    .sort((a, b) => historyDay(b).localeCompare(historyDay(a)))
  const myLog = stampLog.filter((s) => s.userId === user.id)
  const payTerms = pickLegal(settings, 'payTerms', lang)
  const appTerms = pickLegal(settings, 'appTerms', lang)
  const [tab, setTab] = useState('history')
  const [codeTab, setCodeTab] = useState('ready')
  const [phone, setPhone] = useState(user.phone || '')
  const [phoneMsg, setPhoneMsg] = useState(null)
  const [phoneBusy, setPhoneBusy] = useState(false)
  const [editingPhone, setEditingPhone] = useState(false)
  const [askEdit, setAskEdit] = useState(false)
  const phoneSaved = hasContactPhone(user.phone)
  useEffect(() => { setPhone(user.phone || '') }, [user.phone])

  const savePhone = async () => {
    setPhoneBusy(true)
    setPhoneMsg(null)
    const r = await saveMyPhone(phone)
    setPhoneBusy(false)
    if (r?.error) {
      setPhoneMsg('bad')
      return
    }
    setPhoneMsg('ok')
    setEditingPhone(false)
  }

  const cancelPhoneEdit = () => {
    setPhone(user.phone || '')
    setPhoneMsg(null)
    setEditingPhone(false)
  }

  const startPhoneEdit = () => {
    setAskEdit(false)
    setPhone(user.phone || '')
    setPhoneMsg(null)
    setEditingPhone(true)
  }

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
            {user.accountNo ? <div className="acct-no" style={{ color: 'var(--lime)' }}>{formatAccountNo(user.accountNo)}</div> : null}
            <div className="tiny" style={{ color: 'var(--cream)', opacity: 0.8 }}>{user.email}</div>
            <div className="tiny mt-1" style={{ color: 'var(--cream)' }}>
              {t('bookingsPerYear', lang)}: <b>{user.bookingsYear}</b>
            </div>
          </div>
        </div>
      </div>

      <div className="card pad-4 mt-4">
        {phoneSaved && !editingPhone ? (
          <div className="row between gap-3">
            <div className="flex-1">
              <div className="label" style={{ marginBottom: 0 }}>{t('phoneLabel', lang)}</div>
              <div className="num mt-1" style={{ fontSize: 20 }}>{user.phone}</div>
            </div>
            <button type="button" className="btn" style={{ minHeight: 44 }}
              aria-label={t('edit', lang)} onClick={() => setAskEdit(true)}>
              <Icon name="pencil" size={16} /> {t('edit', lang)}
            </button>
          </div>
        ) : (
          <>
            <label className="label" htmlFor="callback-phone">{t('phoneLabel', lang)}</label>
            <p className="tiny mt-1">{t('phoneHint', lang)}</p>
            <input id="callback-phone" className="input mt-2" type="tel" inputMode="numeric" maxLength={15}
              autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneMsg(null) }}
              placeholder="0812345678" />
            {phoneMsg === 'bad' && <div className="chip chip-red mt-2">{t('badPhone', lang)}</div>}
            {!phoneSaved && phoneMsg !== 'bad' && (
              <p className="tiny mt-2">{t('profileIncompleteBody', lang)}</p>
            )}
            {phoneSaved ? (
              <div className="row gap-2 mt-3">
                <button type="button" className="btn flex-1" style={{ minHeight: 44 }}
                  disabled={phoneBusy} onClick={cancelPhoneEdit}>
                  {t('cancel', lang)}
                </button>
                <button type="button" className="btn btn-lime flex-1" style={{ minHeight: 44 }}
                  disabled={phoneBusy || !phone.trim()} onClick={savePhone}>
                  {t('save', lang)}
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-lime btn-full mt-3" style={{ minHeight: 44 }}
                disabled={phoneBusy || !phone.trim()} onClick={savePhone}>
                {t('savePhone', lang)}
              </button>
            )}
          </>
        )}
        {phoneSaved && !editingPhone && phoneMsg === 'ok' && (
          <div className="chip chip-green mt-2">{t('phoneSaved', lang)}</div>
        )}
      </div>

      {askEdit && (
        <Modal onClose={() => setAskEdit(false)}>
          <h3 style={{ fontSize: 18 }}>{t('phoneEditTitle', lang)}</h3>
          <p className="mt-2" style={{ fontSize: 14.5, lineHeight: 1.45 }}>{t('phoneEditBody', lang)}</p>
          <div className="row gap-2 mt-4">
            <button type="button" className="btn flex-1" style={{ minHeight: 44 }} onClick={() => setAskEdit(false)}>
              {t('cancel', lang)}
            </button>
            <button type="button" className="btn btn-lime flex-1" style={{ minHeight: 44 }} onClick={startPhoneEdit}>
              {t('edit', lang)}
            </button>
          </div>
        </Modal>
      )}

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
      <div className="tabs tabs-split mt-2" role="tablist">
        <button type="button" role="tab" aria-selected={codeTab === 'ready'}
          className={`tab ${codeTab === 'ready' ? 'on' : ''}`}
          onClick={() => setCodeTab('ready')}>
          {t('voucherTabReady', lang)}{readyCodes.length ? ` ${readyCodes.length}` : ''}
        </button>
        <button type="button" role="tab" aria-selected={codeTab === 'used'}
          className={`tab ${codeTab === 'used' ? 'on' : ''}`}
          onClick={() => setCodeTab('used')}>
          {t('voucherTabUsed', lang)}{usedCodes.length ? ` ${usedCodes.length}` : ''}
        </button>
      </div>
      <div className="col gap-3 mt-3">
        {codeTab === 'ready' && readyCodes.length === 0 && (
          <div className="card-flat pad-4 tc tiny">{usedCodes.length === 0 ? t('noVouchers', lang) : t('noReadyVouchers', lang)}</div>
        )}
        {codeTab === 'used' && usedCodes.length === 0 && (
          <div className="card-flat pad-4 tc tiny">{t('noUsedVouchers', lang)}</div>
        )}
        {(codeTab === 'ready' ? readyCodes : usedCodes).map((v) => {
          const done = v.used || voucherExpired(v)
          const issued = isoDay(v.issued)
          return (
          <div key={v.id} className={`ticket ${done ? 'used' : ''}`}>
            <div className="ticket-left">{t('free', lang)}</div>
            <div className="pad-4 flex-1">
              <strong style={{ fontFamily: 'var(--font-display)' }}>{t('voucherFreeBooking', lang)}</strong>
              {v.used && (
                <div className="tiny mt-1" style={{ fontWeight: 700, color: 'var(--ink-2)' }}>
                  {usedOnLabel(usedDay.get(v.id) || isoDay(v.usedAt), lang)}
                </div>
              )}
              <div className="voucher-dates mt-1">
                {issued && <span>{t('voucherIssuedOn', lang, { d: fmtDateYear(issued, lang) })}</span>}
                <span className={!v.used && voucherExpired(v) ? 'is-expired' : ''}>{expiryLabel(v, lang)}</span>
                {!done && <span>{t('voucherAnyHour', lang)}</span>}
              </div>
              {!done && (
                <button type="button" className="btn btn-lime btn-full mt-3" style={{ minHeight: 44 }}
                  onClick={() => onUseVoucher?.(v.id)}>
                  {t('tapUseCode', lang)}
                </button>
              )}
            </div>
          </div>
          )
        })}
      </div>

      <div className="tabs tabs-split mt-6" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'history'}
          className={`tab ${tab === 'history' ? 'on' : ''}`}
          onClick={() => setTab('history')}>
          {t('profileTabHistory', lang)}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'terms'}
          className={`tab ${tab === 'terms' ? 'on' : ''}`}
          onClick={() => setTab('terms')}>
          {t('profileTabTerms', lang)}
        </button>
      </div>

      {tab === 'history' && (
        <div className="card-flat mt-2">
          {myLog.length === 0 && <div className="pad-4 tc tiny">{t('noStampHistory', lang)}</div>}
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
      )}

      {tab === 'terms' && (
        <div className="card-flat mt-2 pad-4 col gap-4">
          {legalHasText(appTerms) && (
            <div>
              <h3 style={{ fontSize: 15 }}>{t('appTermsTitle', lang)}</h3>
              <div className="mt-2"><LegalHtml html={appTerms} /></div>
            </div>
          )}
          {/* {legalHasText(payTerms) && (
            <div>
              <h3 style={{ fontSize: 15 }}>{t('payTermsTitle', lang)}</h3>
              <div className="mt-2"><LegalHtml html={payTerms} /></div>
            </div>
          )} */}
          {!legalHasText(appTerms) && !legalHasText(payTerms) && (
            <div className="tc tiny">{t('noTermsYet', lang)}</div>
          )}
        </div>
      )}

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
