import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BlindEditor } from '../components/BlindEditor'
import { CategoryBadge } from '../components/CategoryBadge'
import { BetPanel, ChipSettings, WinnerPicker } from '../components/ChipPanels'
import { ChipMark } from '../components/ChipMark'
import { Icon, type IconName } from '../components/Icon'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { HoldButton } from '../components/HoldButton'
import { ActionSheet } from '../components/ActionSheet'
import { Peek } from '../components/Peek'
import { PlayerPicker } from '../components/PlayerPicker'
import { QuestionModePicker } from '../components/QuestionModePicker'
import { ActionBar, Fixed } from '../components/Shell'
import { blindInfo, formatBlinds, validateLevels } from '../game/blinds'
import { finishHand, pots, settle, startHand, syncSeats, viewHand, type Chips, type Hand } from '../game/chips'
import { availableQuestions, buildDisplay, isZoomable, mediaKey, type Audience } from '../game/display'
import { normalizeRoomCode, useGmRoom } from '../game/room'
import type { GameState, VideoCommand } from '../game/types'
import { fetchCategories, fetchGame, fetchPlayers, fetchPlayHistory, fetchQuestions, markPlayed, updateGame } from '../lib/data'
import { formatAnswer, formatTime } from '../lib/format'
import { mediaUrl } from '../lib/media'
import type { BlindLevel, Category, Game, Media, Player, PlayRecord, Question } from '../lib/types'
import { youTubeThumbnail } from '../lib/youtube'

const REVEAL_LABELS = ['Hinweis 1 aufdecken', 'Hinweis 2 aufdecken', 'Lösung aufdecken']
const NEXT_LABELS = ['Hinweis 1', 'Hinweis 2', 'die Lösung']

