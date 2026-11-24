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

const numberField =
  'field min-w-0 px-3 py-2 text-right font-display text-lg font-semibold tabular-nums [font-variant-numeric:lining-nums_tabular-nums]'

/** Blind-Stufen bearbeiten. Neue Stufen werden als Verdopplung vorgeschlagen. */
export function BlindEditor({ levels, perLevel, onChange, currentLevel }: Props) {
  // Eigenes Textfeld, damit man die Zahl beim Tippen kurz leeren kann
  const [perLevelText, setPerLevelText] = useState(String(perLevel))

  function setLevel(i: number, patch: Partial<BlindLevel>) {
    onChange(levels.map((l, j) => (j === i ? { ...l, ...patch } : l)), perLevel)
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center justify-between gap-3 rounded-2xl bg-felt-950/40 px-4 py-3">
        <span className="text-cream-100">Erhöhen nach je</span>
        <span className="flex items-center gap-2.5">
          <input
            className="field w-16 px-2 py-2 text-center font-display text-lg font-extrabold tabular-nums"
            inputMode="numeric"
            aria-label="Fragen pro Blind-Stufe"
            value={perLevelText}
            onChange={(e) => {
              const text = e.target.value.replace(/\D/g, '')
              setPerLevelText(text)
              if (Number(text) >= 1) onChange(levels, Number(text))
            }}
            onBlur={() => setPerLevelText(String(perLevel))}
          />
          <span className="text-cream-400">Fragen</span>
        </span>
      </label>

      <div className="grid grid-cols-[4.5rem_1fr_1fr_2.75rem] items-center gap-x-2 gap-y-1.5">
        <span className="px-1 text-xs font-medium tracking-wide text-cream-400">Stufe</span>
        <span className="pr-3 text-right text-xs font-medium tracking-wide text-cream-400">Small</span>
        <span className="pr-3 text-right text-xs font-medium tracking-wide text-cream-400">Big</span>
        <span />
        {levels.map((l, i) => {
          const current = i === currentLevel
          const past = currentLevel != null && i < currentLevel
          return (
            <div
              key={i}
              className={`col-span-4 grid grid-cols-subgrid items-center rounded-xl py-1 transition-colors ${
                current ? 'bg-gold-400/12 ring-1 ring-gold-400/50' : ''
              } ${past ? 'opacity-55' : ''}`}
            >
              <span className="flex items-center gap-1.5 px-2 text-sm text-cream-300">
                {current ? (
                  <Icon name="chip" weight="fill" className="size-4 text-gold-300" />
                ) : (
                  <span className="w-4 text-center font-display font-extrabold tabular-nums">{i + 1}</span>
                )}
                {current && <span className="text-xs font-semibold text-gold-200">jetzt</span>}
              </span>
              <input
                className={numberField}
                inputMode="numeric"
                aria-label={`Small Blind Stufe ${i + 1}`}
                value={l.small}
                onChange={(e) => setLevel(i, { small: Number(e.target.value.replace(/\D/g, '')) || 0 })}
              />
              <input
                className={numberField}
                inputMode="numeric"
                aria-label={`Big Blind Stufe ${i + 1}`}
                value={l.big}
                onChange={(e) => setLevel(i, { big: Number(e.target.value.replace(/\D/g, '')) || 0 })}
              />
              {i === levels.length - 1 && levels.length > 1 && (currentLevel == null || i > currentLevel) ? (
                <button
                  type="button"
                  aria-label="Letzte Stufe entfernen"
                  className="grid size-11 place-items-center rounded-full text-cream-400 transition-colors hover:bg-white/5 hover:text-cream-50"
                  onClick={() => onChange(levels.slice(0, -1), perLevel)}
                >
                  <Icon name="x" className="size-4" />
                </button>
              ) : (
                <span />
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        className="btn btn-ghost min-h-11 self-start px-3.5 py-2 text-sm font-medium"
        onClick={() => onChange([...levels, suggestNext(levels)], perLevel)}
      >
        <Icon name="plus" className="size-4 text-gold-300" /> Stufe hinzufügen ({formatBlinds(suggestNext(levels))})
      </button>
    </div>
  )
}
