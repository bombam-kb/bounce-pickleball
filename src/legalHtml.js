/** Allowed marks for shop-written terms: line breaks, bold, underline. No fonts. */
export const LEGAL_MAX_CHARS = 20000

const BLOCK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'blockquote'])
const TO_B = new Set(['b', 'strong'])

const escapeText = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

function walk(node) {
  if (node.nodeType === 3) return escapeText(node.nodeValue)
  if (node.nodeType !== 1) return ''
  const tag = node.tagName.toLowerCase()
  if (tag === 'br') return '<br>'
  if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object') return ''
  const inner = Array.from(node.childNodes).map(walk).join('')
  if (TO_B.has(tag)) return inner ? `<b>${inner}</b>` : ''
  if (tag === 'u' || tag === 'ins') return inner ? `<u>${inner}</u>` : ''
  if (tag === 'span' || tag === 'font') {
    const style = `${node.getAttribute('style') || ''} ${node.getAttribute('face') || ''}`.toLowerCase()
    let out = inner
    if (/font-weight\s*:\s*(bold|[7-9]00)/.test(style)) out = out ? `<b>${out}</b>` : ''
    if (/text-decoration[^;]*underline/.test(style)) out = out ? `<u>${out}</u>` : ''
    return out
  }
  if (BLOCK.has(tag)) return inner ? `${inner}<br>` : '<br>'
  return inner
}

/** Strip everything except `<b>`, `<u>`, and `<br>`. Drops font/size/color/links. */
export function sanitizeLegalHtml(raw) {
  const input = String(raw || '').slice(0, LEGAL_MAX_CHARS)
  if (!input.trim()) return ''
  if (typeof DOMParser === 'undefined') {
    return escapeText(input.replace(/<[^>]*>/g, ''))
  }
  const doc = new DOMParser().parseFromString(`<div id="legal-root">${input}</div>`, 'text/html')
  const root = doc.getElementById('legal-root')
  if (!root) return ''
  return Array.from(root.childNodes).map(walk).join('')
    .replace(/(<br>\s*){3,}/g, '<br><br>')
    .replace(/^(<br>)+|(<br>)+$/g, '')
    .trim()
}

export function legalHasText(html) {
  return sanitizeLegalHtml(html)
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim().length > 0
}

/** `kind` is `payTerms` or `appTerms`. Uses the UI language; falls back only if that copy is empty. */
export function pickLegal(settings, kind, lang) {
  const th = settings?.[`${kind}Th`] || ''
  const en = settings?.[`${kind}En`] || ''
  const preferred = lang === 'en' ? en : th
  const fallback = lang === 'en' ? th : en
  return sanitizeLegalHtml(legalHasText(preferred) ? preferred : fallback)
}