export function GameMaster() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [game, setGame] = useState<Game | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [history, setHistory] = useState<PlayRecord[]>([])
  // null = Datenbank-Update 002 fehlt
  const [players, setPlayers] = useState<Player[] | null>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [confirmDecided, setConfirmDecided] = useState(false)
  // Die Erklärung „Halten oder tippen“ nur zeigen, bis einmal ausgelöst wurde
  const [holdLearned, setHoldLearned] = useState(() => {
    try {
      return localStorage.getItem('schaetzpoker:hold-gelernt') === '1'
    } catch {
      return false
    }
  })
  const learnHold = () => {
    setHoldLearned(true)
    try {
      localStorage.setItem('schaetzpoker:hold-gelernt', '1')
    } catch {
      /* egal */
    }
  }

  useEffect(() => {
    if (!id) return
    Promise.all([fetchGame(id), fetchCategories(), fetchQuestions()])
      .then(([g, cs, qs]) => {
        setGame(g)
        setCategories(cs)
        setQuestions(qs)
      })
      .catch(() => setError('Spielabend konnte nicht geladen werden.'))
    fetchPlayHistory().then(setHistory).catch(() => {})
    fetchPlayers().then(setPlayers).catch(() => setPlayers(null))
  }, [id])

  const audience = useMemo<Audience | undefined>(
    () => (game ? { playerIds: game.player_ids ?? [], history, game } : undefined),
    [game, history],
  )

  useWakeLock()

  const display = useMemo(
    () => (game ? buildDisplay(game, game.state, categories, questions, audience, players ?? []) : null),
    [game, categories, questions, audience, players],
  )

  const { tvOnline, sendVideo } = useGmRoom(game?.room_code ?? null, display)

  // Speichern: Handy und TV zeigen den neuen Stand sofort. Die Datenbank wird
  // nachgezogen – bei Fehlern automatisch erneut (und sobald das Netz zurück ist).
  const pending = useRef<{ id: string; patch: Partial<Game> } | null>(null)
  const flushing = useRef(false)
  const [saveState, setSaveState] = useState<'ok' | 'retrying' | 'failed'>('ok')

  const flush = useCallback((): Promise<void> => {
    async function run(attempt: number): Promise<void> {
      const p = pending.current
      if (!p || flushing.current) return
      flushing.current = true
      try {
        await updateGame(p.id, p.patch)
        flushing.current = false
        if (pending.current === p) pending.current = null
        if (pending.current) return run(0)
        setSaveState('ok')
      } catch (e) {
        console.error(e)
        flushing.current = false
        if (attempt < 3) {
          setSaveState('retrying')
          window.setTimeout(() => run(attempt + 1), 800 * 2 ** attempt)
        } else {
          setSaveState('failed')
        }
      }
    }
    return run(0)
  }, [])

  useEffect(() => {
    const onOnline = () => flush()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [flush])

  async function save(patch: Partial<Game>) {
    if (!game) return
    setGame({ ...game, ...patch })
    pending.current = { id: game.id, patch: { ...(pending.current?.patch ?? {}), ...patch } }
    await flush()
  }

  // Wechselt die Ansicht (Aufdecken, neue Phase), wird ein vergrößertes Medium geschlossen
  const setState = (patch: Partial<GameState>) => {
    if (!game) return
    const resetFocus = ('reveal' in patch || 'phase' in patch) && !('focus' in patch)
    return save({ state: { ...game.state, ...patch, ...(resetFocus ? { focus: null } : {}) } })
  }
  const toggleFocus = (key: string) => setState({ focus: game?.state.focus === key ? null : key })

  if (error && !game) return <Frame><p className="text-danger">{error}</p></Frame>
  if (!game || !display) return <Frame><p className="text-cream-300">Lädt …</p></Frame>

  const s = game.state
  const info = blindInfo(game.blind_levels, game.questions_per_level, s.completed)
  const question = questions.find((q) => q.id === s.questionId)
  const available = availableQuestions(questions, audience)
  const random = s.questionMode === 'random'
  const toChoice = random ? 'Weiter zur nächsten Frage' : 'Weiter zur Kategorie-Wahl'
  const chips = s.chips
  const hand = chips?.hand ?? null
  const names = (pid: string) => players?.find((p) => p.id === pid)?.name ?? '?'
  const setHand = (h: Hand) => chips && setState({ chips: { ...chips, hand: h } })
  const setChips = (c: Chips | null) => setState({ chips: c })
  // Wer gewinnt, muss beim Showdown feststehen, bevor es weitergeht
  const handView = chips && hand ? viewHand(chips, hand, 3) : null
  const settled = !chips || !hand || !handView || pots(handView).length === 0 || !!settle(chips, hand, handView)

  /** Frage am TV stellen – mit Chips beginnt dabei die Hand (Blinds werden gesetzt). */
  function startQuestion(q: Question) {
    const patch: Partial<GameState> = { phase: 'round', categoryId: q.category_id, questionId: q.id, reveal: 0, decided: false }
    if (chips && !chips.hand) {
      const synced = syncSeats(chips, game!.player_ids ?? [])
      patch.chips = { ...synced, hand: startHand(synced, info.current), last: null }
    }
    return setState(patch)
  }

  /** Nur noch einer dabei: Lösung sofort, übrige Setzrunden entfallen. */
  function decide() {
    if (hand && chips) {
      return setState({ reveal: 3, decided: true, chips: { ...chips, hand: { ...hand, rounds: hand.rounds.slice(0, s.reveal + 1) } } })
    }
    return setState({ reveal: 3, decided: true })
  }

  async function endRound() {
    if (!game || !question) return
    setBusy(true)
    try {
      const record = await markPlayed(game.id, question.id, s.completed + 1, game.player_ids ?? [])
      setQuestions((qs) => qs.map((q) => (q.id === question.id ? { ...q, played_at: record.played_at } : q)))
      setHistory((h) => [...h.filter((r) => !(r.game_id === record.game_id && r.question_id === record.question_id)), record])
      // Erst der Showdown am TV – die nächste Runde startet mit „Weiter“
      await setState({ phase: 'showdown', reveal: 3 })
    } catch (e) {
      console.error(e)
      setError('Runde konnte nicht abgeschlossen werden.')
    } finally {
      setBusy(false)
    }
  }

  const levelUpNext = (s.completed + 1) % Math.max(1, game.questions_per_level) === 0

  function nextRound() {
    const completed = s.completed + 1
    setState({
      phase: levelUpNext ? 'blinds' : 'category',
      completed,
      questionId: null,
      categoryId: null,
      reveal: 0,
      decided: false,
      ...(chips ? { chips: finishHand(chips) } : {}),
    })
  }

  async function finishGame() {
    if (!game) return
    // Wird direkt aus dem Showdown beendet, zählt die letzte Frage noch mit
    const completed = s.phase === 'showdown' ? s.completed + 1 : s.completed
    // Abbruch mitten in einer Frage: die laufende Hand verfällt, es gelten die Stände davor
    const finalChips = chips && (s.phase === 'showdown' ? finishHand(chips) : { ...chips, hand: null })
    await save({ finished_at: new Date().toISOString(), state: { ...s, completed, phase: 'ended', chips: finalChips } })
    navigate('/')
  }

  return (
    <Frame>
      <header className="mb-5 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs font-medium text-cream-400">{game.name}</p>
          <span
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
              tvOnline ? 'bg-ok/12 text-ok' : 'bg-danger/12 text-danger'
            }`}
          >
            <span className="relative flex size-2">
              {tvOnline && <span className="animate-pulse-dot absolute inset-0 rounded-full bg-ok" />}
              <span className={`relative size-2 rounded-full ${tvOnline ? 'bg-ok' : 'bg-danger'}`} />
            </span>
            {tvOnline ? 'TV verbunden' : 'TV offline'}
          </span>
        </div>
        <p className="flex items-center gap-x-2 text-[0.95rem] whitespace-nowrap text-cream-200">
          <span>
            Frage <b className="font-display font-extrabold text-cream-50 tabular-nums">{s.phase === 'lobby' ? '–' : display.questionNumber}</b>
          </span>
          <span aria-hidden="true" className="text-cream-400">·</span>
          <span className="flex items-center gap-1">
            <ChipMark className="size-4" />
            <b className="font-display font-extrabold text-cream-50 tabular-nums">{formatBlinds(info.current)}</b>
          </span>
          <span aria-hidden="true" className="text-cream-400">·</span>
          <span>{s.phase === 'blinds' ? 'Erhöhung jetzt' : `Erhöhung in ${info.untilIncrease}`}</span>
        </p>
      </header>

      {error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}
        </p>
      )}

      {saveState !== 'ok' && (
        <Fixed>
          <div
            role="alert"
            className={`fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-3 px-4 pt-[max(0.6rem,env(safe-area-inset-top))] pb-2.5 text-sm font-semibold shadow-lg ${
              saveState === 'failed' ? 'bg-chip-red text-cream-50' : 'bg-gold-300 text-felt-950'
            }`}
          >
            {saveState === 'failed' ? (
              <>
                <span>Nicht gespeichert – Internet prüfen</span>
                <button type="button" className="min-h-11 rounded-lg bg-cream-50 px-3 text-felt-950" onClick={() => flush()}>
                  Erneut speichern
                </button>
              </>
            ) : (
              <span className="flex min-h-11 items-center gap-2">
                <Icon name="chip" weight="duotone" className="size-4 animate-spin" /> Speichere erneut …
              </span>
            )}
          </div>
        </Fixed>
      )}

      {s.phase === 'lobby' && (
        <div className="animate-enter flex flex-col items-center gap-5 py-10 text-center">
          <ChipMark className="size-20 drop-shadow-[0_12px_20px_rgba(0,0,0,0.6)]" />
          <p className="max-w-[30ch] text-cream-300">Der TV zeigt den Startbildschirm. Wenn alle am Tisch sitzen und die Chips verteilt sind:</p>
          <button type="button" className="btn btn-primary w-full py-4 text-lg" onClick={() => setState({ phase: 'category' })}>
            <Icon name="cards" weight="duotone" className="size-6" /> Spiel starten
          </button>
        </div>
      )}

      {s.phase === 'category' && random && (
        <RandomStep
          categories={categories}
          available={available}
          drawnId={s.questionId}
          onDraw={(questionId) => setState({ questionId })}
          onStart={startQuestion}
        />
      )}

      {s.phase === 'category' && !random && (
        <CategoryStep
          categories={categories}
          available={available}
          picked={s.categoryId}
          bigBlind={display.chips?.bigBlind ?? null}
          onPick={(categoryId) => setState({ categoryId })}
          onStart={startQuestion}
        />
      )}

      {s.phase === 'round' && question && (() => {
        const items = [
          { label: 'Frage', icon: 'cards' as IconName, text: question.question, media: question.question_media, keyFor: mediaKey.question },
          { label: 'Hinweis 1', icon: 'club' as IconName, text: question.hint1, media: question.hint1_media, keyFor: (i: number) => mediaKey.hint(1, i) },
          { label: 'Hinweis 2', icon: 'diamond' as IconName, text: question.hint2, media: question.hint2_media, keyFor: (i: number) => mediaKey.hint(2, i) },
          {
            label: 'Lösung',
            icon: 'spade' as IconName,
            text: question.explanation,
            media: question.explanation_media,
            keyFor: mediaKey.answer,
            highlight: formatAnswer(question),
          },
        ]
        const blockProps = (i: number) => ({
          ...items[i],
          focus: s.focus,
          canZoom: (k: string) => isZoomable(k, s.reveal),
          onZoom: toggleFocus,
          onVideo: sendVideo,
        })
        const past = items.slice(0, s.reveal).map((_, i) => i)
        const nextIdx = s.reveal < 3 ? s.reveal + 1 : null
        const later = items.map((_, i) => i).filter((i) => i > s.reveal + 1)

        return (
          <div className="animate-enter flex flex-col gap-3 pb-40">
            <div className="flex items-center justify-between gap-3">
              <CategoryBadge category={categories.find((c) => c.id === question.category_id)} />
              <span className="rounded-full bg-chip-red/90 px-2.5 py-1 text-xs font-semibold text-cream-50">
                {s.decided ? 'Runde entschieden' : `Setzrunde ${Math.min(4, s.reveal + 1)}`}
              </span>
            </div>
            <ol className="grid grid-cols-4 gap-1 rounded-xl bg-felt-950/50 p-1 ring-1 ring-white/[0.05]" aria-label="Fortschritt der Runde">
              {items.map((step, i) => (
                <li
                  key={step.label}
                  aria-current={s.reveal === i ? 'step' : undefined}
                  className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition-colors duration-300 ${
                    s.reveal === i ? 'bg-gold-300 text-felt-950' : s.reveal > i ? 'text-cream-100' : 'text-cream-400'
                  }`}
                >
                  <Icon name={step.icon} weight="fill" className="size-3.5 shrink-0" />
                  <span className="truncate">{step.label.replace('Hinweis ', 'H')}</span>
                </li>
              ))}
            </ol>
            <h2 className="mt-1 font-display text-2xl leading-tight font-extrabold text-cream-50">{question.title}</h2>

            {chips && hand && !s.decided && (
              <BetPanel chips={chips} hand={hand} round={s.reveal} names={names} onChange={setHand} onDecide={decide} />
            )}

            {/* Bereits Gezeigtes: je eine Zeile, aufklappbar */}
            {past.map((i) => (
              <FoldRow key={items[i].label} icon={items[i].icon} label={items[i].label} summary={items[i].text}>
                <Block shown variant="bare" {...blockProps(i)} />
              </FoldRow>
            ))}

            {/* Gerade am TV */}
            <Block shown variant="now" {...blockProps(s.reveal)} />

            {/* Als Nächstes */}
            {nextIdx != null && <Block shown={false} variant="next" {...blockProps(nextIdx)} />}

            {/* Später: verdeckt, aufklappbar */}
            {later.map((i) => (
              <FoldRow key={items[i].label} icon={items[i].icon} label={items[i].label} summary="verdeckt" muted>
                <Block shown={false} variant="bare" {...blockProps(i)} />
              </FoldRow>
            ))}

            {(question.notes || question.source) && (
              <FoldRow icon="pencil" label="Notizen" summary="nur für dich" muted>
                {question.notes && <p className="text-sm leading-relaxed whitespace-pre-wrap text-cream-100">{question.notes}</p>}
                {question.source && <p className="mt-2 text-sm break-words text-cream-400">Quelle: {question.source}</p>}
              </FoldRow>
            )}

            <ActionBar>
              {!tvOnline && (
                <p role="status" className="text-center text-xs font-medium text-danger">
                  TV offline – er holt den Stand nach, sobald er verbunden ist
                </p>
              )}
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  className="btn btn-ghost w-14 shrink-0 p-0"
                  aria-label="Weitere Aktionen"
                  aria-haspopup="dialog"
                  onClick={() => setMoreOpen(true)}
                >
                  <Icon name="more" weight="bold" className="size-6" />
                </button>
                <HoldButton
                  className="btn btn-primary min-h-14 flex-1 py-2.5 text-lg"
                  disabled={busy}
                  hint={holdLearned ? '' : 'Halten · oder tippen und bestätigen'}
                  confirmTitle={s.reveal < 3 ? `${NEXT_LABELS[s.reveal][0].toUpperCase()}${NEXT_LABELS[s.reveal].slice(1)} aufdecken?` : 'Runde beenden?'}
                  confirmLabel={s.reveal < 3 ? 'Aufdecken' : 'Runde beenden'}
                  confirmBody={s.reveal < 3 ? 'Der ganze Tisch sieht es sofort am TV.' : 'Danach folgt der Showdown am TV.'}
                  onConfirm={() => {
                    learnHold()
                    return s.reveal < 3 ? setState({ reveal: s.reveal + 1 }) : endRound()
                  }}
                >
                  <Icon name={s.reveal < 3 ? 'eye' : 'flag'} weight="duotone" className="size-6" />
                  {s.reveal < 3 ? REVEAL_LABELS[s.reveal] : 'Runde beenden'}
                </HoldButton>
              </div>
            </ActionBar>

            <ActionSheet
              open={moreOpen}
              onClose={() => setMoreOpen(false)}
              options={[
                ...(s.reveal > 0
                  ? [{ icon: 'eyeOff' as IconName, label: `${items[s.reveal].label} wieder verdecken`, onSelect: () => setState({ reveal: s.reveal - 1, decided: false }) }]
                  : [{ icon: 'shuffle' as IconName, label: random ? 'Andere Frage ziehen' : 'Andere Frage wählen', onSelect: () => setState({ phase: 'category', questionId: null }) }]),
                ...(s.reveal < 3
                  ? [{ icon: 'crown' as IconName, label: 'Nur 1 Spieler übrig – Lösung zeigen', onSelect: () => setConfirmDecided(true) }]
                  : []),
                { icon: 'book' as IconName, label: 'Regeln nachlesen', onSelect: openRules },
                { icon: 'flag' as IconName, label: 'Spielabend beenden', onSelect: () => setConfirmEnd(true) },
              ]}
            />
            <ConfirmDialog
              open={confirmDecided}
              title="Lösung sofort zeigen?"
              confirmLabel="Lösung zeigen"
              onCancel={() => setConfirmDecided(false)}
              onConfirm={() => {
                setConfirmDecided(false)
                decide()
              }}
            >
              Nur noch ein Spieler ist dabei – die übrigen Hinweise werden übersprungen.
            </ConfirmDialog>
          </div>
        )
      })()}

      {s.phase === 'round' && !question && (
        <div className="flex flex-col gap-3">
          <p className="text-danger">Die aktuelle Frage wurde nicht gefunden.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setState({ phase: 'category', questionId: null })}>
            {random ? 'Neue Frage ziehen' : 'Zur Kategorie-Wahl'}
          </button>
        </div>
      )}

      {s.phase === 'showdown' && question && (
        <div className="animate-enter flex flex-col items-center gap-4 py-6 text-center">
          <p className="flex items-center gap-2 text-cream-200">
            <Icon name="crown" weight="duotone" className="size-5 text-gold-300" /> Showdown am TV
          </p>
          <h2 className="font-display text-2xl leading-tight font-extrabold text-cream-50">{question.title}</h2>
          <p className="font-display text-5xl font-black text-gold-200 tabular-nums">{formatAnswer(question)}</p>
          <p className="max-w-[32ch] text-sm text-cream-300">Alle, die noch dabei sind, decken ihre Schätzung auf. Wer am nächsten dran ist, gewinnt den Pot.</p>
          {chips && hand && <WinnerPicker chips={chips} hand={hand} names={names} onChange={setHand} />}
          <button type="button" className="btn btn-primary mt-4 w-full py-4 text-lg" disabled={!settled} onClick={nextRound}>
            {levelUpNext ? 'Weiter: Blinds steigen' : toChoice} <Icon name="arrow" weight="bold" className="size-5" />
          </button>
        </div>
      )}

      {s.phase === 'blinds' && (
        <div className="animate-enter flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-cream-300">Der TV kündigt die neuen Blinds an</p>
          <p className="flex items-center gap-3 font-display text-5xl font-extrabold text-gold-200 tabular-nums">
            <ChipMark className="size-11" />
            {formatBlinds(info.current)}
          </p>
          <button type="button" className="btn btn-primary mt-4 w-full py-4 text-lg" onClick={() => setState({ phase: 'category' })}>
            {toChoice} <Icon name="arrow" weight="bold" className="size-5" />
          </button>
        </div>
      )}

      {s.phase === 'ended' && <p className="text-cream-300">Dieser Spielabend ist beendet.</p>}

      <ConfirmDialog
        open={confirmEnd}
        danger
        title="Spielabend beenden?"
        confirmLabel="Abend beenden"
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false)
          finishGame()
        }}
      >
        Der TV zeigt danach den Abschluss mit dem Abend in Zahlen.
      </ConfirmDialog>

      {s.phase !== 'round' && s.phase !== 'ended' && (
        <div className={`mt-12 flex flex-col gap-2.5 ${s.phase === 'category' && (random || s.categoryId) ? 'pb-44' : ''}`}>
          {players && (
            <Collapsible title={game.player_ids?.length ? `Spieler (${game.player_ids.length})` : 'Spieler'} icon="users">
              <div className="flex flex-col gap-3">
                <p className="text-sm leading-relaxed text-cream-300">
                  Jemand kommt dazu oder geht? Gilt ab der nächsten Frage – angeboten werden nur Fragen, die für alle am Tisch neu sind.
                </p>
                <PlayerPicker
                  players={players}
                  selected={(game.player_ids ?? []).filter((pid) => players.some((p) => p.id === pid))}
                  onChange={(ids) => save({ player_ids: ids, state: { ...s, chips: chips && syncSeats(chips, ids) } })}
                  onPlayersChange={setPlayers}
                />
              </div>
            </Collapsible>
          )}
          {players && (
            <Collapsible
              title={chips ? `Chip-Stände (${chips.seats.length})` : 'Chip-Stände mitführen'}
              icon="chip"
              defaultOpen={s.phase === 'lobby' && !!chips}
            >
              <ChipSettings
                chips={chips}
                playerIds={game.player_ids ?? []}
                names={names}
                bigBlind={info.current.big}
                locked={!!hand}
                onChange={setChips}
              />
            </Collapsible>
          )}
          <Collapsible title={random ? 'Fragen: zufällig' : 'Fragen: Big Blind wählt'} icon={random ? 'shuffle' : 'crown'}>
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed text-cream-300">Gilt ab der nächsten Frage.</p>
              <QuestionModePicker
                value={s.questionMode}
                onChange={(questionMode) => questionMode !== s.questionMode && setState({ questionMode, categoryId: null, questionId: null })}
              />
            </div>
          </Collapsible>
          <Collapsible title="Blinds anpassen" icon="stack">
            <BlindSettings game={game} onApply={(levels, perLevel) => save({ blind_levels: levels, questions_per_level: perLevel })} />
          </Collapsible>
          <Collapsible title="TV neu verbinden" icon="tv">
            <RoomCodeForm current={game.room_code} onSave={(code) => save({ room_code: code })} />
          </Collapsible>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost min-h-11 py-2.5 text-sm" onClick={openRules}>
              <Icon name="book" className="size-4" /> Regeln
            </button>
            <button type="button" className="btn btn-danger min-h-11 py-2.5 text-sm" onClick={() => setConfirmEnd(true)}>
              <Icon name="flag" className="size-4" /> Spielabend beenden
            </button>
          </div>
        </div>
      )}
    </Frame>
  )
}

