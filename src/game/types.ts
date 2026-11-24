import type { BlindLevel, Media } from '../lib/types'

export type Phase = 'lobby' | 'category' | 'round' | 'blinds' | 'ended'

/** Spielstand – gehört der Spielleitung, wird in games.state gespeichert. */
export interface GameState {
  phase: Phase
  /** Anzahl abgeschlossener Fragen an diesem Abend */
  completed: number
  categoryId: string | null
  questionId: string | null
  /** 0 = Frage, 1 = Hinweis 1, 2 = Hinweis 2, 3 = Lösung */
  reveal: number
  /** Nur noch ein Spieler übrig – ohne weitere Setzrunden aufgelöst */
  decided: boolean
  /** Medium, das am TV groß gezeigt wird (Schlüssel aus mediaKey), sonst null */
  focus: string | null
}

export const initialState: GameState = {
  phase: 'lobby',
  completed: 0,
  categoryId: null,
  questionId: null,
  reveal: 0,
  decided: false,
  focus: null,
}

export interface DisplayBlock {
  text: string
  media: Media[]
}

/**
 * Was der TV anzeigt. Enthält nur bereits Aufgedecktes –
 * Hinweise und Lösung kommen erst beim Aufdecken auf den Bildschirm.
 */
export interface DisplayState {
  phase: Phase
  gameName: string
  /** Nummer der aktuellen bzw. nächsten Frage (1-basiert) */
  questionNumber: number
  blinds: BlindLevel
  nextBlinds: BlindLevel
  /** Fragen bis zur nächsten Erhöhung, inkl. der aktuellen */
  untilIncrease: number
  previousBlinds: BlindLevel | null
  categories: { id: string; name: string; color: string; count: number }[]
  /** Vom Big Blind gewählte Kategorie, solange die Spielleitung die Frage aussucht */
  pickedCategory: string | null
  category: { name: string; color: string } | null
  question: DisplayBlock | null
  hints: DisplayBlock[]
  answer: { display: string; explanation: DisplayBlock } | null
  reveal: number
  decided: boolean
  /** Groß gezeigtes Medium (nur bereits aufgedeckte), sonst null */
  focus: string | null
}

export type VideoCommand = { key: string; cmd: 'play' | 'pause' | 'restart' }
