import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Rahmen für die Handy-Ansichten (Erfassen, Bibliothek, Spielleitung). */
export function Shell({ title, back, children }: { title: string; back?: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="mb-6 flex items-center gap-3">
        {back && (
          <Link
            to={back}
            aria-label="Zurück"
            className="-ml-2 rounded-full p-2 text-cream-300 hover:bg-felt-800 hover:text-cream-50"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )}
        <h1 className="font-display text-2xl text-cream-50">{title}</h1>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}
