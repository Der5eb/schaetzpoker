import type { BlindLevel, Media } from '../lib/types'
import type { Chips } from './chips'

export type Phase = 'lobby' | 'category' | 'round' | 'showdown' | 'blinds' | 'ended'

/** pick = der Big Blind wählt die Kategorie, random = die App zieht eine zufällige Frage */
export type QuestionMode = 'pick' | 'random'

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
  /** Wie die nächste Frage gefunden wird – wird vor Spielbeginn festgelegt */
  questionMode: QuestionMode
  /** Chip-Stände der Spieler – null = werden nicht mitgeführt */
  chips: Chips | null
}

export const initialState: GameState = {
  phase: 'lobby',
  completed: 0,
  categoryId: null,
  questionId: null,
  reveal: 0,
  decided: false,
  focus: null,
  questionMode: 'pick',
  chips: null,
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
  questionMode: QuestionMode
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
  /** Beginn des Abends (für den Abschluss „Der Abend in Zahlen“) */
  startedAt: string
  /** Zum Abschluss: alle an diesem Abend gespielten Fragen mit Lösung */
  recap: { title: string; answer: string; value: number | null }[]
  /** Chip-Stände am Tisch (null = werden nicht mitgeführt) */
  chips: DisplayChips | null
}

export interface DisplaySeat {
  id: string
  name: string
  stack: number
  /** In dieser Hand gesetzt */
  inPot: number
  folded: boolean
  allIn: boolean
  /** Keine Chips mehr */
  out: boolean
  blind: 'sb' | 'bb' | null
  /** Hat den Dealer Button */
  dealer: boolean
  /** Ist gerade dran */
  toAct: boolean
  /** Letzte Aktion in dieser Setzrunde („geht mit“, „erhöht auf 120“ …) */
  action: string | null
  /** Gewinn/Verlust der letzten bzw. gerade entschiedenen Hand */
  delta: number | null
}

export interface DisplayChips {
  seats: DisplaySeat[]
  pot: number
  /** Gerade eine Hand am Laufen (Pot anzeigen) */
  inHand: boolean
  /** Wer als Nächstes (bzw. gerade) den Big Blind zahlt */
  bigBlind: string | null
}

export type VideoCommand = { key: string; cmd: 'play' | 'pause' | 'restart' }
