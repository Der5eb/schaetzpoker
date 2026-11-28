// Chip-Stände mitführen, ohne jeden Einsatz einzeln einzutippen.
// Pro Setzrunde nur: wie viel jeder, der dabei bleibt, insgesamt in dieser Runde gesetzt hat –
// und wer ausgestiegen ist. Am Ende: wer den Pot gewinnt. Alles Weitere rechnet die App.

import type { BlindLevel } from '../lib/types'

export interface BetRound {
  /** Einsatz pro Spieler in dieser Setzrunde (inkl. Blinds in Runde 1) */
  bet: number
  /** Ausgestiegen in dieser Runde → was sie in dieser Runde schon gesetzt hatten */
  folds: Record<string, number>
}

export interface Hand {
  /** Stände zu Beginn der Hand */
  before: Record<string, number>
  blinds: BlindLevel
  sb: string | null
  bb: string | null
  /** Index = Setzrunde (0 = nach der Frage … 3 = nach der Lösung) */
  rounds: BetRound[]
  /** Gewinner je Topf (Index wie in pots()) */
  winners: string[][]
}

export interface Chips {
  start: number
  /** Sitzreihenfolge im Uhrzeigersinn */
  seats: string[]
  stacks: Record<string, number>
  /** Sitz, der als Nächstes den Big Blind zahlt */
  bbSeat: number
  hand: Hand | null
  /** Ergebnis der letzten Hand (für die Anzeige am TV) */
  last: Record<string, number> | null
}

export function newChips(seats: string[], start: number): Chips {
  return {
    start,
    seats,
    stacks: Object.fromEntries(seats.map((id) => [id, start])),
    // Der erste Big Blind ist der zweite Platz nach dem ersten (Platz 1 = Small Blind)
    bbSeat: seats.length > 1 ? 1 : 0,
    hand: null,
    last: null,
  }
}

/** Spieler kommen dazu oder gehen: Sitze angleichen, Neue bekommen den Startstand. */
export function syncSeats(chips: Chips, playerIds: string[]): Chips {
  const keep = chips.seats.filter((id) => playerIds.includes(id))
  const added = playerIds.filter((id) => !chips.seats.includes(id))
  if (added.length === 0 && keep.length === chips.seats.length) return chips
  const seats = [...keep, ...added]
  const stacks = { ...chips.stacks }
  for (const id of added) stacks[id] ??= chips.start
  // Den nächsten Big Blind möglichst bei derselben Person lassen
  const nextBb = chips.seats[chips.bbSeat % Math.max(1, chips.seats.length)]
  const bbSeat = Math.max(0, seats.indexOf(nextBb))
  return { ...chips, seats, stacks, bbSeat }
}

/** Wer noch Chips hat (in Sitzreihenfolge) */
export function activeSeats(chips: Chips): string[] {
  return chips.seats.filter((id) => (chips.stacks[id] ?? 0) > 0)
}

/** Wer in der nächsten Hand Small und Big Blind zahlt (nur Spieler mit Chips). */
export function nextBlinds(chips: Chips): { sb: string | null; bb: string | null } {
  const n = chips.seats.length
  if (activeSeats(chips).length < 2) return { sb: null, bb: null }
  const has = (id: string) => (chips.stacks[id] ?? 0) > 0
  let bbIndex = 0
  for (let i = 0; i < n; i++) {
    const idx = (chips.bbSeat + i) % n
    if (has(chips.seats[idx])) {
      bbIndex = idx
      break
    }
  }
  let sb: string | null = null
  for (let i = 1; i < n; i++) {
    const id = chips.seats[(bbIndex - i + n) % n]
    if (has(id)) {
      sb = id
      break
    }
  }
  return { sb, bb: chips.seats[bbIndex] }
}

/** Neue Hand: Blinds bestimmen und setzen. */
export function startHand(chips: Chips, blinds: BlindLevel): Hand {
  const { sb, bb } = nextBlinds(chips)
  return {
    before: { ...chips.stacks },
    blinds,
    sb,
    bb,
    rounds: [{ bet: blinds.big, folds: {} }],
    winners: [],
  }
}

export function defaultRound(hand: Hand, index: number): BetRound {
  return hand.rounds[index] ?? { bet: index === 0 ? hand.blinds.big : 0, folds: {} }
}

export function blindOf(hand: Hand, id: string): number {
  return id === hand.bb ? hand.blinds.big : id === hand.sb ? hand.blinds.small : 0
}

export interface HandView {
  /** Insgesamt in dieser Hand gesetzt */
  paid: Record<string, number>
  /** Aktueller Stand (vor der Auszahlung) */
  stacks: Record<string, number>
  /** Noch im Spiel (nicht ausgestiegen), in Sitzreihenfolge */
  live: string[]
  folded: string[]
  allIn: string[]
  pot: number
}

/**
 * Rechnet die Hand bis einschließlich Setzrunde `upTo` durch.
 * Wer weniger hat als den Einsatz, geht automatisch all-in.
 */
