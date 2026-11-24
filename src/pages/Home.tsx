import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchQuestions } from '../lib/data'
import { Shell } from '../components/Shell'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const entries = [
  { to: '/erfassen', title: 'Frage erfassen', text: 'Neue Schätzfrage mit Hinweisen und Lösung' },
  { to: '/bibliothek', title: 'Bibliothek', text: 'Fragen und Kategorien verwalten' },
  { to: '/spiel', title: 'Spielabend', text: 'Abend starten, Blinds festlegen, TV koppeln' },
  { to: '/tv', title: 'TV-Ansicht', text: 'Auf dem Laptop am Fernseher öffnen' },
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
    <Shell title="Schätzpoker">
      <nav className="flex flex-col gap-3">
        {entries.map((e) => (
          <Link
            key={e.to}
            to={e.to}
            className="rounded-xl border border-felt-700 bg-felt-800 px-5 py-4 transition-colors hover:border-gold-500"
          >
            <div className="font-display text-xl text-cream-50">{e.title}</div>
            <div className="text-sm text-cream-300">
              {e.to === '/bibliothek' && stats
                ? `${stats.total} ${stats.total === 1 ? 'Frage' : 'Fragen'}, davon ${stats.ready} spielbereit`
                : e.text}
            </div>
          </Link>
        ))}
      </nav>
      <footer className="mt-auto flex items-center justify-between pt-10 text-sm text-cream-300">
        <span className="truncate">{session?.user.email}</span>
        <button onClick={() => supabase?.auth.signOut()} className="underline-offset-4 hover:underline">
          Abmelden
        </button>
      </footer>
    </Shell>
  )
}
