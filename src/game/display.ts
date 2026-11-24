import { formatAnswer } from '../lib/format'
import type { Category, Game, Question } from '../lib/types'
import { blindInfo, levelAt } from './blinds'
import type { DisplayState, GameState } from './types'

/** Fragen, die am Spielabend noch auswählbar sind. */
export function availableQuestions(questions: Question[]): Question[] {
  return questions.filter((q) => q.status === 'ready' && !q.played_at)
}

/** Baut aus dem vollständigen Spielstand das, was der TV sehen darf. */
export function buildDisplay(
  game: Pick<Game, 'name' | 'blind_levels' | 'questions_per_level'>,
  state: GameState,
  categories: Category[],
  questions: Question[],
): DisplayState {
  const info = blindInfo(game.blind_levels, game.questions_per_level, state.completed)
  const available = availableQuestions(questions)
  const counts = new Map<string, number>()
  for (const q of available) if (q.category_id) counts.set(q.category_id, (counts.get(q.category_id) ?? 0) + 1)

  const category = categories.find((c) => c.id === state.categoryId)
  const q = state.phase === 'round' ? questions.find((x) => x.id === state.questionId) : undefined
  const reveal = q ? state.reveal : 0

  return {
    phase: state.phase,
    gameName: game.name,
    questionNumber: state.completed + 1,
    blinds: info.current,
    nextBlinds: info.next,
    untilIncrease: info.untilIncrease,
    previousBlinds: state.phase === 'blinds' && info.levelIndex > 0 ? levelAt(game.blind_levels, info.levelIndex - 1) : null,
    categories:
      state.phase === 'category'
        ? categories
            .filter((c) => (counts.get(c.id) ?? 0) > 0)
            .map((c) => ({ id: c.id, name: c.name, color: c.color, count: counts.get(c.id) ?? 0 }))
        : [],
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