// ---------------------------------------------------------------------------

/** Regeln in neuem Tab – die Spielleitung bleibt offen */
function openRules() {
  window.open(`${location.pathname}#/regeln`, '_blank', 'noopener')
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}

/**
 * Blinds während des Abends ändern: erst lokal bearbeiten, dann „Übernehmen“.
 * So landet nie ein halb getippter Wert (z. B. 0) am TV, und Stufenwechsel sind angekündigt.
 */
function BlindSettings({ game, onApply }: { game: Game; onApply: (levels: BlindLevel[], perLevel: number) => void }) {
  const [levels, setLevels] = useState(game.blind_levels)
  const [perLevel, setPerLevel] = useState(game.questions_per_level)
  const [resetKey, setResetKey] = useState(0)

  const dirty = JSON.stringify(levels) !== JSON.stringify(game.blind_levels) || perLevel !== game.questions_per_level
  const problem = validateLevels(levels, perLevel)
  const now = blindInfo(game.blind_levels, game.questions_per_level, game.state.completed)
  const draft = blindInfo(levels, perLevel, game.state.completed)
  const nextQuestion = game.state.completed + draft.untilIncrease + 1

  function discard() {
    setLevels(game.blind_levels)
    setPerLevel(game.questions_per_level)
    setResetKey((k) => k + 1)
  }

  return (
    <div className="flex flex-col gap-4">
      <BlindEditor
        key={resetKey}
        levels={levels}
        perLevel={perLevel}
        currentLevel={draft.levelIndex}
        onChange={(l, p) => {
          setLevels(l)
          setPerLevel(p)
        }}
      />
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : (
        <p className="text-sm text-cream-300">
          Jetzt <span className="font-semibold text-cream-50 tabular-nums">{formatBlinds(draft.current)}</span> · ab Frage {nextQuestion}:{' '}
          <span className="font-semibold text-cream-50 tabular-nums">{formatBlinds(draft.next)}</span>
        </p>
      )}
      {!problem && dirty && draft.levelIndex !== now.levelIndex && (
        <p className="rounded-xl bg-gold-400/10 px-3 py-2 text-sm text-gold-200">
          Achtung: Die laufenden Blinds wechseln damit sofort von {formatBlinds(now.current)} auf {formatBlinds(draft.current)}.
        </p>
      )}
      {dirty && (
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost min-h-11 flex-1" onClick={discard}>
            Verwerfen
          </button>
          <button type="button" className="btn btn-primary min-h-11 flex-1" disabled={!!problem} onClick={() => onApply(levels, perLevel)}>
            Übernehmen
          </button>
        </div>
      )}
    </div>
  )
}

