import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Gefährliche Aktion: Bestätigen-Knopf in Rot */
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Rückfrage im Look der App (statt window.confirm). Nutzt das native <dialog>:
 * Fokus bleibt im Dialog, Esc bricht ab, Screenreader erkennen ihn als Dialog.
 * Knöpfe sind erst nach kurzer Verzögerung aktiv, damit ein Doppeltipp nicht durchrutscht.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = 'Abbrechen', danger, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const openedAt = useRef(0)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      openedAt.current = Date.now()
      d.showModal()
    }
    if (!open && d.open) d.close()
  }, [open])

  const guard = (fn: () => void) => () => {
    if (Date.now() - openedAt.current < 350) return
    fn()
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => e.target === ref.current && onCancel()}
      className="m-auto w-[min(92vw,26rem)] rounded-3xl border border-white/10 bg-felt-850 p-0 text-cream-100 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)] backdrop:bg-felt-950/75 backdrop:backdrop-blur-sm open:animate-[enter_0.3s_var(--ease-out-expo)]"
    >
      <div className="flex flex-col gap-3 p-6">
        <h2 className="font-display text-2xl leading-tight font-extrabold text-cream-50">{title}</h2>
        {children && <div className="leading-relaxed text-cream-200">{children}</div>}
        <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost min-h-12" onClick={guard(onCancel)} autoFocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn min-h-12 ${danger ? 'bg-chip-red text-cream-50 hover:bg-chip-red-600' : 'btn-primary'}`}
            onClick={guard(onConfirm)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
