import { useState } from 'react'
import {
  blindOf,
  defaultRound,
  formatChips,
  loadStartChips,
  newChips,
  nextBlinds,
  pots,
  potWinners,
  saveStartChips,
  settle,
  totalChips,
  viewHand,
  type BetRound,
  type Chips,
  type Hand,
} from '../game/chips'
import { Icon } from './Icon'

type Names = (id: string) => string

/** Ganze Zahl ≥ 0 eintippen; Zwischenstände (leer) bleiben lokal. */
export function ChipInput({
  value,
  onChange,
  label,
  className = '',
}: {
  value: number
  onChange: (n: number) => void
  label: string
  className?: string
}) {
  // Beim Tippen zählt der Entwurf (darf kurz leer sein), sonst der gespeicherte Wert
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      className={`field text-right font-display font-extrabold tabular-nums ${className}`}
      aria-label={label}
      inputMode="numeric"
      autoComplete="off"
      value={draft ?? String(value)}
      onFocus={(e) => {
        setDraft(String(value))
        e.target.select()
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, '')
        setDraft(raw)
        if (raw !== '') onChange(Number(raw))
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

function BlindTag({ kind }: { kind: 'sb' | 'bb' }) {
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[0.65rem] leading-none font-bold ${
        kind === 'bb' ? 'bg-gold-300 text-felt-950' : 'bg-cream-100/85 text-felt-950'
      }`}
    >
      {kind === 'bb' ? 'BB' : 'SB'}
    </span>
  )
}

/**
 * Eingabe während einer Setzrunde: ein Betrag für alle, die dabei bleiben,
 * und wer aussteigt. Den Rest (Blinds, All-in, Pot) rechnet die App.
 */
export function BetPanel({
  chips,
  hand,
  round,
  names,
  onChange,
  onDecide,
}: {
  chips: Chips
  hand: Hand
  round: number
  names: Names
  onChange: (hand: Hand) => void
  onDecide: () => void
}) {
  const r = defaultRound(hand, round)
  const view = viewHand(chips, hand, round)
  const before = round > 0 ? viewHand(chips, hand, round - 1) : null
  const atStart = before ? before.live : chips.seats.filter((id) => (hand.before[id] ?? 0) > 0)
  const paidBefore = (id: string) => before?.paid[id] ?? 0
  const big = hand.blinds.big
  const maxBet = Math.max(0, ...atStart.map((id) => (hand.before[id] ?? 0) - paidBefore(id)))

  function setRound(next: BetRound) {
    const rounds = [...hand.rounds]
    for (let i = 0; i < round; i++) rounds[i] ??= defaultRound(hand, i)
    rounds[round] = next
    onChange({ ...hand, rounds })
  }
  const setBet = (bet: number) => setRound({ ...r, bet: round === 0 ? Math.max(big, bet) : bet })
  function toggleFold(id: string) {
    const folds = { ...r.folds }
    if (id in folds) delete folds[id]
    else folds[id] = round === 0 ? blindOf(hand, id) : 0
    setRound({ ...r, folds })
  }

  const presets =
    round === 0
      ? [
          { label: 'BB', value: big },
          { label: '2× BB', value: big * 2 },
          { label: '3× BB', value: big * 3 },
          { label: '5× BB', value: big * 5 },
        ]
      : [
          { label: 'Check', value: 0 },
          { label: 'BB', value: big },
          { label: '2× BB', value: big * 2 },
          { label: '4× BB', value: big * 4 },
        ]
  const liveNow = view.live
  const onlyOne = liveNow.length === 1

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-felt-950/45 p-4" aria-label="Einsätze dieser Setzrunde">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-cream-200">
          <Icon name="chip" weight="fill" className="size-3.5 text-gold-300" /> Setzrunde {round + 1}
        </span>
        <span className="font-display text-lg font-extrabold text-gold-200 tabular-nums">Pot {formatChips(view.pot)}</span>
      </div>

      <p className="label mb-2">{round === 0 ? 'Einsatz pro Spieler (inkl. Blinds)' : 'Einsatz pro Spieler in dieser Runde'}</p>
      <div className="flex items-stretch gap-2">
        <div className="grid flex-1 grid-cols-4 gap-1.5">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              aria-pressed={r.bet === p.value}
              onClick={() => setBet(p.value)}
              className={`flex min-h-12 flex-col items-center justify-center rounded-xl border text-xs leading-tight font-semibold transition-colors ${
                r.bet === p.value ? 'border-gold-300 bg-gold-300 text-felt-950' : 'border-white/10 text-cream-100 hover:border-gold-400/60'
              }`}
            >
              {p.label}
              <span className={`tabular-nums ${r.bet === p.value ? 'text-felt-950/70' : 'text-cream-400'}`}>{formatChips(p.value)}</span>
            </button>
          ))}
        </div>
        <ChipInput value={r.bet} onChange={setBet} label="Eigener Betrag" className="w-24 shrink-0 py-2 text-xl" />
      </div>
      {maxBet > 0 && r.bet < maxBet && (
        <button type="button" className="mt-2 min-h-9 text-xs font-semibold text-gold-200 underline-offset-4 hover:underline" onClick={() => setBet(maxBet)}>
          Alle all-in ({formatChips(maxBet)})
        </button>
      )}

      <p className="label mt-4 mb-2">Wer steigt aus?</p>
      <ul className="flex flex-col gap-1.5">
        {atStart.map((id) => {
          const folded = id in r.folds
          const blind = round === 0 ? (id === hand.bb ? 'bb' : id === hand.sb ? 'sb' : null) : null
          const allIn = view.allIn.includes(id)
          return (
            <li key={id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3 py-1.5 ${folded ? 'bg-felt-950/60' : 'bg-white/[0.03]'}`}>
              <span className={`flex min-w-0 flex-1 items-center gap-1.5 ${folded ? 'text-cream-400' : 'text-cream-50'}`}>
                <span className={`truncate font-medium ${folded ? 'line-through' : ''}`}>{names(id)}</span>
                {blind && <BlindTag kind={blind} />}
                {allIn && <span className="rounded-full bg-chip-red px-1.5 py-0.5 text-[0.65rem] leading-none font-bold text-cream-50">ALL-IN</span>}
              </span>
              <span className="text-sm text-cream-300 tabular-nums">{formatChips(view.stacks[id] ?? 0)}</span>
              <button
                type="button"
                aria-pressed={folded}
                disabled={!folded && onlyOne}
                onClick={() => toggleFold(id)}
                className={`min-h-10 shrink-0 rounded-lg border px-2.5 text-xs font-semibold transition-colors disabled:opacity-30 ${
                  folded ? 'border-cream-400/40 text-cream-200' : 'border-danger/40 text-danger hover:bg-danger/10'
                }`}
              >
                {folded ? 'Doch dabei' : 'Steigt aus'}
              </button>
              {folded && (
                <label className="flex w-full items-center justify-end gap-2 pb-1 text-xs text-cream-300">
                  Hatte in dieser Runde schon gesetzt
                  <ChipInput
                    value={r.folds[id]}
                    label={`${names(id)} hatte schon gesetzt`}
                    className="w-20 py-1.5 text-base"
                    onChange={(n) => setRound({ ...r, folds: { ...r.folds, [id]: n } })}
                  />
                </label>
              )}
            </li>
          )
        })}
      </ul>

      {onlyOne && round < 3 && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-gold-400/12 p-3">
          <p className="text-sm text-gold-100">
            Nur noch <b>{names(liveNow[0])}</b> ist dabei und gewinnt den Pot.
          </p>
          <button type="button" className="btn btn-primary min-h-11 py-2 text-sm" onClick={onDecide}>
            <Icon name="crown" weight="duotone" className="size-4" /> Lösung zeigen
          </button>
        </div>
      )}
    </section>
  )
}

