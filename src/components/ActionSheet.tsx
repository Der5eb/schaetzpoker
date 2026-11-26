import { useEffect, useRef } from 'react'
import { Icon, type IconName } from './Icon'

/** Blatt mit selten gebrauchten Aktionen (fährt von unten herein) */
export function ActionSheet({
  open,
  onClose,
  options,
  title,
  label = 'Weitere Aktionen',
}: {
  open: boolean
  onClose: () => void
  options: { icon: IconName; label: string; onSelect: () => void }[]
  /** Kleine Zeile über den Aktionen, z. B. das angemeldete Konto */
  title?: string
  label?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="mx-auto mt-auto mb-0 w-full max-w-xl rounded-t-3xl border border-white/10 bg-felt-850 p-0 text-cream-100 shadow-[0_-20px_60px_-20px_rgb(0_0_0/0.9)] backdrop:bg-felt-950/70 open:animate-[enter_0.3s_var(--ease-out-expo)]"
    >
      <div className="flex flex-col gap-1.5 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <span aria-hidden="true" className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20" />
        {title && <p className="truncate px-4 pb-2 text-sm text-cream-400">{title}</p>}
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            className="flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left font-medium transition-colors hover:bg-white/5"
            onClick={() => {
              onClose()
              o.onSelect()
            }}
          >
            <Icon name={o.icon} weight="duotone" className="size-6 text-gold-300" />
            {o.label}
          </button>
        ))}
        <button type="button" className="btn btn-ghost mt-1 min-h-12" onClick={onClose}>
          Schließen
        </button>
      </div>
    </dialog>
  )
}
