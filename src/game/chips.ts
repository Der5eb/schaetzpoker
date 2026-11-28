// Chip-Stände mitführen: Die Spielleitung tippt die Aktionen in der Reihenfolge am Tisch an
// (checkt, geht mit, erhöht auf …, steigt aus) und beim Showdown den Gewinner.
// Wer dran ist, Pot, All-in und Nebentöpfe rechnet die App aus dem Verlauf.

import type { BlindLevel } from '../lib/types'

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin'

export interface BetAction {
  id: string
  type: ActionType
  /** Bei „erhöht“: neuer Einsatz in dieser Setzrunde (auf …) */
  to?: number
}

export interface BetRound {
  actions: BetAction[]
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

/**
 * Dealer Button: der Platz vor dem Small Blind (unter denen, die mitspielen).
 * Zu zweit ist der Small Blind selbst Dealer.
 */
export function dealerOf(order: string[], sb: string | null): string | null {
  const i = sb ? order.indexOf(sb) : -1
  if (i < 0) return null
  return order.length === 2 ? sb : order[(i - 1 + order.length) % order.length]
}

/** Dealer und Blinds der laufenden bzw. nächsten Hand */
export function tablePositions(chips: Chips): { dealer: string | null; sb: string | null; bb: string | null } {
  const hand = chips.hand
  const { sb, bb } = hand ? { sb: hand.sb, bb: hand.bb } : nextBlinds(chips)
  const order = hand ? chips.seats.filter((id) => (hand.before[id] ?? 0) > 0) : activeSeats(chips)
  return { dealer: dealerOf(order, sb), sb, bb }
}

/** Neue Hand: Blinds bestimmen und setzen. */
export function startHand(chips: Chips, blinds: BlindLevel): Hand {
  const { sb, bb } = nextBlinds(chips)
  return {
    before: { ...chips.stacks },
    blinds,
    sb,
    bb,
    rounds: [],
    winners: [],
  }
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
  // Die zuletzt durchgerechnete Setzrunde:
  /** In dieser Setzrunde gesetzt */
  street: Record<string, number>
  /** Höchster Einsatz dieser Setzrunde – so viel muss man zum Mitgehen haben */
  currentBet: number
  /** Wer jetzt dran ist (null = Setzrunde abgeschlossen) */
  next: string | null
  /** Mindestens auf diesen Betrag muss man setzen bzw. erhöhen (alles darunter nur als All-in) */
  minRaiseTo: number
  /** Darf die Person am Zug erhöhen? Nach einem zu kleinen All-in nur mitgehen oder aussteigen */
  canRaise: boolean
  /** Letzte Aktion je Spieler in dieser Setzrunde */
  last: Record<string, BetAction>
}

/** Wer in der Hand ist (hatte zu Beginn Chips), in Sitzreihenfolge */
function inHandOrder(chips: Chips, hand: Hand): string[] {
  return chips.seats.filter((id) => (hand.before[id] ?? 0) > 0)
}

/**
 * Spielt die Hand bis einschließlich Setzrunde `upTo` nach.
 * Runde 1 beginnt links vom Big Blind, spätere Runden links vom Dealer (Platz vor dem Small Blind).
 */
export function viewHand(chips: Chips, hand: Hand, upTo: number): HandView {
  const order = inHandOrder(chips, hand)
  const n = order.length
  const paid: Record<string, number> = Object.fromEntries(order.map((id) => [id, 0]))
  const folded = new Set<string>()
  const left = (id: string) => (hand.before[id] ?? 0) - paid[id]
  const bbIdx = hand.bb ? order.indexOf(hand.bb) : -1
  const dealerIdx = order.indexOf(dealerOf(order, hand.sb) ?? '')

  let street: Record<string, number> = {}
  let currentBet = 0
  let next: string | null = null
  let minRaise = hand.blinds.big
  let canRaise = true
  let last: Record<string, BetAction> = {}

  for (let r = 0; r <= upTo; r++) {
    street = Object.fromEntries(order.map((id) => [id, 0]))
    last = {}
    const put = (id: string, amount: number) => {
      const x = Math.max(0, Math.min(amount, left(id)))
      paid[id] += x
      street[id] += x
    }
    currentBet = 0
    if (r === 0) {
      if (hand.sb) put(hand.sb, hand.blinds.small)
      if (hand.bb) put(hand.bb, hand.blinds.big)
      currentBet = hand.bb ? hand.blinds.big : 0
    }
    // Mindesterhöhung = letzte volle Erhöhung dieser Runde (anfangs ein Big Blind)
    minRaise = hand.blinds.big
    // Wer seit der letzten vollen Erhöhung gehandelt hat – ein zu kleines All-in öffnet für sie nicht neu
    let acted = new Set<string>()
    let lastActor = -1
    for (const a of hand.rounds[r]?.actions ?? []) {
      if (!(a.id in paid) || folded.has(a.id)) continue
      if (a.type === 'fold') folded.add(a.id)
      else if (a.type === 'call') put(a.id, currentBet - street[a.id])
      else if (a.type === 'raise' || a.type === 'allin') {
        put(a.id, a.type === 'allin' ? left(a.id) : (a.to ?? currentBet) - street[a.id])
        if (street[a.id] > currentBet) {
          const by = street[a.id] - currentBet
          currentBet = street[a.id]
          if (by >= minRaise) {
            minRaise = by
            acted = new Set()
          }
        }
      }
      acted.add(a.id)
      last[a.id] = a
      lastActor = order.indexOf(a.id)
    }
    // Wer ist dran? Reihum ab dem letzten Akteur (bzw. dem ersten der Runde)
    next = null
    canRaise = true
    const live = order.filter((id) => !folded.has(id))
    const canAct = live.filter((id) => left(id) > 0)
    const needed = (id: string) => !acted.has(id) || street[id] < currentBet
    // Allein gegen All-ins (oder ganz allein): nur noch mitgehen, falls nötig
    const alone = live.length <= 1 || (canAct.length === 1 && street[canAct[0]] >= currentBet)
    if (!alone && n > 0) {
      const from = lastActor >= 0 ? lastActor + 1 : r === 0 ? bbIdx + 1 : dealerIdx + 1
      for (let i = 0; i < n; i++) {
        const id = order[(from + i + n) % n]
        if (folded.has(id) || left(id) <= 0) continue
        if (needed(id)) {
          next = id
          canRaise = !acted.has(id)
          break
        }
      }
    }
  }
  const live = order.filter((id) => !folded.has(id))
  const stacks = { ...chips.stacks }
  for (const id of order) stacks[id] = left(id)
  return {
    paid,
    stacks,
    live,
    folded: order.filter((id) => folded.has(id)),
    allIn: live.filter((id) => stacks[id] === 0),
    pot: Object.values(paid).reduce((a, b) => a + b, 0),
    street,
    currentBet,
    minRaiseTo: currentBet + minRaise,
    canRaise,
    next,
    last,
  }
}

/** Aktion als kurzer Text („geht mit“, „erhöht auf 120“ …) */
export function actionLabel(a: BetAction, street?: number): string {
  switch (a.type) {
    case 'fold':
      return 'steigt aus'
    case 'check':
      return 'checkt'
    case 'call':
      return 'geht mit'
    case 'raise':
      return `erhöht auf ${formatChips(street ?? a.to ?? 0)}`
    case 'allin':
      return 'all-in'
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
