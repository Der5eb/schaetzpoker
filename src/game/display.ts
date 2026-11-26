import { formatAnswer } from '../lib/format'
import type { Category, Game, PlayRecord, Question } from '../lib/types'
import { blindInfo, levelAt } from './blinds'
import type { DisplayState, GameState } from './types'

/** Wer am Tisch sitzt und wer welche Frage schon kennt. */
export interface Audience {
  playerIds: string[]
  history: PlayRecord[]
  /** Laufender Abend: was dort schon gespielt wurde, kommt nicht noch einmal */
  game?: Pick<Game, 'id' | 'started_at'>
}

/**
 * Fragen, die am Spielabend noch auswählbar sind.
 * Ohne Spieler: nur Fragen, die noch nie gespielt wurden.
 * Mit Spielern: alle Fragen, die keiner am Tisch kennt. War bei einem früheren
 * Abend unbekannt, wer dabei war, gilt die Frage vorsichtshalber als bekannt.
 */
export function availableQuestions(questions: Question[], audience?: Audience): Question[] {
  const ready = questions.filter((q) => q.status === 'ready')
  const game = audience?.game
  const history = audience?.history ?? []
  const playedTonight = (q: Question) =>
    !!game && ((!!q.played_at && q.played_at >= game.started_at) || history.some((r) => r.game_id === game.id && r.question_id === q.id))

  if (!audience || audience.playerIds.length === 0) return ready.filter((q) => !q.played_at && !playedTonight(q))

  const atTable = new Set(audience.playerIds)
  const byQuestion = new Map<string, PlayRecord[]>()
  for (const r of history) byQuestion.set(r.question_id, [...(byQuestion.get(r.question_id) ?? []), r])

  return ready.filter((q) => {
    if (playedTonight(q)) return false
    // „Wieder freigeben“ im Editor setzt played_at zurück – dann ist sie für alle neu
    if (!q.played_at) return true
    const plays = byQuestion.get(q.id) ?? []
    if (plays.length === 0) return false
    return plays.every((r) => r.player_ids.length > 0 && !r.player_ids.some((p) => atTable.has(p)))
  })
}

/** Baut aus dem vollständigen Spielstand das, was der TV sehen darf. */
export function buildDisplay(
  game: Pick<Game, 'name' | 'blind_levels' | 'questions_per_level' | 'started_at'>,
  state: GameState,
  categories: Category[],
  questions: Question[],
  audience?: Audience,
): DisplayState {
  const info = blindInfo(game.blind_levels, game.questions_per_level, state.completed)
  const available = availableQuestions(questions, audience)
  const counts = new Map<string, number>()
  for (const q of available) if (q.category_id) counts.set(q.category_id, (counts.get(q.category_id) ?? 0) + 1)

  const category = categories.find((c) => c.id === state.categoryId)
  const inRound = state.phase === 'round' || state.phase === 'showdown'
  const q = inRound ? questions.find((x) => x.id === state.questionId) : undefined
  const reveal = q ? (state.phase === 'showdown' ? 3 : state.reveal) : 0

  return {
    phase: state.phase,
    questionMode: state.questionMode,
    gameName: game.name,
    questionNumber: state.completed + 1,
    // Am Ende: die Blinds der zuletzt gespielten Frage statt der nächsten Stufe
    blinds:
      state.phase === 'ended'
        ? blindInfo(game.blind_levels, game.questions_per_level, Math.max(0, state.completed - 1)).current
        : info.current,
    nextBlinds: info.next,
    untilIncrease: info.untilIncrease,
    previousBlinds: state.phase === 'blinds' && info.levelIndex > 0 ? levelAt(game.blind_levels, info.levelIndex - 1) : null,
    categories:
      state.phase === 'category'
        ? categories
            .filter((c) => (counts.get(c.id) ?? 0) > 0)
            .map((c) => ({ id: c.id, name: c.name, color: c.color, count: counts.get(c.id) ?? 0 }))
        : [],
    pickedCategory: state.phase === 'category' && state.questionMode !== 'random' ? state.categoryId : null,
    category: q && category ? { name: category.name, color: category.color } : null,
    question: q ? { text: q.question, media: q.question_media } : null,
    hints: q
      ? [
          { text: q.hint1, media: q.hint1_media },
          { text: q.hint2, media: q.hint2_media },
        ].slice(0, Math.min(2, reveal))
      : [],
    answer:
      q && reveal >= 3
        ? { display: formatAnswer(q), explanation: { text: q.explanation, media: q.explanation_media } }
        : null,
    reveal,
    decided: state.decided,
    startedAt: game.started_at,
    recap:
      state.phase === 'ended'
        ? questions
            .filter((x) => x.played_at && x.played_at >= game.started_at)
            .sort((a, b) => (a.played_at ?? '').localeCompare(b.played_at ?? ''))
            .map((x) => ({ title: x.title, answer: formatAnswer(x), value: x.answer }))
        : [],
    focus: q && state.focus && isZoomable(state.focus, reveal) ? state.focus : null,
  }
}

/** Schlüssel, mit denen die Spielleitung einzelne Videos auf dem TV steuert. */
export const mediaKey = {
  question: (i: number) => `q-${i}`,
  hint: (h: number, i: number) => `h${h}-${i}`,
  answer: (i: number) => `a-${i}`,
}

/**
 * Ob ein Medium gerade am TV zu sehen ist und damit vergrößert werden darf.
 * Bis zur Lösung: Frage + aufgedeckte Hinweise. Ab der Lösung: nur die Erklärung.
 */
export function isZoomable(key: string, reveal: number): boolean {
  if (key.startsWith('q-')) return reveal < 3
  if (key.startsWith('h1-')) return reveal >= 1 && reveal < 3
  if (key.startsWith('h2-')) return reveal === 2
  if (key.startsWith('a-')) return reveal >= 3
  return false
}
