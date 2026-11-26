/** Liest Zahlen in deutscher Schreibweise: "8849", "8.849", "3,14", "1.234.567,8", "-12". */
export function parseNumber(input: string): number | null {
  let s = input.trim().replace(/[\s ']/g, '')
  if (!s) return null
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.500" = Tausenderpunkt
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 10 })

export function formatNumber(n: number): string {
  return numberFormat.format(n)
}

/** Zahl für ein Eingabefeld (ohne Tausenderpunkte, mit Komma). */
export function numberToInput(n: number | null): string {
  return n == null ? '' : String(n).replace('.', ',')
}

export function formatAnswer(q: { answer: number | null; answer_unit: string; answer_display: string }): string {
  if (q.answer_display.trim()) return q.answer_display.trim()
  if (q.answer == null) return ''
  return q.answer_unit.trim() ? `${formatNumber(q.answer)} ${q.answer_unit.trim()}` : formatNumber(q.answer)
}

/** "1:30" → 90, "90" → 90, "1:02:03" → 3723 */
/**
 * Zeitangabe → Sekunden. Als Trenner gehen „:“, „.“, „,“ und Leerzeichen,
 * weil die Zahlentastatur am Handy oft keinen Doppelpunkt hat: „1.30“ = 1:30.
 */
export function parseTime(input: string): number | undefined {
  const s = input.trim()
  if (!s) return undefined
  const parts = s.split(/\s*[:.,]\s*|\s+/).map((p) => (p === '' ? NaN : Number(p)))
  if (parts.some((p) => !Number.isFinite(p) || p < 0)) return undefined
  return parts.reduce((acc, p) => acc * 60 + p, 0)
}

export function formatTime(seconds: number | undefined): string {
  if (seconds == null) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** Notfall-Überschrift, falls die KI nicht erreichbar ist. */
export function fallbackTitle(question: string): string {
  const words = question.replace(/\s+/g, ' ').trim().split(' ')
  return words.length > 6 ? `${words.slice(0, 6).join(' ')} …` : words.join(' ')
}

/** UUID auch ohne sicheren Kontext (z. B. Handy im WLAN über http). */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
