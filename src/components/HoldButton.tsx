import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  onConfirm: () => void
  children: ReactNode
  /** Rückfrage bei kurzem Tippen (und für Bildschirmleser), z. B. „Hinweis 2 aufdecken?“ */
  confirmTitle: string
  /** Beschriftung des Bestätigen-Knopfs in der Rückfrage */
  confirmLabel: string
  confirmBody?: ReactNode
  /** Zusätzliche Klassen (z. B. btn btn-primary …) */
  className?: string
  /** Wie lange gedrückt gehalten werden muss */
  holdMs?: number
  /** Sperre nach dem Auslösen – verhindert Doppel-Auslösen */
  lockMs?: number
  disabled?: boolean
  /** Farbe des Füllbalkens */
  fill?: string
  /** Kurzer Hinweis unter der Beschriftung */
  hint?: string
}

/**
 * Knopf für Aktionen, die der ganze Tisch sieht und die nicht rückgängig zu machen sind.
 * - Gedrückt halten löst direkt aus (Füllbalken zeigt den Fortschritt).
 * - Kurz tippen öffnet stattdessen eine Rückfrage. Das ist auch der Weg für
 *   Bildschirmleser und Schaltersteuerung, die per Doppeltipp auslösen.
 */
export function HoldButton({
  onConfirm,
  children,
  confirmTitle,
  confirmLabel,
  confirmBody,
  className = 'btn btn-primary',
  holdMs = 650,
  lockMs = 1000,
  disabled,
  fill = 'rgb(255 248 220 / 0.45)',
  hint = 'Halten · oder tippen und bestätigen',
}: Props) {
  const [holding, setHolding] = useState(false)
  const [locked, setLocked] = useState(false)
  const [asking, setAsking] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const fired = useRef(false)
  const handled = useRef(false)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const inactive = disabled || locked

  function fire() {
    setLocked(true)
    navigator.vibrate?.(35)
    onConfirm()
    window.setTimeout(() => setLocked(false), lockMs)
  }

  function start() {
    if (inactive || holding) return
    fired.current = false
    handled.current = false
    setHolding(true)
    timer.current = window.setTimeout(() => {
      fired.current = true
      handled.current = true // der folgende Klick gehört zu diesem Halten
      setHolding(false)
      fire()
    }, holdMs)
  }

  /** Losgelassen: vor Ablauf → Rückfrage statt Auslösen */
  function release() {
    if (!holding) return
    window.clearTimeout(timer.current)
    setHolding(false)
    handled.current = true
    if (!fired.current) setAsking(true)
  }

  /** Abgebrochen (z. B. Scrollen): nichts tun */
  function cancel() {
    window.clearTimeout(timer.current)
    setHolding(false)
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-disabled={inactive}
        aria-haspopup="dialog"
        className={`relative touch-manipulation overflow-hidden select-none [-webkit-touch-callout:none] ${className} ${locked ? 'opacity-60' : ''}`}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* Finger bleibt auch ohne Capture erkannt */
          }
          start()
        }}
        onPointerUp={release}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
            e.preventDefault()
            start()
          }
        }}
        onKeyUp={(e) => {
          if (e.key === 'Enter' || e.key === ' ') release()
        }}
        onClick={() => {
          // Klick ohne vorheriges Drücken/Halten (z. B. Bildschirmleser) → Rückfrage
          if (handled.current) {
            handled.current = false
            return
          }
          if (!inactive) setAsking(true)
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
          {(hint || locked) && <span className="text-xs font-medium tracking-wide opacity-75">{locked ? 'Erledigt' : hint}</span>}
        </span>
      </button>
      <ConfirmDialog
        open={asking}
        title={confirmTitle}
        confirmLabel={confirmLabel}
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false)
          fire()
        }}
      >
        {confirmBody}
      </ConfirmDialog>
    </>
  )
}
