import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CategoryBadge } from '../components/CategoryBadge'
import { Icon } from '../components/Icon'
import { Shell } from '../components/Shell'
import { ensureCategory, fetchCategories, fetchQuestions, suggestMeta, toInput, updateQuestion } from '../lib/data'
import { fallbackTitle, formatAnswer } from '../lib/format'
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

  // Fragen, bei denen die KI beim Speichern nicht erreichbar war
  const unsorted = (questions ?? []).filter((q) => !q.category_id && q.question.trim())
  const [sorting, setSorting] = useState<{ running: boolean; done: number; failed: number; total: number } | null>(null)

  async function sortWithAi() {
    if (!questions) return
    let cats = categories
    let done = 0
    let failed = 0
    const total = unsorted.length
    const updated = new Map<string, Question>()
    setSorting({ running: true, done, failed, total })
    for (const q of unsorted) {
      try {
        const s = await suggestMeta(toInput(q), cats.map((c) => c.name))
        const { category, created } = await ensureCategory(s.category, cats)
        if (created) cats = [...cats, category]
        // Überschrift nur ersetzen, wenn sie noch der automatische Notbehelf ist
        const keepTitle = q.title.trim() && q.title !== fallbackTitle(q.question)
        updated.set(q.id, await updateQuestion(q.id, { category_id: category.id, ...(keepTitle ? {} : { title: s.title }) }))
        done++
      } catch (e) {
        console.error(e)
        failed++
      }
      setSorting({ running: true, done, failed, total })
    }
    setCategories(cats)
    setQuestions((qs) => qs?.map((q) => updated.get(q.id) ?? q) ?? null)
    setSorting(failed ? { running: false, done, failed, total } : null)
  }

  const statusKeys = Object.keys(STATUS_LABELS) as StatusFilter[]
  const statusIndex = statusKeys.indexOf(status)

  return (
    <Shell
      title="Bibliothek"
      back="/"
      actions={
        <Link to="/kategorien" className="btn btn-ghost btn-icon" aria-label="Kategorien verwalten" title="Kategorien verwalten">
          <Icon name="tag" weight="duotone" className="size-5 text-gold-300" />
        </Link>
      }
    >
      <label className="relative mb-3 block">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 size-[1.1rem] -translate-y-1/2 text-cream-400" />
        <input
          className="field pl-10"
          type="search"
          aria-label="Fragen durchsuchen"
          placeholder="Suchen"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      <div role="tablist" aria-label="Status" className="relative mb-4 grid grid-cols-4 rounded-xl bg-felt-950/60 p-1 text-sm ring-1 ring-white/[0.06]">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-lg bg-felt-700 shadow-[var(--shadow-lift)] transition-transform duration-300 ease-[var(--ease-out-expo)]"
          style={{ transform: `translateX(${statusIndex * 100}%)` }}
        />
        {statusKeys.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={status === s}
            onClick={() => setStatus(s)}
            className={`relative rounded-lg py-2 font-medium transition-colors ${status === s ? 'text-cream-50' : 'text-cream-400 hover:text-cream-100'}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
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

      {(unsorted.length > 0 || sorting) && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-gold-400/25 bg-gold-400/[0.06] px-4 py-3">
          <p className="text-sm text-cream-200">
            {sorting?.running
              ? `KI ordnet ein … ${sorting.done + sorting.failed} von ${sorting.total}`
              : sorting
                ? `${sorting.done} eingeordnet, ${sorting.failed} fehlgeschlagen (KI überlastet) – gleich nochmal versuchen.`
                : `${unsorted.length} ${unsorted.length === 1 ? 'Frage' : 'Fragen'} ohne Kategorie`}
          </p>
          {unsorted.length > 0 && (
            <button type="button" className="btn btn-ghost shrink-0 px-3 py-2 text-sm" disabled={sorting?.running} onClick={sortWithAi}>
              <Icon name="sparkle" weight="duotone" className={`size-4 text-gold-300 ${sorting?.running ? 'animate-spin' : ''}`} /> Einordnen
            </button>
          )}
        </div>
      )}

      {error && <p className="text-danger">{error}</p>}
      {!questions && !error && <p className="text-cream-400">Lädt …</p>}
      {questions && questions.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Icon name="cards" weight="duotone" className="size-14 text-gold-300/80" />
          <p className="font-display text-2xl font-semibold text-cream-50">Noch keine Fragen</p>
          <p className="max-w-[28ch] text-cream-400">Die erste Schätzfrage ist schnell notiert – Hinweise und Lösung kannst du später ergänzen.</p>
          <Link to="/erfassen" className="btn btn-primary mt-3">
            <Icon name="plus" weight="bold" className="size-4" /> Frage erfassen
          </Link>
        </div>
      )}
      {questions && questions.length > 0 && filtered.length === 0 && <p className="py-8 text-center text-cream-400">Keine Fragen für diesen Filter.</p>}

      <ul className="flex flex-col gap-2.5 pb-28">
        {filtered.map((q, i) => {
          const cat = q.category_id ? byId.get(q.category_id) : undefined
          return (
            <li key={q.id} className="animate-enter" style={{ animationDelay: `${Math.min(i * 35, 280)}ms` }}>
              <Link to={`/frage/${q.id}`} className="card relative flex flex-col gap-2 overflow-hidden px-4 py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <span className="font-display text-[1.2rem] leading-snug font-semibold text-cream-50">{q.title || 'Ohne Überschrift'}</span>
                  {q.answer != null && (
                    <span className="shrink-0 pt-0.5 font-display text-[1.05rem] font-semibold text-gold-200 tabular-nums">{formatAnswer(q)}</span>
                  )}
                </div>
                <p className="line-clamp-2 text-sm leading-relaxed text-cream-300">{q.question}</p>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <CategoryBadge category={cat} />
                  {q.status === 'draft' && <Tag>Entwurf</Tag>}
                  {q.status === 'ready' && !q.played_at && <Tag tone="gold">spielbereit</Tag>}
                  {q.played_at && <Tag>gespielt</Tag>}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      <Link
        to="/erfassen"
        aria-label="Neue Frage"
        className="group fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-20 grid size-16 place-items-center rounded-full text-felt-950 shadow-[0_14px_30px_-10px_rgb(0_0_0/0.9)] transition-transform active:scale-95"
        style={{ background: 'radial-gradient(circle at 35% 30%, #f6e3ad, #d1a446 55%, #a57a28)' }}
      >
        <span className="absolute inset-[5px] rounded-full border-2 border-dashed border-cream-50/60 transition-transform duration-500 group-hover:rotate-45" />
        <Icon name="plus" weight="bold" className="relative size-7" />
      </Link>
    </Shell>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
        active ? 'border-gold-400/70 bg-gold-400/15 text-cream-50' : 'border-white/10 text-cream-300 hover:border-white/20 hover:text-cream-100'
      }`}
    >
      {children}
    </button>
  )
}

function Count({ n }: { n: number }) {
  return <span className="text-xs text-cream-400 tabular-nums">{n}</span>
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: 'gold' }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        tone === 'gold' ? 'bg-gold-400/15 text-gold-200' : 'bg-felt-950/70 text-cream-400'
      }`}
    >
      {children}
    </span>
  )
}
