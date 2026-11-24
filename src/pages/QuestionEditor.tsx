import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { MediaEditor } from '../components/MediaEditor'
import { ActionBar, SectionTitle, Shell } from '../components/Shell'
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
    return (
      <Shell title="Frage" back="/bibliothek">
        <p className="text-cream-400">Lädt …</p>
      </Shell>
    )
  }

  const category = categories.find((c) => c.id === form.category_id)

  return (
    <Shell title={isNew ? 'Neue Frage' : 'Frage bearbeiten'} back={isNew ? '/' : '/bibliothek'}>
      {justSaved && original && (
        <div className="animate-focus-in mb-7 overflow-hidden rounded-2xl border border-gold-400/40 bg-[linear-gradient(135deg,rgb(209_164_70/0.18),rgb(209_164_70/0.04))] p-4 shadow-[var(--shadow-lift)]">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold-400 text-felt-950">
              <Icon name="check" weight="bold" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gold-200">Gespeichert</p>
              <p className="mt-0.5 font-display text-xl leading-snug font-extrabold text-cream-50">{original.title}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-cream-300">
                {category && <span className="size-2 rounded-full" style={{ background: category.color }} />}
                {category?.name ?? 'ohne Kategorie'}
              </p>
              {navState?.aiFailed && (
                <p className="mt-2 text-sm text-gold-200">KI nicht erreichbar – Überschrift und Kategorie unten ergänzen.</p>
              )}
            </div>
          </div>
          <button type="button" className="btn btn-primary mt-4 w-full" onClick={startNew}>
            <Icon name="plus" weight="bold" className="size-4" /> Nächste Frage erfassen
          </button>
        </div>
      )}

      <div className="flex flex-col pb-32">
        <Step icon="cards" title="Frage">
          <textarea
            className="field text-[1.0625rem]"
            aria-label="Frage"
            placeholder="Wie hoch ist …?"
            value={form.question}
            onChange={(e) => set('question', e.target.value)}
          />
          <MediaEditor value={form.question_media} onChange={setMedia('question_media')} onImageRemoved={onImageRemoved} />
        </Step>

        <Step icon="club" title="Hinweis 1" hint="eher vage">
          <textarea className="field" aria-label="Hinweis 1" value={form.hint1} onChange={(e) => set('hint1', e.target.value)} />
          <MediaEditor value={form.hint1_media} onChange={setMedia('hint1_media')} onImageRemoved={onImageRemoved} />
        </Step>

        <Step icon="diamond" title="Hinweis 2" hint="hilfreicher">
          <textarea className="field" aria-label="Hinweis 2" value={form.hint2} onChange={(e) => set('hint2', e.target.value)} />
          <MediaEditor value={form.hint2_media} onChange={setMedia('hint2_media')} onImageRemoved={onImageRemoved} />
        </Step>

        <Step icon="spade" title="Lösung" last>
          <div className="flex gap-2">
            <label className="flex flex-[2] flex-col gap-1.5">
              <span className="label">Zahl</span>
              <input
                className="field font-display text-xl font-extrabold tabular-nums"
                inputMode="decimal"
                placeholder="8849"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="label">Einheit</span>
              <input className="field text-xl" placeholder="m" value={form.answer_unit} onChange={(e) => set('answer_unit', e.target.value)} />
            </label>
          </div>
          {answerInvalid ? (
            <p className="text-sm text-danger">Keine gültige Zahl – z. B. 8849 oder 3,14.</p>
          ) : current.answer != null ? (
            <p className="text-sm text-cream-400">
              Am TV: <span className="font-display text-base font-extrabold text-gold-200">{formatAnswer(current)}</span>
            </p>
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="label">Eigene Anzeige (optional)</span>
            <input className="field" placeholder="z. B. „ca. 8,8 km“" value={form.answer_display} onChange={(e) => set('answer_display', e.target.value)} />
          </label>
        </Step>

        <div className="mt-10 flex flex-col gap-10">
          <Section title="Auflösung & Erklärung" hint="optional">
            <textarea
              className="field"
              aria-label="Erklärung"
              placeholder="Hintergrund, Einordnung, Fun Fact …"
              value={form.explanation}
              onChange={(e) => set('explanation', e.target.value)}
            />
            <MediaEditor value={form.explanation_media} onChange={setMedia('explanation_media')} onImageRemoved={onImageRemoved} />
          </Section>

          <Section title="Nur für die Spielleitung" hint="optional">
            <textarea className="field" aria-label="Notizen" placeholder="Notizen" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            <input className="field" aria-label="Quelle" placeholder="Quelle (Link oder Titel)" value={form.source} onChange={(e) => set('source', e.target.value)} />
          </Section>

          <Section title="Einordnung" hint={isNew ? 'vergibt die KI beim Speichern' : undefined}>
            <div className="flex gap-2">
              <input className="field" aria-label="Überschrift" placeholder="Überschrift" value={form.title} onChange={(e) => set('title', e.target.value)} />
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                onClick={suggestNow}
                disabled={suggesting}
                aria-label="KI-Vorschlag für Überschrift und Kategorie"
                title="KI-Vorschlag"
              >
                <Icon name="sparkle" weight="duotone" className={`size-5 text-gold-300 ${suggesting ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="flex gap-2">
              <select className="field" aria-label="Kategorie" value={form.category_id ?? ''} onChange={(e) => set('category_id', e.target.value || null)}>
                <option value="">Kategorie wählen</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-ghost btn-icon" onClick={addCategory} aria-label="Neue Kategorie" title="Neue Kategorie">
                <Icon name="plus" />
              </button>
            </div>

            <label
              className={`flex cursor-pointer items-center gap-3.5 rounded-2xl border px-4 py-3.5 transition-colors ${
                form.status === 'ready' ? 'border-gold-400/50 bg-gold-400/10' : 'border-white/10 bg-felt-950/40'
              }`}
            >
              <input type="checkbox" className="peer sr-only" checked={form.status === 'ready'} onChange={(e) => toggleReady(e.target.checked)} />
              <span
                aria-hidden="true"
                className="relative h-7 w-12 shrink-0 rounded-full bg-felt-700 transition-colors peer-checked:bg-gold-400 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-300 after:absolute after:top-1 after:left-1 after:size-5 after:rounded-full after:bg-cream-100 after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-5"
              />
              <span>
                <span className="block font-semibold text-cream-50">Spielbereit</span>
                <span className="block text-sm text-cream-400">Erscheint am Spielabend bei der Kategorie-Wahl</span>
              </span>
            </label>
            {readyHint && <p className="text-sm text-gold-200">{readyHint}</p>}
            {form.played_at && (
              <div className="flex items-center justify-between gap-3 text-sm text-cream-400">
                <span>Gespielt am {new Date(form.played_at).toLocaleDateString('de-DE')}</span>
                <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => set('played_at', null)}>
                  Wieder freigeben
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
      </div>

      <ActionBar>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="button" className="btn btn-primary w-full py-3.5 text-base" onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Icon name="chip" weight="duotone" className="size-5 animate-spin" /> Speichert …
            </>
          ) : (
            'Speichern'
          )}
        </button>
      </ActionBar>
    </Shell>
  )
}

/** Schritt der Runde: Frage → Hinweis 1 → Hinweis 2 → Lösung, verbunden durch eine Linie. */
function Step({ icon, title, hint, last, children }: { icon: IconName; title: string; hint?: string; last?: boolean; children: ReactNode }) {
  return (
    <section className="relative grid grid-cols-[2.25rem_1fr] gap-x-3">
      <div className="flex flex-col items-center">
        <span className="grid size-9 place-items-center rounded-full border border-gold-400/40 bg-felt-950/70 text-gold-300 shadow-[0_4px_10px_-4px_rgb(0_0_0/0.8)]">
          <Icon name={icon} weight="fill" className="size-[1.05rem]" />
        </span>
        {!last && <span className="my-1.5 w-px flex-1 bg-gradient-to-b from-gold-400/35 to-gold-400/5" />}
      </div>
      <div className={`flex min-w-0 flex-col gap-3 ${last ? '' : 'pb-8'}`}>
        <h2 className="flex min-h-9 items-baseline gap-2 pt-1">
          <span className="font-display text-xl font-extrabold text-cream-50">{title}</span>
          {hint && <span className="text-sm text-cream-400">{hint}</span>}
        </h2>
        {children}
      </div>
    </section>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle hint={hint}>{title}</SectionTitle>
      {children}
    </section>
  )
}