/** Beim Showdown: wer gewinnt den Pot (bei Gleichstand mehrere antippen). */
export function WinnerPicker({ chips, hand, names, onChange }: { chips: Chips; hand: Hand; names: Names; onChange: (hand: Hand) => void }) {
  const view = viewHand(chips, hand, 3)
  const ps = pots(view)
  const winners = potWinners(view, hand)
  const result = settle(chips, hand, view)

  function toggle(potIndex: number, id: string) {
    const all = ps.map((_, i) => hand.winners[i] ?? [])
    const cur = winners[potIndex]
    all[potIndex] = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    onChange({ ...hand, winners: all })
  }

  if (ps.length === 0) return null
  return (
    <section className="w-full rounded-2xl border border-white/[0.07] bg-felt-950/45 p-4 text-left" aria-label="Gewinner">
      {ps.map((pot, i) => (
        <div key={i} className={i > 0 ? 'mt-4 border-t border-white/[0.06] pt-4' : ''}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-cream-100">
              {ps.length === 1 ? (pot.eligible.length === 1 ? 'Pot' : 'Wer gewinnt den Pot?') : i === 0 ? 'Haupttopf' : `Nebentopf ${i}`}
            </span>
            <span className="font-display text-lg font-extrabold text-gold-200 tabular-nums">{formatChips(pot.amount)}</span>
          </div>
          {pot.eligible.length === 1 ? (
            <p className="text-sm text-cream-300">
              geht an <b className="text-cream-50">{names(pot.eligible[0])}</b>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pot.eligible.map((id) => {
                const on = winners[i].includes(id)
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(i, id)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors ${
                      on ? 'border-gold-300 bg-gold-300 text-felt-950' : 'border-white/12 text-cream-100 hover:border-gold-400/60'
                    }`}
                  >
                    {on && <Icon name="crown" weight="fill" className="size-4" />}
                    {names(id)}
                  </button>
                )
              })}
            </div>
          )}
          {pot.eligible.length > 1 && winners[i].length > 1 && <p className="mt-2 text-xs text-cream-400">Wird geteilt.</p>}
        </div>
      ))}
      {result ? (
        <ul className="mt-4 flex flex-col gap-1 border-t border-white/[0.06] pt-3 text-sm">
          {chips.seats
            .filter((id) => id in result.delta && result.delta[id] !== 0)
            .map((id) => (
              <li key={id} className="flex items-center justify-between gap-3">
                <span className="text-cream-200">{names(id)}</span>
                <span className="tabular-nums">
                  <b className={result.delta[id] > 0 ? 'text-ok' : 'text-danger'}>
                    {result.delta[id] > 0 ? '+' : '−'}
                    {formatChips(Math.abs(result.delta[id]))}
                  </b>
                  <span className="ml-2 text-cream-400">→ {formatChips(result.stacks[id])}</span>
                </span>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-cream-400">Tippe an, wer am nächsten dran war.</p>
      )}
    </section>
  )
}

/** Chip-Stände ein-/ausschalten, Sitzreihenfolge, Stände korrigieren. */
export function ChipSettings({
  chips,
  playerIds,
  names,
  bigBlind,
  locked,
  onChange,
}: {
  chips: Chips | null
  playerIds: string[]
  names: Names
  bigBlind: number
  /** Während einer Hand keine Stände ändern */
  locked: boolean
  onChange: (chips: Chips | null) => void
}) {
  const [start, setStart] = useState(() => loadStartChips() ?? bigBlind * 50)

  if (!chips) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-cream-300">
          Die App rechnet mit: pro Setzrunde gibst du nur den Einsatz ein und wer aussteigt, beim Showdown den Gewinner. Der TV zeigt die
          Stände am unteren Rand.
        </p>
        {playerIds.length < 2 ? (
          <p className="text-sm text-gold-200">Dafür mindestens zwei Spieler eintragen.</p>
        ) : (
          <>
            <label className="flex items-center justify-between gap-3">
              <span className="label">Startchips pro Spieler</span>
              <ChipInput value={start} onChange={setStart} label="Startchips pro Spieler" className="w-32 py-2 text-xl" />
            </label>
            <p className="text-xs text-cream-400">= {Math.floor(start / Math.max(1, bigBlind))} Big Blinds</p>
            <button
              type="button"
              className="btn btn-primary min-h-11"
              disabled={start <= 0}
              onClick={() => {
                saveStartChips(start)
                onChange(newChips(playerIds, start))
              }}
            >
              <Icon name="chip" weight="duotone" className="size-5" /> Chip-Stände mitführen
            </button>
          </>
        )}
      </div>
    )
  }

  const { bb } = nextBlinds(chips)
  const total = totalChips(chips)
  const expected = chips.start * chips.seats.length

  function move(i: number, dir: -1 | 1) {
    if (!chips) return
    const seats = [...chips.seats]
    const j = i + dir
    if (j < 0 || j >= seats.length) return
    ;[seats[i], seats[j]] = [seats[j], seats[i]]
    const nextBb = chips.seats[chips.bbSeat % seats.length]
    onChange({ ...chips, seats, bbSeat: seats.indexOf(nextBb) })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed text-cream-300">
        Sitzreihenfolge im Uhrzeigersinn – der Big Blind wandert nach jeder Frage einen Platz weiter.
        {locked ? ' Stände lassen sich nach dem Showdown wieder ändern.' : ' Stände bei Bedarf hier korrigieren.'}
      </p>
      <ol className="flex flex-col gap-1.5">
        {chips.seats.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-xl bg-white/[0.03] py-1 pr-1 pl-3">
            <span className="w-5 text-xs text-cream-400 tabular-nums">{i + 1}.</span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="truncate font-medium text-cream-50">{names(id)}</span>
              {id === bb && <BlindTag kind="bb" />}
            </span>
            <ChipInput
              value={chips.stacks[id] ?? 0}
              label={`Stand von ${names(id)}`}
              className={`w-24 py-1.5 text-base ${locked ? 'pointer-events-none opacity-50' : ''}`}
              onChange={(n) => !locked && onChange({ ...chips, stacks: { ...chips.stacks, [id]: n } })}
            />
            <span className="flex">
              <button type="button" className="btn-icon size-10 disabled:opacity-25" aria-label={`${names(id)} nach oben`} disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="up" className="size-4" />
              </button>
              <button
                type="button"
                className="btn-icon size-10 disabled:opacity-25"
                aria-label={`${names(id)} nach unten`}
                disabled={i === chips.seats.length - 1}
                onClick={() => move(i, 1)}
              >
                <Icon name="down" className="size-4" />
              </button>
            </span>
          </li>
        ))}
      </ol>
      {!locked && chips.seats.length > 1 && (
        <label className="flex items-center justify-between gap-3">
          <span className="label">Nächster Big Blind</span>
          <select
            className="field w-auto py-2"
            value={bb ?? ''}
            onChange={(e) => onChange({ ...chips, bbSeat: Math.max(0, chips.seats.indexOf(e.target.value)) })}
          >
            {chips.seats.map((id) => (
              <option key={id} value={id}>
                {names(id)}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className={`text-xs ${total === expected ? 'text-cream-400' : 'text-gold-200'}`}>
        Im Spiel: {formatChips(total)} Chips
        {total !== expected && ` (Start: ${formatChips(expected)} – Nachkauf oder Zählfehler?)`}
      </p>
      <button type="button" className="min-h-11 self-start text-sm text-cream-400 underline-offset-4 hover:text-cream-100 hover:underline" onClick={() => onChange(null)}>
        Chip-Stände nicht mehr mitführen
      </button>
    </div>
  )
}
