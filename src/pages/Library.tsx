import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryBadge } from '../components/CategoryBadge'
import { Icon } from '../components/Icon'
import { Shell } from '../components/Shell'
import { fetchCategories, fetchQuestions } from '../lib/data'
import { formatAnswer } from '../lib/format'
import type { Category, Question } from '../lib/types'

type StatusFilter = 'all' | 'draft' | 'open' | 'played'

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'Alle',
  open: 'Spielbereit',
  draft: 'Entwürfe',
  played: 'Gespielt',
}

const FILTER_KEY = 'schaetzpoker:bibliothek-filter'

function loadFilter(): { status: StatusFilter; category: string } {
  try {
    return { status: 'all', category: 'all', ...JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? '{}') }
  } catch {
    return { status: 'all', category: 'all' }
  }
}

function matchesStatus(q: Question, s: StatusFilter) {
  if (s === 'draft') return q.status === 'draft'
  if (s === 'open') return q.status === 'ready' && !q.played_at
  if (s === 'played') return !!q.played_at
  return true
}

export function Library() {
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>(() => loadFilter().status)
  const [categoryFilter, setCategoryFilter] = useState<string>(() => loadFilter().category)

  useEffect(() => {
    Promise.all([fetchQuestions(), fetchCategories()])
      .then(([qs, cs]) => {
        setQuestions(qs)
        setCategories(cs)
      })
      .catch(() => setError('Fragen konnten nicht geladen werden.'))
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_KEY, JSON.stringify({ status, category: categoryFilter }))
    } catch {
      /* egal */
    }
  }, [status, categoryFilter])

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('de')
    return (questions ?? []).filter((q) => {
      if (!matchesStatus(q, status)) return false
      if (categoryFilter === 'none' && q.category_id) return false
      if (categoryFilter !== 'all' && categoryFilter !== 'none' && q.category_id !== categoryFilter) return false
      if (term && !`${q.title} ${q.question}`.toLocaleLowerCase('de').includes(term)) return false
      return true
    })
  }, [questions, status, categoryFilter, search])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const q of questions ?? []) {
      if (!matchesStatus(q, status)) continue
      const k = q.category_id ?? 'none'
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [questions, status])

  const total = [...counts.values()].reduce((a, b) => a + b, 0)

  return (
    <Shell title="Bibliothek" back="/">
      <div className="-mt-2 mb-4 flex items-center gap-2">
        <label className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-cream-300" />
          <input className="field pl-9" type="search" placeholder="Suchen" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Link to="/kategorien" className="btn btn-ghost shrink-0 px-3" aria-label="Kategorien verwalten" title="Kategorien verwalten">
          <Icon name="tag" />
        </Link>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-1 rounded-lg bg-felt-950/50 p-1 text-sm">
        {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-md py-1.5 transition-colors ${status === s ? 'bg-felt-700 text-cream-50' : 'text-cream-300 hover:text-cream-100'}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Chip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>
          Alle <Count n={total} />
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} active={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)}>
            <span className="size-2 rounded-full" style={{ background: c.color }} />
            {c.name} <Count n={counts.get(c.id) ?? 0} />
          </Chip>
        ))}
        {(counts.get('none') ?? 0) > 0 && (
          <Chip active={categoryFilter === 'none'} onClick={() => setCategoryFilter('none')}>
            ohne Kategorie <Count n={counts.get('none') ?? 0} />
          </Chip>
        )}
      </div>

      {error && <p className="text-chip-red">{error}</p>}
      {!questions && !error && <p className="text-cream-300">Lädt …</p>}
      {questions && questions.length === 0 && (
        <div className="card p-6 text-center">
          <p className="font-display text-xl text-cream-50">Noch keine Fragen</p>
          <p className="mt-1 text-cream-300">Leg mit der ersten Schätzfrage los.</p>
        </div>
      )}
      {questions && questions.length > 0 && filtered.length === 0 && (
        <p className="text-cream-300">Keine Fragen für diesen Filter.</p>
      )}

      <ul className="flex flex-col gap-2 pb-24">
        {filtered.map((q) => (
          <li key={q.id}>
            <Link to={`/frage/${q.id}`} className="card flex flex-col gap-1.5 px-4 py-3 transition-colors hover:border-gold-500">
              <div className="flex items-start justify-between gap-3">
                <span className="font-display text-lg leading-snug text-cream-50">{q.title || 'Ohne Überschrift'}</span>
                {q.answer != null && <span className="shrink-0 pt-0.5 text-sm text-gold-300 tabular-nums">{formatAnswer(q)}</span>}
              </div>
              <p className="line-clamp-2 text-sm text-cream-300">{q.question}</p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <CategoryBadge category={q.category_id ? byId.get(q.category_id) : undefined} />
                {q.status === 'draft' && <span className="rounded-full bg-felt-950 px-2 py-0.5 text-xs text-cream-300">Entwurf</span>}
                {q.played_at && <span className="rounded-full bg-felt-950 px-2 py-0.5 text-xs text-cream-300">gespielt</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        to="/erfassen"
        aria-label="Neue Frage"
        className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] grid size-14 place-items-center rounded-full bg-gold-400 text-felt-950 shadow-lg shadow-black/40 hover:bg-gold-300"
      >
        <Icon name="plus" className="size-7" />
      </Link>
    </Shell>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
        active ? 'border-gold-400 bg-gold-400/15 text-cream-50' : 'border-felt-600 text-cream-300 hover:text-cream-100'
      }`}
    >
      {children}
    </button>
  )
}

function Count({ n }: { n: number }) {
  return <span className="text-xs text-cream-300 tabular-nums">{n}</span>
}
