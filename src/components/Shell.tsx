import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'

/** Rahmen für die Handy-Ansichten. */
export function Shell({
  title,
  back,
  actions,
  children,
}: {
  title: ReactNode
  back?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-6 flex min-h-11 items-center gap-2">
        {back && (
          <Link to={back} aria-label="Zurück" className="btn btn-icon -ml-2 text-cream-300 hover:bg-white/5 hover:text-cream-50">
            <Icon name="back" className="size-6" />
          </Link>
        )}
        <h1 className="min-w-0 flex-1 truncate font-display text-[1.75rem] leading-tight font-extrabold text-cream-50">{title}</h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <main className="animate-enter flex flex-1 flex-col">{children}</main>
    </div>
  )
}

/** Abschnittsüberschrift innerhalb einer Seite. */
export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <h2 className="flex items-baseline gap-2">
      <span className="font-display text-xl font-extrabold text-cream-50">{children}</span>
      {hint && <span className="text-sm text-cream-400">{hint}</span>}
    </h2>
  )
}

/**
 * Am Bildschirm fixiertes Element. Wird direkt in <body> gerendert, damit
 * Einblend-Animationen (transform/filter) der Seite es nicht einsperren.
 */
export function Fixed({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}

/** Hauptaktion unten – ohne Kasten, nur ein weicher Verlauf in den Filz. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <Fixed>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-felt-950 from-70% via-felt-950/85 via-85% to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto flex max-w-xl flex-col gap-2">{children}</div>
      </div>
    </Fixed>
  )
}
