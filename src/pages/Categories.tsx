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
      <form onSubmit={add} className="mb-5 flex gap-2">
        <input className="field" placeholder="Neue Kategorie" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <button type="submit" className="btn btn-primary shrink-0 px-3" aria-label="Anlegen" disabled={!newName.trim()}>
          <Icon name="plus" />
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-chip-red">{error}</p>}
      {!categories && !error && <p className="text-cream-300">Lädt …</p>}
      {categories?.length === 0 && (
        <p className="text-cream-300">Noch keine Kategorien. Die KI legt sie beim Speichern von Fragen automatisch an.</p>
      )}

      <ul className="flex flex-col gap-2">
        {categories?.map((c) => (
          <li key={c.id} className="card overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              onClick={() => setOpenId(openId === c.id ? null : c.id)}
              aria-expanded={openId === c.id}
            >
              <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="flex-1 text-cream-50">{c.name}</span>
              <span className="text-sm text-cream-300 tabular-nums">{counts.get(c.id) ?? 0}</span>
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
    <div className="flex flex-col gap-4 border-t border-felt-700 px-4 py-4">
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
              className={`size-8 rounded-full ring-offset-2 ring-offset-felt-800 ${category.color === color ? 'ring-2 ring-cream-50' : ''}`}
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
            <option value="">– Kategorie wählen –</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
      )}

      <button
        type="button"
        className="btn btn-danger self-start py-1.5 text-sm"
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
