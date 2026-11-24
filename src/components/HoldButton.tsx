import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  onConfirm: () => void
  children: ReactNode
  /** Zusätzliche Klassen (z. B. btn btn-primary …) */
  className?: string
  /** Wie lange gedrückt gehalten werden muss */
  holdMs?: number
  /** Sperre nach dem Auslösen – verhindert Doppel-Auslösen */
  lockMs?: number
  disabled?: boolean
  /** Farbe des Füllbalkens */
  fill?: string
}

/**
 * Knopf für Aktionen, die der ganze Tisch sieht und die nicht rückgängig zu machen sind:
 * Er löst erst nach kurzem Gedrückthalten aus (Füllbalken zeigt den Fortschritt).
 * Ein kurzer Tipp löst nichts aus, sondern erinnert ans Halten.
 */
export function HoldButton({
  onConfirm,
  children,
  className = 'btn btn-primary',
  holdMs = 650,
  lockMs = 1000,
  disabled,
  fill = 'rgb(255 248 220 / 0.45)',
}: Props) {
  const [holding, setHolding] = useState(false)
  const [locked, setLocked] = useState(false)
  const [nudge, setNudge] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const inactive = disabled || locked

  function start() {
    if (inactive || holding) return
    fired.current = false
    setNudge(false)
    setHolding(true)
    timer.current = window.setTimeout(() => {
      fired.current = true
      setHolding(false)
      setLocked(true)
      navigator.vibrate?.(35)
      onConfirm()
      window.setTimeout(() => setLocked(false), lockMs)
    }, holdMs)
  }

  function stop() {
    if (!holding) return
    window.clearTimeout(timer.current)
    setHolding(false)
    if (!fired.current) {
      setNudge(true)
      window.setTimeout(() => setNudge(false), 1400)
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={inactive}
      aria-describedby={undefined}
      className={`relative touch-manipulation overflow-hidden select-none [-webkit-touch-callout:none] ${className} ${locked ? 'opacity-60' : ''}`}
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* Finger bleibt auch ohne Capture erkannt */
        }
        start()
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault()
          start()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') stop()
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 origin-left"
        style={{
          background: fill,
          transform: `scaleX(${holding ? 1 : 0})`,
          transition: holding ? `transform ${holdMs}ms linear` : 'transform 180ms ease-out',
        }}
      />
      <span className="relative flex flex-col items-center leading-tight">
        <span className="inline-flex items-center gap-2">{children}</span>
        <span
          className={`text-[0.7rem] font-medium tracking-wide transition-opacity ${nudge ? 'opacity-100' : 'opacity-70'}`}
          aria-live="polite"
        >
          {locked ? 'Erledigt' : nudge ? 'Länger gedrückt halten' : 'Gedrückt halten'}
        </span>
      </span>
    </button>
  )
}
