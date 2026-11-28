import { useState } from 'react'
import {
  actionLabel,
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
  type BetAction,
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
 * Eingabe während einer Setzrunde: Die App zeigt, wer dran ist –
 * die Spielleitung tippt an, was die Person macht.
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
  const [raising, setRaising] = useState(false)
  const [amount, setAmount] = useState(0)
  const actions = hand.rounds[round]?.actions ?? []
  const view = viewHand(chips, hand, round)
  const startOrder = chips.seats.filter((id) => (hand.before[id] ?? 0) > 0 && (round === 0 || !viewHand(chips, hand, round - 1).folded.includes(id)))
  const big = hand.blinds.big
  const next = view.next
  const toCall = next ? Math.max(0, view.currentBet - view.street[next]) : 0
  const stack = next ? (view.stacks[next] ?? 0) : 0
  const maxTo = next ? view.street[next] + stack : 0

  function withActions(list: BetAction[]): Hand {
    const rounds = [...hand.rounds]
    for (let i = 0; i < round; i++) rounds[i] ??= { actions: [] }
    rounds[round] = { actions: list }
    return { ...hand, rounds }
  }
  function act(a: BetAction) {
    setRaising(false)
    onChange(withActions([...actions, a]))
  }
  function raiseTo(to: number) {
    if (!next) return
    if (to >= maxTo) act({ id: next, type: 'allin' })
    else if (to >= minTo) act({ id: next, type: 'raise', to })
  }
  /** Alle, die noch dran wären, gehen mit bzw. checken */
  function restCall() {
    let list = actions
    for (let i = 0; i < 30; i++) {
      const v = viewHand(chips, withActions(list), round)
      if (!v.next) break
      const need = v.currentBet - v.street[v.next]
      list = [...list, { id: v.next, type: need > 0 ? 'call' : 'check' }]
    }
    setRaising(false)
    onChange(withActions(list))
  }

  // Erhöhen geht nur um mindestens die letzte Erhöhung – darunter nur als All-in
  const minTo = view.minRaiseTo
  const cb = view.currentBet
  const raisePresets = (
    cb > 0
      ? [
          { label: 'Min.', to: minTo },
          { label: '2×', to: cb * 2 },
          { label: '3×', to: cb * 3 },
          { label: '4×', to: cb * 4 },
        ]
      : [
          { label: 'BB', to: big },
          { label: '2× BB', to: big * 2 },
          { label: '4× BB', to: big * 4 },
        ]
  )
    .filter((p, i, all) => p.to >= minTo && p.to < maxTo && all.findIndex((q) => q.to === p.to) === i)
    .slice(0, 3)
  const amountOk = amount >= minTo || amount >= maxTo
  const onlyOne = view.live.length === 1
  const blindOf = (id: string) => (round === 0 ? (id === hand.bb ? 'bb' : id === hand.sb ? 'sb' : null) : null)

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-felt-950/45 p-4" aria-label="Setzrunde">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold text-cream-200">
          <Icon name="chip" weight="fill" className="size-3.5 text-gold-300" /> Setzrunde {round + 1}
        </span>
        <span className="font-display text-lg font-extrabold text-gold-200 tabular-nums">Pot {formatChips(view.pot)}</span>
      </div>

      {next ? (
        <div className="flex flex-col gap-2.5 rounded-xl bg-gold-400/10 p-3 ring-1 ring-gold-400/40">
          <p className="flex items-baseline justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-gold-200">Am Zug</span>
              <b className="font-display text-xl font-extrabold text-cream-50">{names(next)}</b>
              {blindOf(next) && <BlindTag kind={blindOf(next)!} />}
            </span>
            <span className="text-xs text-cream-300 tabular-nums">hat {formatChips(stack)}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-ghost min-h-12 border-danger/40! text-danger" onClick={() => act({ id: next, type: 'fold' })}>
              Steigt aus
            </button>
            {toCall === 0 ? (
              <button type="button" className="btn btn-primary min-h-12" onClick={() => act({ id: next, type: 'check' })}>
                Checkt
              </button>
            ) : toCall >= stack ? (
              <button type="button" className="btn btn-primary min-h-12" onClick={() => act({ id: next, type: 'allin' })}>
                Geht mit (all-in {formatChips(stack)})
              </button>
            ) : (
              <button type="button" className="btn btn-primary min-h-12" onClick={() => act({ id: next, type: 'call' })}>
                Geht mit {formatChips(toCall)}
              </button>
            )}
            {stack > toCall && view.canRaise && (
              <button
                type="button"
                aria-expanded={raising}
                className={`btn btn-ghost col-span-2 min-h-12 ${raising ? 'border-gold-300!' : ''}`}
                onClick={() => {
                  setAmount(Math.min(minTo, maxTo))
                  setRaising(!raising)
                }}
              >
                {view.currentBet > 0 ? 'Erhöht auf …' : 'Setzt …'}
              </button>
            )}
          </div>
          {raising && (
            <div className="animate-enter flex flex-col gap-2">
              <div className="grid grid-cols-4 gap-1.5">
                {raisePresets.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => raiseTo(p.to)}
                    className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-white/10 text-xs leading-tight font-semibold text-cream-100 hover:border-gold-400/60"
                  >
                    {p.label}
                    <span className="text-cream-400 tabular-nums">{formatChips(p.to)}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => act({ id: next, type: 'allin' })}
                  className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-chip-red/60 bg-chip-red/15 text-xs leading-tight font-semibold text-cream-50"
                >
                  All-in
                  <span className="text-cream-300 tabular-nums">{formatChips(maxTo)}</span>
                </button>
              </div>
              <div className="flex gap-2">
                <ChipInput value={amount} onChange={setAmount} label="Erhöhen auf" className="flex-1 py-2 text-xl" />
                <button type="button" className="btn btn-primary shrink-0" disabled={!amountOk} onClick={() => raiseTo(amount)}>
                  {view.currentBet > 0 ? 'Erhöhen' : 'Setzen'}
                </button>
              </div>
              <p className={`text-xs ${amountOk ? 'text-cream-400' : 'text-gold-200'}`}>
                {maxTo <= minTo
                  ? `Für eine volle Erhöhung (auf ${formatChips(minTo)}) reichen die Chips nicht – nur All-in.`
                  : cb > 0
                    ? `Mindestens auf ${formatChips(minTo)} – also um so viel wie die letzte Erhöhung.`
                    : `Mindestens ${formatChips(minTo)} (ein Big Blind).`}
              </p>
            </div>
          )}
          {!view.canRaise && toCall > 0 && (
            <p className="text-xs text-cream-300">Das All-in war kleiner als eine volle Erhöhung – {names(next)} darf nur mitgehen oder aussteigen.</p>
          )}
          <button type="button" className="min-h-10 self-start text-xs font-semibold text-gold-200 underline-offset-4 hover:underline" onClick={restCall}>
            {view.currentBet > Math.min(...view.live.map((id) => view.street[id])) ? 'Alle übrigen gehen mit' : 'Alle übrigen checken'}
          </button>
        </div>
      ) : onlyOne ? (
        round < 3 && (
          <div className="flex flex-col gap-2 rounded-xl bg-gold-400/12 p-3">
            <p className="text-sm text-gold-100">
              Nur noch <b>{names(view.live[0])}</b> ist dabei und gewinnt den Pot.
            </p>
            <button type="button" className="btn btn-primary min-h-11 py-2 text-sm" onClick={onDecide}>
              <Icon name="crown" weight="duotone" className="size-4" /> Lösung zeigen
            </button>
          </div>
        )
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-ok/10 px-3 py-2.5 text-sm text-cream-100">
          <Icon name="check" weight="bold" className="size-4 text-ok" />
          {round < 3 ? 'Setzrunde abgeschlossen – weiter mit dem Aufdecken.' : 'Setzrunde abgeschlossen – weiter zum Showdown.'}
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-1">
        {startOrder.map((id) => {
          const a = view.last[id]
          const out = view.folded.includes(id)
          const blind = blindOf(id)
          return (
            <li
              key={id}
              className={`flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-sm ${id === next ? 'bg-gold-400/10' : ''} ${out ? 'text-cream-400' : 'text-cream-100'}`}
            >
              <span className={`min-w-0 flex-1 truncate ${out ? 'line-through' : ''}`}>{names(id)}</span>
              {blind && <BlindTag kind={blind} />}
              <span className="w-28 text-right text-xs text-cream-300">
                {id === next ? <span className="font-semibold text-gold-200">ist dran</span> : a ? actionLabel(a, view.street[id]) : view.allIn.includes(id) ? 'all-in' : ''}
              </span>
              <span className="w-14 text-right font-semibold tabular-nums">{view.street[id] ? formatChips(view.street[id]) : '–'}</span>
            </li>
          )
        })}
      </ul>

      {actions.length > 0 && (
        <button
          type="button"
          className="mt-2 flex min-h-10 items-center gap-1.5 text-xs font-semibold text-cream-300 hover:text-cream-50"
          onClick={() => onChange(withActions(actions.slice(0, -1)))}
        >
          <Icon name="restart" className="size-3.5" /> Rückgängig: {names(actions[actions.length - 1].id)} {actionLabel(actions[actions.length - 1])}
        </button>
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
