import { useState } from 'react'
import { formatBlinds, suggestNext } from '../game/blinds'
import type { BlindLevel } from '../lib/types'
import { Icon } from './Icon'

interface Props {
  levels: BlindLevel[]
  perLevel: number
  onChange: (levels: BlindLevel[], perLevel: number) => void
  /** Index der aktuell laufenden Stufe (für die Markierung am Spielabend) */
  currentLevel?: number
}

/** Blind-Stufen bearbeiten. Neue Stufen werden als Verdopplung vorgeschlagen. */
export function BlindEditor({ levels, perLevel, onChange, currentLevel }: Props) {
  // Eigenes Textfeld, damit man die Zahl beim Tippen kurz leeren kann
  const [perLevelText, setPerLevelText] = useState(String(perLevel))

  function setLevel(i: number, patch: Partial<BlindLevel>) {
    onChange(levels.map((l, j) => (j === i ? { ...l, ...patch } : l)), perLevel)
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center justify-between gap-3">
        <span className="text-cream-100">Blinds erhöhen nach je</span>
        <span className="flex items-center gap-2">
          <input
            className="field w-16 text-center"
            inputMode="numeric"
            value={perLevelText}
            onChange={(e) => {
              const text = e.target.value.replace(/\D/g, '')
              setPerLevelText(text)
              if (Number(text) >= 1) onChange(levels, Number(text))
            }}
            onBlur={() => setPerLevelText(String(perLevel))}
          />
          <span className="text-cream-300">Fragen</span>
        </span>
      </label>

      <ol className="flex flex-col gap-1.5">
        {levels.map((l, i) => (
          <li
            key={i}
            className={`flex items-center gap-2 rounded-lg px-2 py-1 ${i === currentLevel ? 'bg-gold-400/15 ring-1 ring-gold-500/60' : ''}`}
          >
            <span className="w-16 shrink-0 text-sm whitespace-nowrap text-cream-300">
              Stufe {i + 1}
              {i === currentLevel && <span className="block text-xs text-gold-300">aktuell</span>}
            </span>
            <input
              className="field w-20 min-w-0 px-2 py-1.5 text-right tabular-nums"
              inputMode="numeric"
              aria-label={`Small Blind Stufe ${i + 1}`}
              value={l.small}
              onChange={(e) => setLevel(i, { small: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            />
            <span className="text-cream-300">/</span>
            <input
              className="field w-20 min-w-0 px-2 py-1.5 text-right tabular-nums"
              inputMode="numeric"
              aria-label={`Big Blind Stufe ${i + 1}`}
              value={l.big}
              onChange={(e) => setLevel(i, { big: Number(e.target.value.replace(/\D/g, '')) || 0 })}
            />
            {i === levels.length - 1 && levels.length > 1 && (currentLevel == null || i > currentLevel) && (
              <button
                type="button"
                aria-label="Letzte Stufe entfernen"
                className="ml-auto rounded-full p-1.5 text-cream-300 hover:bg-felt-700 hover:text-cream-50"
                onClick={() => onChange(levels.slice(0, -1), perLevel)}
              >
                <Icon name="x" className="size-4" />
              </button>
            )}
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="btn btn-ghost self-start px-3 py-1.5 text-sm font-medium"
        onClick={() => onChange([...levels, suggestNext(levels)], perLevel)}
      >
        <Icon name="plus" className="size-4" /> Stufe ({formatBlinds(suggestNext(levels))})
      </button>
    </div>
  )
}
