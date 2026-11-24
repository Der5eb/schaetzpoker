import { deleteMediaFiles } from './media'
import { supabase } from './supabase'
import type { Category, Media, Question } from './types'

function db() {
  if (!supabase) throw new Error('Supabase nicht konfiguriert')
  return supabase
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS = [
  '#d4a84b', '#c8423b', '#3f8fc9', '#5aa469', '#9a6bc4',
  '#e07b39', '#2fa39b', '#c75b8f', '#8a9a3c', '#6b7fd7',
]

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await db().from('categories').select('*').order('sort_order').order('name')
  if (error) throw error
  return data as Category[]
}

export async function createCategory(name: string, existing: Category[]): Promise<Category> {
  const used = new Set(existing.map((c) => c.color))
  const color = CATEGORY_COLORS.find((c) => !used.has(c)) ?? CATEGORY_COLORS[existing.length % CATEGORY_COLORS.length]
  const { data, error } = await db().from('categories').insert({ name: name.trim(), color }).select().single()
  if (error) throw error
  return data as Category
}

/** Sucht eine Kategorie (Groß-/Kleinschreibung egal) oder legt sie an. */
export async function ensureCategory(name: string, existing: Category[]): Promise<{ category: Category; created: boolean }> {
  const key = name.trim().toLocaleLowerCase('de')
  const found = existing.find((c) => c.name.trim().toLocaleLowerCase('de') === key)
  if (found) return { category: found, created: false }
  return { category: await createCategory(name, existing), created: true }
}

export async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color'>>): Promise<void> {
  const { error } = await db().from('categories').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await db().from('categories').delete().eq('id', id)
  if (error) throw error
}

/** Verschiebt alle Fragen von `fromId` nach `intoId` und löscht danach `fromId`. */
export async function mergeCategory(fromId: string, intoId: string): Promise<void> {
  const { error } = await db().from('questions').update({ category_id: intoId }).eq('category_id', fromId)
  if (error) throw error
  await deleteCategory(fromId)
}

// ---------------------------------------------------------------------------
// Fragen
// ---------------------------------------------------------------------------

export type QuestionInput = Omit<Question, 'id' | 'owner_id' | 'created_at' | 'updated_at'>

export function emptyQuestion(): QuestionInput {
  return {
    category_id: null,
    title: '',
    question: '',
    question_media: [],
    hint1: '',
    hint1_media: [],
    hint2: '',
    hint2_media: [],
    answer: null,
    answer_unit: '',
    answer_display: '',
    explanation: '',
    explanation_media: [],
    notes: '',
    source: '',
    status: 'draft',
    played_at: null,
  }
}

/** Nur die bearbeitbaren Felder einer Frage. */
export function toInput(q: Question | QuestionInput): QuestionInput {
  const base = emptyQuestion()
  const out = { ...base } as Record<string, unknown>
  for (const key of Object.keys(base)) out[key] = (q as unknown as Record<string, unknown>)[key]
  return out as unknown as QuestionInput
}

export async function fetchQuestions(): Promise<Question[]> {
  const { data, error } = await db().from('questions').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as Question[]
}

export async function fetchQuestion(id: string): Promise<Question> {
  const { data, error } = await db().from('questions').select('*').eq('id', id).single()
  if (error) throw error
  return data as Question
}

export async function createQuestion(q: QuestionInput): Promise<Question> {
  const { data, error } = await db().from('questions').insert(q).select().single()
  if (error) throw error
  return data as Question
}

export async function updateQuestion(id: string, q: Partial<QuestionInput>): Promise<Question> {
  const { data, error } = await db().from('questions').update(q).eq('id', id).select().single()
  if (error) throw error
  return data as Question
}

export function imagePaths(media: Media[]): string[] {
  return media.flatMap((m) => (m.type === 'image' ? [m.path] : []))
}

export function allImagePaths(q: QuestionInput): string[] {
  return [q.question_media, q.hint1_media, q.hint2_media, q.explanation_media].flatMap(imagePaths)
}

export async function deleteQuestion(q: Question): Promise<void> {
  const { error } = await db().from('questions').delete().eq('id', q.id)
  if (error) throw error
  await deleteMediaFiles(allImagePaths(q))
}

/** Was für "spielbereit" noch fehlt. */
export function missingForReady(q: QuestionInput): string[] {
  const missing: string[] = []
  if (!q.question.trim() && q.question_media.length === 0) missing.push('Frage')
  if (!q.hint1.trim() && q.hint1_media.length === 0) missing.push('Hinweis 1')
  if (!q.hint2.trim() && q.hint2_media.length === 0) missing.push('Hinweis 2')
  if (q.answer == null) missing.push('Lösung als Zahl')
  return missing
}

// ---------------------------------------------------------------------------
// KI-Vorschlag (Supabase Edge Function "suggest" → Gemini)
// ---------------------------------------------------------------------------

export interface Suggestion {
  title: string
  category: string
}

export async function suggestMeta(q: QuestionInput, categoryNames: string[]): Promise<Suggestion> {
  const { data, error } = await db().functions.invoke('suggest', {
    body: {
      question: q.question,
      hint1: q.hint1,
      hint2: q.hint2,
      answer: q.answer_display || (q.answer != null ? `${q.answer} ${q.answer_unit}`.trim() : ''),
      explanation: q.explanation,
      categories: categoryNames,
    },
  })
  if (error) throw error
  const s = data as Partial<Suggestion> & { error?: string }
  if (s.error || !s.title || !s.category) throw new Error(s.error ?? 'Leerer KI-Vorschlag')
  return { title: s.title.trim(), category: s.category.trim() }
}