export function viewHand(chips: Chips, hand: Hand, upTo: number): HandView {
  const inHand = chips.seats.filter((id) => (hand.before[id] ?? 0) > 0)
  const paid: Record<string, number> = Object.fromEntries(inHand.map((id) => [id, 0]))
  const folded: string[] = []
  for (let r = 0; r <= upTo; r++) {
    const round = defaultRound(hand, r)
    for (const id of inHand) {
      if (folded.includes(id)) continue
      const left = (hand.before[id] ?? 0) - paid[id]
      const blind = r === 0 ? blindOf(hand, id) : 0
      const put = id in round.folds ? Math.max(round.folds[id], blind) : Math.max(round.bet, blind)
      paid[id] += Math.max(0, Math.min(put, left))
      if (id in round.folds) folded.push(id)
    }
  }
  const live = inHand.filter((id) => !folded.includes(id))
  const stacks = { ...chips.stacks }
  for (const id of inHand) stacks[id] = (hand.before[id] ?? 0) - paid[id]
  return {
    paid,
    stacks,
    live,
    folded,
    allIn: live.filter((id) => stacks[id] === 0),
    pot: Object.values(paid).reduce((a, b) => a + b, 0),
  }
}

export interface Pot {
  amount: number
  /** Wer diesen Topf gewinnen kann */
  eligible: string[]
}

/** Haupttopf und Nebentöpfe (bei All-in mit weniger Chips). */
export function pots(view: HandView): Pot[] {
  const levels = [...new Set(view.live.map((id) => view.paid[id]))].sort((a, b) => a - b)
  const result: Pot[] = []
  let prev = 0
  for (const level of levels) {
    let amount = 0
    for (const p of Object.values(view.paid)) amount += Math.max(0, Math.min(p, level) - prev)
    const eligible = view.live.filter((id) => view.paid[id] >= level)
    if (amount > 0) result.push({ amount, eligible })
    prev = level
  }
  // Ausgestiegene haben mehr gesetzt als der höchste Live-Einsatz? Gehört in den letzten Topf.
  const counted = result.reduce((a, p) => a + p.amount, 0)
  if (counted < view.pot && result.length > 0) result[result.length - 1].amount += view.pot - counted
  if (result.length === 0 && view.pot > 0) result.push({ amount: view.pot, eligible: view.live })
  return result
}

/** Gewinner je Topf: gewählt oder – wenn eindeutig – automatisch. */
export function potWinners(view: HandView, hand: Hand): string[][] {
  const ps = pots(view)
  return ps.map((pot, i) => {
    if (pot.eligible.length === 1) return pot.eligible
    const chosen = (hand.winners[i] ?? []).filter((id) => pot.eligible.includes(id))
    if (chosen.length) return chosen
    // Wer einen kleineren Topf gewonnen hat und hier mitspielt, gewinnt auch diesen
    for (let j = i - 1; j >= 0; j--) {
      const prev = (hand.winners[j] ?? []).filter((id) => pot.eligible.includes(id))
      if (prev.length) return prev
    }
    return []
  })
}

/** Auszahlung: neue Stände und Gewinn/Verlust je Spieler. Null, solange ein Topf keinen Gewinner hat. */
export function settle(chips: Chips, hand: Hand, view: HandView): { stacks: Record<string, number>; delta: Record<string, number> } | null {
  const ps = pots(view)
  const winners = potWinners(view, hand)
  if (ps.length === 0 || winners.some((w) => w.length === 0)) return null
  const stacks = { ...view.stacks }
  ps.forEach((pot, i) => {
    const w = chips.seats.filter((id) => winners[i].includes(id))
    const share = Math.floor(pot.amount / w.length)
    let rest = pot.amount - share * w.length
    for (const id of w) {
      stacks[id] = (stacks[id] ?? 0) + share + (rest > 0 ? 1 : 0)
      if (rest > 0) rest--
    }
  })
  const delta: Record<string, number> = {}
  for (const id of Object.keys(hand.before)) delta[id] = (stacks[id] ?? 0) - (hand.before[id] ?? 0)
  return { stacks, delta }
}

/** Hand abschließen: Stände übernehmen, Big Blind wandert einen Platz weiter. */
export function finishHand(chips: Chips): Chips {
  const hand = chips.hand
  if (!hand) return chips
  const view = viewHand(chips, hand, 3)
  const result = settle(chips, hand, view)
  const bbIndex = hand.bb ? chips.seats.indexOf(hand.bb) : chips.bbSeat - 1
  return {
    ...chips,
    stacks: result?.stacks ?? chips.stacks,
    last: result?.delta ?? null,
    hand: null,
    bbSeat: chips.seats.length ? (bbIndex + 1) % chips.seats.length : 0,
  }
}

export function totalChips(chips: Chips): number {
  return chips.seats.reduce((a, id) => a + (chips.stacks[id] ?? 0), 0)
}

export const formatChips = (n: number) => new Intl.NumberFormat('de-DE').format(n)

// Zuletzt gewählte Startchips (pro Gerät)
const START_KEY = 'schaetzpoker:startchips'
export function loadStartChips(): number | null {
  try {
    const v = Number(localStorage.getItem(START_KEY))
    return v > 0 ? v : null
  } catch {
    return null
  }
}
export function saveStartChips(n: number) {
  try {
    localStorage.setItem(START_KEY, String(n))
  } catch {
    /* egal */
  }
}
