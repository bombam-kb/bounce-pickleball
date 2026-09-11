import React, { useState, useEffect, useRef } from 'react'
import { t } from '../i18n.js'
import { legalHasText, sanitizeLegalHtml } from '../legalHtml.js'
import { Modal } from './ui.jsx'

export function LegalHtml({ html }) {
  const safe = sanitizeLegalHtml(html)
  if (!legalHasText(safe)) return null
  return <div className="legal-html" dangerouslySetInnerHTML={{ __html: safe }} />
}

/** Must scroll the terms to the end before Accept is enabled. */
export function TermsReadGate({ html, title, lang, onAccept, onClose }) {
  const [atEnd, setAtEnd] = useState(false)
  const scroller = useRef(null)

  const measure = () => {
    const el = scroller.current
    if (!el) return
    const leftover = el.scrollHeight - el.scrollTop - el.clientHeight
    if (leftover <= 16) setAtEnd(true)
  }

  useEffect(() => {
    setAtEnd(false)
    const el = scroller.current
    if (!el) return
    const id = requestAnimationFrame(measure)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => {
      cancelAnimationFrame(id)
      ro?.disconnect()
    }
  }, [html])

  return (
    <Modal onClose={onClose} className="legal-gate-back">
      <h3 style={{ fontSize: 18 }}>{title}</h3>
      <p className="tiny mt-2">{atEnd ? t('termsReadyToAccept', lang) : t('scrollTermsHint', lang)}</p>
      <div
        ref={scroller}
        className="legal-read-scroller mt-3"
        onScroll={measure}
      >
        <LegalHtml html={html} />
      </div>
      <button
        type="button"
        className="btn btn-lime btn-full btn-lg"
        disabled={!atEnd}
        onClick={onAccept}
      >
        {t('acceptTerms', lang)}
      </button>
    </Modal>
  )
}

/** Checkbox + “read” link that opens the terms in a modal. Hidden when empty. */
export function TermsAccept({
  html, title, checked, onChange, lang, disabled = false,
}) {
  const [open, setOpen] = useState(false)
  if (!legalHasText(html)) return null
  return (
    <>
      <label className="legal-accept">
        <input
          type="checkbox"
          checked={!!checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>
          {t('termsAcceptLead', lang)}{' '}
          <button type="button" className="legal-accept-link" onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }}>
            {title}
          </button>
        </span>
      </label>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <h3 style={{ fontSize: 18 }}>{title}</h3>
          <div className="legal-modal-body mt-3">
            <LegalHtml html={html} />
          </div>
        </Modal>
      )}
    </>
  )
}
