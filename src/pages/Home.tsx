import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChipMark } from '../components/ChipMark'
import { Icon, type IconName } from '../components/Icon'
import { useAuth } from '../lib/auth'
import { fetchQuestions } from '../lib/data'
import { supabase } from '../lib/supabase'

const rows: { to: string; icon: IconName; title: string; text: string }[] = [
  { to: '/bibliothek', icon: 'cards', title: 'Bibliothek', text: 'Fragen und Kategorien verwalten' },
  { to: '/spiel', icon: 'chip', title: 'Spielabend', text: 'Abend starten und TV koppeln' },
  { to: '/tv', icon: 'tv', title: 'TV-Ansicht', text: 'Am Laptop für den Fernseher' },
]

export function Home() {
  const { session } = useAuth()
  const [stats, setStats] = useState<{ ready: number; total: number } | null>(null)

  useEffect(() => {
    fetchQuestions()
      .then((qs) => setStats({ total: qs.length, ready: qs.filter((q) => q.status === 'ready' && !q.played_at).length }))
      .catch(() => {})
  }, [])

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header className="animate-focus-in mb-10 flex items-center gap-4">
        <ChipMark className="size-14 shrink-0 drop-shadow-[0_8px_14px_rgba(0,0,0,0.5)]" />
        <div>
          <h1 className="wordmark text-[2.6rem] leading-none">
            Schätz<em>poker</em>
          </h1>
          <p className="mt-1.5 text-sm text-cream-400 tabular-nums">
            {stats
              ? `${stats.total} ${stats.total === 1 ? 'Frage' : 'Fragen'} · ${stats.ready} spielbereit`
              : ' '}
          </p>
        </div>
      </header>

      <main className="animate-enter flex flex-col gap-6 [animation-delay:120ms]">
        <Link
          to="/erfassen"
          className="group relative flex items-center gap-4 overflow-hidden rounded-2xl px-5 py-5 text-felt-950 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] transition-transform active:scale-[0.99]"
          style={{
            background:
              'radial-gradient(120% 140% at 0% 0%, #f6e3ad 0%, #e6c470 35%, #c7973b 75%, #a57a28 100%)',
          }}
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-felt-950/90 text-gold-300 shadow-inner">
            <Icon name="pencil" weight="duotone" className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-2xl leading-tight font-extrabold">Frage erfassen</span>
            <span className="block text-sm text-felt-900/80">Frage, zwei Hinweise, Lösung</span>
          </span>
          <Icon name="plus" weight="bold" className="size-6 transition-transform group-hover:rotate-90" />
        </Link>

        <nav className="card overflow-hidden p-1.5">
          {rows.map((r, i) => (
            <Link
              key={r.to}
              to={r.to}
              className={`group flex items-center gap-4 rounded-xl px-3.5 py-3.5 transition-colors hover:bg-white/[0.04] ${
                i > 0 ? 'border-t border-white/[0.05]' : ''
              }`}
            >
              <Icon name={r.icon} weight="duotone" className="size-7 shrink-0 text-gold-300" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-cream-50">{r.title}</span>
                <span className="block truncate text-sm text-cream-400">{r.text}</span>
              </span>
              <Icon name="next" className="size-5 text-cream-400 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </nav>
      </main>

      <footer className="mt-auto flex items-center justify-between gap-4 pt-12 text-sm text-cream-400">
        <span className="truncate">{session?.user.email}</span>
        <button
          onClick={() => supabase?.auth.signOut()}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5 hover:text-cream-100"
        >
          <Icon name="signOut" className="size-4" /> Abmelden
        </button>
      </footer>
    </div>
  )
}
