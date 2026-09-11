import React, { useEffect, useRef } from 'react'
import { t } from '../i18n.js'
import { sanitizeLegalHtml } from '../legalHtml.js'

function run(cmd) {
  try {
    document.execCommand('styleWithCSS', false, false)
    document.execCommand(cmd, false, null)
  } catch { /* ignore */ }
}

/**
 * Staff editor: Enter for new lines, Bold, Underline. Font is locked to the app body face.
 */
export default function LegalEditor({ value, onChange, lang }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (document.activeElement === el) return
    const next = sanitizeLegalHtml(value)
    if (el.innerHTML !== next) el.innerHTML = next
  }, [value])

  const emit = () => {
    const el = ref.current
    if (!el) return
    onChange(sanitizeLegalHtml(el.innerHTML))
  }

  const mark = (cmd) => (e) => {
    e.preventDefault()
    ref.current?.focus()
    run(cmd)
    emit()
  }

  const onPaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData?.getData('text/plain') || ''
    document.execCommand('insertText', false, text)
    emit()
  }

  const onKeyDown = (e) => {
    if (!(e.metaKey || e.ctrlKey)) return
    const k = e.key.toLowerCase()
    if (k === 'b') { e.preventDefault(); run('bold'); emit() }
    else if (k === 'u') { e.preventDefault(); run('underline'); emit() }
    else if (k === 'i') e.preventDefault()
  }

  return (
    <div className="legal-editor">
      <div className="legal-toolbar" role="toolbar" aria-label={t('legalToolbar', lang)}>
        <button type="button" className="legal-tool" aria-label={t('legalBold', lang)}
          title={t('legalBold', lang)} onMouseDown={mark('bold')}>
          <span className="legal-tool-b">B</span>
        </button>
        <button type="button" className="legal-tool" aria-label={t('legalUnderline', lang)}
          title={t('legalUnderline', lang)} onMouseDown={mark('underline')}>
          <span className="legal-tool-u">U</span>
        </button>
        <span className="tiny">{t('legalFmtHint', lang)}</span>
      </div>
      <div
        ref={ref}
        className="legal-canvas"
        contentEditable
        role="textbox"
        aria-multiline="true"
        spellCheck="true"
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onDrop={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}
