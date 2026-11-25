import type { BlindLevel } from '../lib/types'

/** Standard-Struktur: ab Startwert jeweils verdoppeln. */
export function defaultLevels(small: number, big: number, count = 8): BlindLevel[] {
  return Array.from({ length: count }, (_, i) => ({ small: small * 2 ** i, big: big * 2 ** i }))
}

/** Stufe i – über die Liste hinaus wird automatisch weiter verdoppelt. */
export function levelAt(levels: BlindLevel[], index: number): BlindLevel {
  if (index < levels.length) return levels[index]
  const last = levels[levels.length - 1] ?? { small: 10, big: 20 }
  const factor = 2 ** (index - levels.length + 1)
  return { small: last.small * factor, big: last.big * factor }
}

/** Nächste Stufe als Vorschlag: Verdopplung der vorherigen. */
export function suggestNext(levels: BlindLevel[]): BlindLevel {
  return levelAt(levels, levels.length)
}

export interface BlindInfo {
  levelIndex: number
  current: BlindLevel
  next: BlindLevel
  /** Fragen bis zur nächsten Erhöhung, inkl. der laufenden */
  untilIncrease: number
}

/** Blinds für die Frage nach `completed` abgeschlossenen Fragen. */
export function blindInfo(levels: BlindLevel[], perLevel: number, completed: number): BlindInfo {
  const per = Math.max(1, perLevel)
  const levelIndex = Math.floor(completed / per)
  return {
    levelIndex,
    current: levelAt(levels, levelIndex),
    next: levelAt(levels, levelIndex + 1),
    untilIncrease: per - (completed % per),
  }
}

export function formatBlinds(b: BlindLevel): string {
  const f = new Intl.NumberFormat('de-DE')
  return `${f.format(b.small)} / ${f.format(b.big)}`
}

/** Prüft eine Blind-Struktur; gibt einen verständlichen Fehler zurück oder null. */
export function validateLevels(levels: BlindLevel[], perLevel: number): string | null {
  if (!Number.isFinite(perLevel) || perLevel < 1) return 'Erhöhen nach mindestens 1 Frage.'
  if (levels.length === 0) return 'Mindestens eine Blind-Stufe anlegen.'
  for (const [i, l] of levels.entries()) {
    if (l.small <= 0) return `Stufe ${i + 1}: Small Blind muss größer als 0 sein.`
    if (l.big <= l.small) return `Stufe ${i + 1}: Big Blind muss größer als Small Blind sein.`
  }
  return null
}
