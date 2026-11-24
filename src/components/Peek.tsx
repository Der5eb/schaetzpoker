import { useState, type ReactNode } from 'react'
import { Icon } from './Icon'

/**
 * Verdeckter Inhalt auf dem Handy der Spielleitung: unscharf, bis man draufdrückt.
 * Schützt vor Blicken über die Schulter am Spieltisch.
 */
export function Peek({ hidden, children, label = 'Gedrückt halten zum Ansehen' }: { hidden: boolean; children: ReactNode; label?: string }) {
  const [peeking, setPeeking] = useState(false)
  if (!hidden) return <>{children}</>

  const show = () => setPeeking(true)
  const hide = () => setPeeking(false)

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={peeking ? 'Verdeckter Inhalt wird angezeigt' : label}
      className="relative touch-manipulation rounded-xl select-none [-webkit-touch-callout:none] focus-visible:outline-2"
      onPointerDown={(e) => {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          /* ohne Capture weiter */
        }
        show()
      }}
      onPointerUp={hide}
      onPointerCancel={hide}
      onLostPointerCapture={hide}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), show())}
      onKeyUp={hide}
      onBlur={hide}
    >
      <div
        aria-hidden={!peeking}
        className="transition-[filter,opacity] duration-200"
        style={{ filter: peeking ? 'none' : 'blur(9px)', opacity: peeking ? 1 : 0.55 }}
      >
        {children}
      </div>
      {!peeking && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-felt-950/85 px-3 py-1.5 text-xs font-semibold text-cream-100 shadow-lg ring-1 ring-white/10">
            <Icon name="eye" className="size-4 text-gold-300" /> {label}
          </span>
        </span>
      )}
    </div>
  )
}
