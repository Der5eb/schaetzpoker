import { useEffect, useState, type FormEvent } from 'react'
import { Icon } from '../components/Icon'
import { Shell } from '../components/Shell'
import {
  CATEGORY_COLORS,
  deleteCategory,
  ensureCategory,
  fetchCategories,
  fetchQuestions,
  mergeCategory,
  updateCategory,
} from '../lib/data'
import type { Category } from '../lib/types'

export function Categories() {
  const [categories, setCategories] = useState<Category[] | null>(null)
  const [counts, setCounts] = useState<Map<string, number>>(new Map())
  const [openId, setOpenId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function reload() {
    try {
      const [cs, qs] = await Promise.all([fetchCategories(), fetchQuestions()])
      const m = new Map<string, number>()
      for (const q of qs) if (q.category_id) m.set(q.category_id, (m.get(q.category_id) ?? 0) + 1)
      setCategories(cs)
      setCounts(m)
    } catch {
      setError('Kategorien konnten nicht geladen werden.')
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !categories) return
    try {
      await ensureCategory(newName, categories)
      setNewName('')
      await reload()
    } catch {
      setError('Kategorie konnte nicht angelegt werden.')
    }
  }

  async function run(action: () => Promise<void>, failMsg: string) {
    setError(null)
    try {
      await action()
      await reload()
    } catch (e) {
      console.error(e)
      setError(failMsg)
    }
  }

  return (
    <Shell title="Kategorien" back="/bibliothek">
      <form onSubmit={add} className="mb-6 flex gap-2">
        <input className="field" aria-label="Neue Kategorie" placeholder="Neue Kategorie" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-icon text-felt-950" aria-label="Kategorie anlegen" disabled={!newName.trim()}>
          <Icon name="plus" weight="bold" />
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {!categories && !error && <p className="text-cream-400">Lädt …</p>}
      {categories?.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <Icon name="tag" weight="duotone" className="size-12 text-gold-300/80" />
          <p className="max-w-[30ch] text-cream-300">Noch keine Kategorien. Die KI legt sie beim Speichern von Fragen automatisch an.</p>
        </div>
      )}

      <ul className="flex flex-col gap-2.5">
        {categories?.map((c, i) => (
          <li key={c.id} className="card animate-enter overflow-hidden" style={{ animationDelay: `${Math.min(i * 35, 280)}ms` }}>
            <button
              type="button"
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
              onClick={() => setOpenId(openId === c.id ? null : c.id)}
              aria-expanded={openId === c.id}
            >
              <span className="size-3.5 shrink-0 rounded-full ring-4 ring-black/20" style={{ background: c.color }} />
              <span className="flex-1 font-display text-lg font-extrabold text-cream-50">{c.name}</span>
              <span className="text-sm text-cream-400 tabular-nums">
                {counts.get(c.id) ?? 0} {(counts.get(c.id) ?? 0) === 1 ? 'Frage' : 'Fragen'}
              </span>
              <Icon name="down" className={`size-4 text-cream-400 transition-transform duration-300 ${openId === c.id ? 'rotate-180' : ''}`} />
            </button>
            {openId === c.id && (
              <CategoryEditor
                category={c}
                others={categories.filter((o) => o.id !== c.id)}
                count={counts.get(c.id) ?? 0}
                onRename={(name) => run(() => updateCategory(c.id, { name: name.trim() }), 'Umbenennen fehlgeschlagen – gibt es den Namen schon?')}
                onColor={(color) => run(() => updateCategory(c.id, { color }), 'Farbe konnte nicht gespeichert werden.')}
                onMerge={(intoId) => run(async () => { await mergeCategory(c.id, intoId); setOpenId(intoId) }, 'Zusammenführen fehlgeschlagen.')}
                onDelete={() => run(() => deleteCategory(c.id), 'Löschen fehlgeschlagen.')}
              />
            )}
          </li>
        ))}
      </ul>
    </Shell>
  )
}

interface EditorProps {
  category: Category
  others: Category[]
  count: number
  onRename: (name: string) => void
  onColor: (color: string) => void
  onMerge: (intoId: string) => void
  onDelete: () => void
}

function CategoryEditor({ category, others, count, onRename, onColor, onMerge, onDelete }: EditorProps) {
  const [name, setName] = useState(category.name)

  return (
    <div className="animate-enter flex flex-col gap-5 border-t border-white/[0.06] px-4 pt-4 pb-5">
      <label className="flex flex-col gap-1.5">
        <span className="label">Name</span>
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== category.name && onRename(name)}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="label">Farbe</span>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Farbe ${color}`}
              onClick={() => onColor(color)}
              aria-pressed={category.color === color}
              className={`size-9 rounded-full ring-offset-2 ring-offset-felt-850 transition-transform hover:scale-110 ${category.color === color ? 'ring-2 ring-cream-50' : ''}`}
              style={{ background: color }}
            />
          ))}
        </div>
      </div>

      {others.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="label">Zusammenführen mit … ({count} {count === 1 ? 'Frage wird' : 'Fragen werden'} verschoben)</span>
          <select
            className="field"
            value=""
            onChange={(e) => {
              const target = others.find((o) => o.id === e.target.value)
              if (target && window.confirm(`„${category.name}“ in „${target.name}“ aufgehen lassen?`)) onMerge(target.id)
            }}
          >
            <option value="">Kategorie wählen</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        className="btn btn-danger self-start py-2 text-sm"
        onClick={() => {
          const msg = count
            ? `„${category.name}“ löschen? ${count} ${count === 1 ? 'Frage ist' : 'Fragen sind'} danach ohne Kategorie.`
            : `„${category.name}“ löschen?`
          if (window.confirm(msg)) onDelete()
        }}
      >
        <Icon name="trash" className="size-4" /> Löschen
      </button>
    </div>
  )
}
