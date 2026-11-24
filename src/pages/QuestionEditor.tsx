import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { MediaEditor } from '../components/MediaEditor'
import { Shell } from '../components/Shell'
import {
  createQuestion,
  deleteQuestion,
  emptyQuestion,
  ensureCategory,
  fetchCategories,
  fetchQuestion,
  missingForReady,
  suggestMeta,
  toInput,
  updateQuestion,
  type QuestionInput,
} from '../lib/data'
import { fallbackTitle, formatAnswer, numberToInput, parseNumber } from '../lib/format'
import { deleteMediaFiles } from '../lib/media'
import type { Category, Media, Question } from '../lib/types'

const DRAFT_KEY = 'schaetzpoker:entwurf'

type MediaKey = 'question_media' | 'hint1_media' | 'hint2_media' | 'explanation_media'

interface Draft {
  form: QuestionInput
  answerText: string
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

function saveDraft(d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
    else localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* privater Modus o. Ä. – Entwurf wird dann nicht gemerkt */
  }
}

export function QuestionEditor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as { saved?: boolean; aiFailed?: boolean } | null
  const justSaved = navState?.saved === true

  const [original, setOriginal] = useState<Question | null>(null)
  const [form, setForm] = useState<QuestionInput>(() => {
    const draft = isNew ? loadDraft()?.form : null
    return draft ? { ...emptyQuestion(), ...draft } : emptyQuestion()
  })
  const [answerText, setAnswerText] = useState(() => (isNew ? loadDraft()?.answerText : null) ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readyHint, setReadyHint] = useState<string | null>(null)
  const removedImages = useRef<string[]>([])

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setError('Kategorien konnten nicht geladen werden.'))
  }, [])

  useEffect(() => {
    if (isNew) return
    fetchQuestion(id)
      .then((q) => {
        setOriginal(q)
        setForm(toInput(q))
        setAnswerText(numberToInput(q.answer))
      })
      .catch(() => setError('Frage nicht gefunden.'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  // Neue Frage zwischenspeichern, damit unterwegs nichts verloren geht
  useEffect(() => {
    if (isNew) saveDraft({ form, answerText })
  }, [isNew, form, answerText])

  function set<K extends keyof QuestionInput>(key: K, value: QuestionInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setMedia(key: MediaKey) {
    return (media: Media[]) => setForm((f) => ({ ...f, [key]: media }))
  }

  const onImageRemoved = (path: string) => removedImages.current.push(path)

  const current: QuestionInput = { ...form, answer: parseNumber(answerText) }
  const missing = missingForReady(current)
  const answerInvalid = answerText.trim() !== '' && current.answer == null

  async function runSuggest(q: QuestionInput) {
    const s = await suggestMeta(q, categories.map((c) => c.name))
    const { category, created } = await ensureCategory(s.category, categories)
    if (created) setCategories((cs) => [...cs, category])
    return { title: s.title, categoryId: category.id }
  }

  async function suggestNow() {
    if (!form.question.trim()) {
      setError('Für einen Vorschlag zuerst die Frage eingeben.')
      return
    }
    setSuggesting(true)
    setError(null)
    try {
      const s = await runSuggest(current)
      setForm((f) => ({ ...f, title: s.title, category_id: s.categoryId }))
    } catch (e) {
      console.error(e)
      setError('KI-Vorschlag gerade nicht verfügbar.')
    } finally {
      setSuggesting(false)
    }
  }

  async function addCategory() {
    const name = window.prompt('Name der neuen Kategorie')
    if (!name?.trim()) return
    try {
      const { category, created } = await ensureCategory(name, categories)
      if (created) setCategories((cs) => [...cs, category])
      set('category_id', category.id)
    } catch {
      setError('Kategorie konnte nicht angelegt werden.')
    }
  }

  function toggleReady(checked: boolean) {
    setReadyHint(null)
    if (checked && missing.length) {
      setReadyHint(`Noch offen: ${missing.join(', ')}`)
      return
    }
    set('status', checked ? 'ready' : 'draft')
  }

  async function save() {
    if (!form.question.trim() && form.question_media.length === 0) {
      setError('Bitte zumindest die Frage eingeben.')
      return
    }
    if (answerInvalid) {
      setError('Die Lösung muss eine Zahl sein, z. B. 8849 oder 3,14.')
      return
    }
    setSaving(true)
    setError(null)

    let next: QuestionInput = { ...current, status: missing.length ? 'draft' : form.status }
    let aiFailed = false

    if (form.question.trim() && (!next.title.trim() || !next.category_id)) {
      try {
        const s = await runSuggest(next)
        next = { ...next, title: next.title.trim() || s.title, category_id: next.category_id ?? s.categoryId }
      } catch (e) {
        console.error(e)
        aiFailed = true
      }
    }
    if (!next.title.trim()) next.title = fallbackTitle(next.question)

    try {
      const saved = isNew ? await createQuestion(next) : await updateQuestion(id, next)
      await deleteMediaFiles(removedImages.current)
      removedImages.current = []
      if (isNew) {
        saveDraft(null)
        navigate(`/frage/${saved.id}`, { replace: true, state: { saved: true, aiFailed } })
      } else {
        setOriginal(saved)
        setForm(toInput(saved))
        navigate('.', { replace: true, state: { saved: true, aiFailed } })
      }
    } catch (e) {
      console.error(e)
      setError('Speichern fehlgeschlagen. Deine Eingaben bleiben erhalten – bitte erneut versuchen.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!original || !window.confirm('Diese Frage endgültig löschen?')) return
    try {
      await deleteQuestion(original)
      navigate('/bibliothek', { replace: true })
    } catch {
      setError('Löschen fehlgeschlagen.')
    }
  }

  function startNew() {
    saveDraft(null)
    navigate('/erfassen')
  }

  if (loading) {
    return <Shell title="Frage" back="/bibliothek"><p className="text-cream-300">Lädt …</p></Shell>
  }

  const category = categories.find((c) => c.id === form.category_id)

  return (
    <Shell title={isNew ? 'Neue Frage' : 'Frage bearbeiten'} back={isNew ? '/' : '/bibliothek'}>
      {justSaved && original && (
        <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-gold-500/50 bg-gold-400/10 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm text-gold-300"><Icon name="check" className="size-4" /> Gespeichert</div>
            <div className="mt-1 truncate font-display text-lg text-cream-50">{original.title}</div>
            <div className="text-sm text-cream-300">{category?.name ?? 'ohne Kategorie'}</div>
            {navState?.aiFailed && (
              <div className="mt-1 text-sm text-gold-300">KI nicht erreichbar – Überschrift und Kategorie unten ergänzen.</div>
            )}
          </div>
          <button type="button" className="btn btn-primary shrink-0 px-3 py-2 text-sm" onClick={startNew}>
            <Icon name="plus" className="size-4" /> Neue Frage
          </button>
        </div>
      )}

      <div className="flex flex-col gap-7 pb-28">
        <Section title="Frage">
          <textarea className="field" placeholder="Wie hoch ist …?" value={form.question} onChange={(e) => set('question', e.target.value)} />
          <MediaEditor value={form.question_media} onChange={setMedia('question_media')} onImageRemoved={onImageRemoved} />
        </Section>

        <Section title="Hinweis 1" hint="eher vage">
          <textarea className="field" aria-label="Hinweis 1" value={form.hint1} onChange={(e) => set('hint1', e.target.value)} />
          <MediaEditor value={form.hint1_media} onChange={setMedia('hint1_media')} onImageRemoved={onImageRemoved} />
        </Section>

        <Section title="Hinweis 2" hint="hilfreicher">
          <textarea className="field" aria-label="Hinweis 2" value={form.hint2} onChange={(e) => set('hint2', e.target.value)} />
          <MediaEditor value={form.hint2_media} onChange={setMedia('hint2_media')} onImageRemoved={onImageRemoved} />
        </Section>

        <Section title="Lösung">
          <div className="flex gap-2">
            <label className="flex flex-[2] flex-col gap-1.5">
              <span className="label">Zahl</span>
              <input className="field" inputMode="decimal" placeholder="8849" value={answerText} onChange={(e) => setAnswerText(e.target.value)} />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="label">Einheit</span>
              <input className="field" placeholder="m" value={form.answer_unit} onChange={(e) => set('answer_unit', e.target.value)} />
            </label>
          </div>
          {answerInvalid ? (
            <p className="text-sm text-chip-red">Keine gültige Zahl.</p>
          ) : current.answer != null ? (
            <p className="text-sm text-cream-300">Anzeige: <span className="text-cream-50">{formatAnswer(current)}</span></p>
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="label">Eigene Anzeige (optional)</span>
            <input className="field" placeholder="z. B. „ca. 8,8 km“" value={form.answer_display} onChange={(e) => set('answer_display', e.target.value)} />
          </label>
        </Section>

        <Section title="Auflösung & Erklärung" hint="optional">
          <textarea className="field" placeholder="Hintergrund, Einordnung, Fun Fact …" value={form.explanation} onChange={(e) => set('explanation', e.target.value)} />
          <MediaEditor value={form.explanation_media} onChange={setMedia('explanation_media')} onImageRemoved={onImageRemoved} />
        </Section>

        <Section title="Nur für die Spielleitung" hint="optional">
          <textarea className="field" placeholder="Notizen" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          <input className="field" placeholder="Quelle (Link oder Titel)" value={form.source} onChange={(e) => set('source', e.target.value)} />
        </Section>

        <Section title="Einordnung" hint={isNew ? 'wird beim Speichern automatisch vergeben' : undefined}>
          <div className="flex gap-2">
            <input className="field" placeholder="Überschrift" value={form.title} onChange={(e) => set('title', e.target.value)} />
            <button type="button" className="btn btn-ghost shrink-0 px-3" onClick={suggestNow} disabled={suggesting} aria-label="KI-Vorschlag" title="KI-Vorschlag">
              <Icon name="sparkle" className={suggesting ? 'size-5 animate-pulse text-gold-300' : 'size-5 text-gold-400'} />
            </button>
          </div>
          <div className="flex gap-2">
            <select className="field" value={form.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}>
              <option value="">– Kategorie –</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="button" className="btn btn-ghost shrink-0 px-3" onClick={addCategory} aria-label="Neue Kategorie" title="Neue Kategorie">
              <Icon name="plus" />
            </button>
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-felt-700 bg-felt-800 px-3 py-3">
            <input type="checkbox" className="size-5 accent-gold-400" checked={form.status === 'ready'} onChange={(e) => toggleReady(e.target.checked)} />
            <span>
              <span className="block text-cream-50">Spielbereit</span>
              <span className="block text-sm text-cream-300">Erscheint dann bei der Kategorie-Auswahl am Spielabend</span>
            </span>
          </label>
          {readyHint && <p className="text-sm text-gold-300">{readyHint}</p>}
          {form.played_at && (
            <div className="flex items-center justify-between text-sm text-cream-300">
              <span>Gespielt am {new Date(form.played_at).toLocaleDateString('de-DE')}</span>
              <button type="button" className="underline underline-offset-4 hover:text-cream-50" onClick={() => set('played_at', null)}>
                wieder freigeben
              </button>
            </div>
          )}
        </Section>

        {!isNew && (
          <button type="button" className="btn btn-danger self-start" onClick={remove}>
            <Icon name="trash" className="size-4" /> Frage löschen
          </button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-felt-700 bg-felt-900/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {error && <p className="text-sm text-chip-red">{error}</p>}
          <button type="button" className="btn btn-primary w-full py-3" onClick={save} disabled={saving}>
            {saving ? 'Speichert …' : 'Speichern'}
          </button>
        </div>
      </div>
    </Shell>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-baseline gap-2">
        <span className="font-display text-lg text-cream-50">{title}</span>
        {hint && <span className="text-sm text-cream-300">{hint}</span>}
      </h2>
      {children}
    </section>
  )
}