/** Kompakte, aufklappbare Zeile (für Gezeigtes, Späteres und Notizen) */
function FoldRow({ icon, label, summary, muted, children }: { icon: IconName; label: string; summary: string; muted?: boolean; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-white/[0.06] bg-felt-950/30">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <Icon name={icon} weight="fill" className="size-3.5 shrink-0 text-gold-300" />
        <span className="shrink-0 text-xs font-semibold text-cream-200">{label}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${muted ? 'text-cream-400' : 'text-cream-300'}`}>{summary}</span>
        <Icon name="down" className="size-4 shrink-0 text-cream-400 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="px-4 pt-1 pb-4">{children}</div>
    </details>
  )
}

function Collapsible({ title, icon, defaultOpen, children }: { title: string; icon: IconName; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className="card group overflow-hidden" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 text-cream-100 [&::-webkit-details-marker]:hidden">
        <Icon name={icon} weight="duotone" className="size-5 text-gold-300" />
        <span className="flex-1 font-medium">{title}</span>
        <Icon name="down" className="size-4 text-cream-400 transition-transform duration-300 group-open:rotate-180" />
      </summary>
      <div className="border-t border-white/[0.06] px-4 pt-4 pb-5">{children}</div>
    </details>
  )
}

function RoomCodeForm({ current, onSave }: { current: string; onSave: (code: string) => void }) {
  const [code, setCode] = useState('')
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-cream-300">
        Aktueller Code: <span className="font-display font-extrabold tracking-[0.2em] text-cream-50">{current}</span>. Neuen Code vom TV eintippen:
      </p>
      <div className="flex gap-2">
        <input
          className="field text-center font-display text-xl font-extrabold tracking-[0.3em] uppercase placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
          aria-label="Neuer TV-Code"
          placeholder="TV-Code"
          value={code}
          onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
        />
        <button type="button" className="btn btn-primary shrink-0" disabled={code.length !== 6} onClick={() => onSave(code)}>
          Verbinden
        </button>
      </div>
    </div>
  )
}

function CategoryStep({
  categories,
  available,
  picked,
  bigBlind,
  onPick,
  onStart,
}: {
  categories: Category[]
  available: Question[]
  picked: string | null
  bigBlind: string | null
  onPick: (id: string | null) => void
  onStart: (q: Question) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const withQuestions = categories
    .map((c) => ({ c, qs: available.filter((q) => q.category_id === c.id) }))
    .filter((x) => x.qs.length > 0)

  if (picked) {
    const entry = withQuestions.find((x) => x.c.id === picked)
    const qs = entry?.qs ?? []
    const chosen = qs.find((q) => q.id === selected)
    return (
      <div className="animate-enter flex flex-col gap-3">
        <button
          type="button"
          className="-ml-1 flex min-h-11 items-center gap-1 self-start rounded-lg px-1 text-sm text-cream-300 hover:text-cream-50"
          onClick={() => {
            setSelected(null)
            onPick(null)
          }}
        >
          <Icon name="back" className="size-4" /> Andere Kategorie
        </button>
        <h2 className="flex items-center gap-2.5 font-display text-[1.75rem] font-extrabold text-cream-50">
          <span className="size-3.5 rounded-full ring-4 ring-black/20" style={{ background: entry?.c.color }} />
          {entry?.c.name}
        </h2>
        <p className="flex items-center gap-1.5 text-sm text-cream-300">
          <Icon name="eyeOff" className="size-4" /> Welche Frage wird gespielt? Nur du siehst diese Liste.
        </p>
        <ul className="flex flex-col gap-2.5" role="radiogroup" aria-label="Frage auswählen">
          {qs.map((q, i) => {
            const isSel = q.id === selected
            return (
              <li key={q.id} className="animate-enter" style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSel}
                  className={`card flex w-full items-start gap-3 px-4 py-3.5 text-left ${isSel ? 'border-gold-300/80! bg-gold-400/10' : ''}`}
                  onClick={() => setSelected(isSel ? null : q.id)}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                      isSel ? 'border-gold-300 bg-gold-300 text-felt-950' : 'border-cream-400'
                    }`}
                  >
                    {isSel && <Icon name="check" weight="bold" className="size-3" />}
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="font-display text-xl leading-snug font-extrabold text-cream-50">{q.title}</span>
                    <span className="line-clamp-2 text-sm text-cream-300">{q.question}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {qs.length > 1 && (
          <button
            type="button"
            className="btn btn-ghost mt-1 min-h-11"
            onClick={() => setSelected(qs[Math.floor(Math.random() * qs.length)].id)}
          >
            <Icon name="shuffle" className="size-4 text-gold-300" /> Zufällig auswählen
          </button>
        )}
        <ActionBar>
          <p className="text-center text-xs font-medium text-cream-300">
            {chosen ? (
              <>
                Ausgewählt: <span className="text-cream-50">{chosen.title}</span>
              </>
            ) : (
              'Tippe eine Frage an, um sie auszuwählen'
            )}
          </p>
          <HoldButton
            className="btn btn-primary w-full py-3 text-lg"
            disabled={!chosen}
            confirmTitle="Frage am TV stellen?"
            confirmLabel="Frage stellen"
            confirmBody={chosen ? `„${chosen.title}“ erscheint sofort am TV.` : undefined}
            onConfirm={() => chosen && onStart(chosen)}
          >
            <Icon name="tv" weight="duotone" className="size-6" /> Frage am TV stellen
          </HoldButton>
        </ActionBar>
      </div>
    )
  }

  return (
    <div className="animate-enter flex flex-col gap-4">
      <p className="flex items-center gap-2 text-cream-200">
        <Icon name="crown" weight="duotone" className="size-5 text-gold-300" />{' '}
        {bigBlind ? `${bigBlind} (Big Blind) wählt eine Kategorie` : 'Der Big Blind wählt eine Kategorie'}
      </p>
      {withQuestions.length === 0 && <p className="text-gold-200">Keine spielbereiten Fragen mehr übrig.</p>}
      <ul className="grid grid-cols-2 gap-2.5">
        {withQuestions.map(({ c, qs }, i) => (
          <li key={c.id} className="animate-enter" style={{ animationDelay: `${Math.min(i * 40, 280)}ms` }}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className="card relative flex h-full min-h-20 w-full flex-col items-start gap-1 overflow-hidden px-4 pt-5 pb-3.5 text-left"
            >
              <span className="absolute inset-x-0 top-0 h-1" style={{ background: c.color }} />
              <span className="font-display text-xl leading-tight font-extrabold text-cream-50">{c.name}</span>
              <span className="text-sm text-cream-300">
                {qs.length} {qs.length === 1 ? 'Frage' : 'Fragen'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-cream-300">Die gewählte Kategorie wird am TV hervorgehoben.</p>
    </div>
  )
}

/** Zufallsmodus: Kategorie zufällig, daraus eine zufällige Frage – jede Kategorie kommt gleich oft dran. */
function drawQuestion(available: Question[], except?: string | null): Question | null {
  const pool = available.length > 1 && except ? available.filter((q) => q.id !== except) : available
  const byCategory = new Map<string, Question[]>()
  for (const q of pool) byCategory.set(q.category_id ?? '', [...(byCategory.get(q.category_id ?? '') ?? []), q])
  const groups = [...byCategory.values()]
  if (groups.length === 0) return null
  const group = groups[Math.floor(Math.random() * groups.length)]
  return group[Math.floor(Math.random() * group.length)]
}

function RandomStep({
  categories,
  available,
  drawnId,
  onDraw,
  onStart,
}: {
  categories: Category[]
  available: Question[]
  drawnId: string | null
  onDraw: (id: string) => void
  onStart: (q: Question) => void
}) {
  const drawn = available.find((q) => q.id === drawnId) ?? null

  // Noch keine (oder keine gültige) Frage gezogen? Dann gleich eine ziehen.
  // Die gezogene Frage wird gespeichert – nach Neuladen bleibt sie dieselbe.
  useEffect(() => {
    if (drawn) return
    const q = drawQuestion(available)
    if (q) onDraw(q.id)
  }, [drawn, available, onDraw])

  if (available.length === 0) {
    return (
      <div className="animate-enter flex flex-col gap-4">
        <p className="flex items-center gap-2 text-cream-200">
          <Icon name="shuffle" weight="duotone" className="size-5 text-gold-300" /> Zufällige Frage
        </p>
        <p className="text-gold-200">Keine spielbereiten Fragen mehr übrig.</p>
      </div>
    )
  }
  if (!drawn) return <p className="text-cream-300">Ziehe eine Frage …</p>

  return (
    <div className="animate-enter flex flex-col gap-3">
      <p className="flex items-center gap-2 text-cream-200">
        <Icon name="shuffle" weight="duotone" className="size-5 text-gold-300" /> Zufällig gezogen
      </p>
      <p className="flex items-center gap-1.5 text-sm text-cream-300">
        <Icon name="eyeOff" className="size-4" /> Nur du siehst die Frage, bis du sie am TV stellst.
      </p>
      <div key={drawn.id} className="card animate-enter flex flex-col gap-2 border-gold-300/80! bg-gold-400/10 px-4 py-4">
        <CategoryBadge category={categories.find((c) => c.id === drawn.category_id)} />
        <span className="font-display text-2xl leading-snug font-extrabold text-cream-50">{drawn.title}</span>
        <span className="text-sm leading-relaxed text-cream-200">{drawn.question}</span>
      </div>
      {available.length > 1 && (
        <button type="button" className="btn btn-ghost mt-1 min-h-11" onClick={() => {
          const q = drawQuestion(available, drawn.id)
          if (q) onDraw(q.id)
        }}>
          <Icon name="shuffle" className="size-4 text-gold-300" /> Andere Frage ziehen
        </button>
      )}
      <p className="text-xs text-cream-300">
        Noch {available.length} {available.length === 1 ? 'Frage' : 'Fragen'} im Topf.
      </p>
      <ActionBar>
        <HoldButton
          className="btn btn-primary w-full py-3 text-lg"
          confirmTitle="Frage am TV stellen?"
          confirmLabel="Frage stellen"
          confirmBody={`„${drawn.title}“ erscheint sofort am TV.`}
          onConfirm={() => onStart(drawn)}
        >
          <Icon name="tv" weight="duotone" className="size-6" /> Frage am TV stellen
        </HoldButton>
      </ActionBar>
    </div>
  )
}

function Block({
  label,
  icon,
  shown,
  text,
  highlight,
  media,
  keyFor,
  onVideo,
  focus,
  canZoom,
  onZoom,
  variant = 'now',
}: {
  label: string
  icon: IconName
  shown: boolean
  text: string
  highlight?: string
  media: Media[]
  keyFor: (i: number) => string
  onVideo: (c: VideoCommand) => void
  focus: string | null
  canZoom: (key: string) => boolean
  onZoom: (key: string) => void
  /** now = gerade am TV (hervorgehoben), next = als Nächstes, bare = ohne eigenen Rahmen (in Kompaktzeile) */
  variant?: 'now' | 'next' | 'bare'
}) {
  const framed = variant !== 'bare'
  return (
    <section
      className={
        variant === 'now'
          ? 'rounded-2xl border border-gold-400/50 bg-felt-800/85 p-4 shadow-[var(--shadow-lift)]'
          : variant === 'next'
            ? 'rounded-2xl border border-white/[0.07] bg-felt-950/35 p-4'
            : ''
      }
    >
      {framed && (
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
          <Icon name={icon} weight="fill" className="size-3.5 text-gold-300" />
          <span className="text-cream-200">{label}</span>
          {variant === 'now' ? (
            <span className="ml-auto flex items-center gap-1.5 text-gold-200">
              <span className="relative flex size-1.5">
                <span className="animate-pulse-dot absolute inset-0 rounded-full bg-gold-300" />
                <span className="relative size-1.5 rounded-full bg-gold-300" />
              </span>
              gerade am TV
            </span>
          ) : (
            <span className="ml-auto text-cream-400">als Nächstes</span>
          )}
        </div>
      )}
      <Peek hidden={!shown}>
      {highlight && <p className="font-display text-4xl font-extrabold text-gold-200 tabular-nums">{highlight}</p>}
      {text && <p className="leading-relaxed whitespace-pre-wrap text-cream-50">{text}</p>}
      {media.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {media.map((m, i) => {
            const key = keyFor(i)
            const zoomable = shown && canZoom(key)
            const zoomed = zoomable && focus === key
            const name = m.caption || (m.type === 'image' ? 'Bild' : 'YouTube')
            return (
              <li
                key={i}
                className={`flex items-center gap-2 rounded-xl p-2 transition-colors ${
                  zoomed ? 'bg-gold-400/15 ring-1 ring-gold-300/70' : 'bg-felt-950/40'
                }`}
              >
                <button
                  type="button"
                  disabled={!zoomable}
                  onClick={() => onZoom(key)}
                  aria-pressed={zoomed}
                  aria-label={zoomed ? `${name}: Vergrößerung am TV schließen` : `${name} am TV vergrößern`}
                  className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left disabled:cursor-default"
                >
                  <span className="relative shrink-0">
                    <img
                      src={m.type === 'image' ? mediaUrl(m.path) : youTubeThumbnail(m.videoId)}
                      alt=""
                      className="size-14 rounded-lg object-cover ring-1 ring-white/10"
                    />
                    {zoomable && (
                      <span
                        className={`absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full shadow-md transition-colors ${
                          zoomed ? 'bg-gold-300 text-felt-950' : 'bg-felt-900 text-gold-200 ring-1 ring-gold-400/50 group-hover:bg-felt-700'
                        }`}
                      >
                        <Icon name={zoomed ? 'shrink' : 'fullscreen'} weight="bold" className="size-3.5" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-cream-200">{name}</span>
                    {zoomed ? (
                      <span className="block text-xs font-semibold text-gold-200">Groß am TV · tippen zum Schließen</span>
                    ) : zoomable ? (
                      <span className="block text-xs text-cream-400">Tippen zum Vergrößern</span>
                    ) : (
                      m.type === 'youtube' &&
                      (m.start != null || m.end != null) && (
                        <span className="block text-xs text-cream-400 tabular-nums">
                          {formatTime(m.start ?? 0)}–{m.end != null ? formatTime(m.end) : 'Ende'}
                        </span>
                      )
                    )}
                  </span>
                </button>
                {m.type === 'youtube' && shown && (
                  <span className="flex shrink-0 gap-1">
                    <VideoButton label="Abspielen" icon="play" onClick={() => onVideo({ key, cmd: 'play' })} />
                    <VideoButton label="Pause" icon="pause" onClick={() => onVideo({ key, cmd: 'pause' })} />
                    <VideoButton label="Von vorn" icon="restart" onClick={() => onVideo({ key, cmd: 'restart' })} />
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      </Peek>
    </section>
  )
}

function VideoButton({ label, icon, onClick }: { label: string; icon: IconName; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-xl border border-white/10 text-cream-100 transition-colors hover:border-gold-400/60 active:scale-95"
    >
      <Icon name={icon} weight="fill" className="size-4" />
    </button>
  )
}

/** Handy-Bildschirm während des Spiels anlassen (wo unterstützt). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const request = () => {
      navigator.wakeLock
        ?.request('screen')
        .then((l) => (lock = l))
        .catch(() => {})
    }
    request()
    const onVisible = () => document.visibilityState === 'visible' && request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [])
}
