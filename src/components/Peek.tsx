import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from './Icon'

const SHOW_MS = 8000

/**
 * Verdeckter Inhalt auf dem Handy der Spielleitung. Statt unscharfem Text steht dort
 * eine immer gleich große Kartenrückseite – so verrät nicht einmal die Länge etwas.
 * Antippen zeigt den Inhalt für einige Sekunden (funktioniert auch mit Bildschirmlesern).
 */
export function Peek({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!shown) return
    const t = window.setTimeout(() => setShown(false), SHOW_MS)
    return () => window.clearTimeout(t)
  }, [shown])

  if (!hidden) return <>{children}</>

  if (shown) {
    return (
      <div className="flex flex-col gap-2">
        {children}
        <button
          type="button"
          className="btn btn-ghost min-h-11 self-start px-3 py-1.5 text-sm"
          onClick={() => setShown(false)}
        >
          <Icon name="eyeOff" className="size-4" /> Wieder verbergen
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      aria-label="Verdeckten Inhalt kurz ansehen"
      className="card-back relative grid h-[4.5rem] w-full place-items-center rounded-xl! shadow-none! transition-transform active:scale-[0.99]"
    >
      <span className="flex items-center gap-1.5 rounded-full bg-felt-950/85 px-3 py-1.5 text-xs font-semibold text-cream-100 shadow-lg ring-1 ring-white/10">
        <Icon name="eye" className="size-4 text-gold-300" /> Antippen zum Ansehen
      </span>
    </button>
  )
}
