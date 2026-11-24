import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BlindEditor } from '../components/BlindEditor'
import { CategoryBadge } from '../components/CategoryBadge'
import { ChipMark } from '../components/ChipMark'
import { Icon, type IconName } from '../components/Icon'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { HoldButton } from '../components/HoldButton'
import { Peek } from '../components/Peek'
import { ActionBar } from '../components/Shell'
import { blindInfo, formatBlinds } from '../game/blinds'
import { availableQuestions, buildDisplay, isZoomable, mediaKey } from '../game/display'
import { normalizeRoomCode, useGmRoom } from '../game/room'
import type { GameState, VideoCommand } from '../game/types'
import { fetchCategories, fetchGame, fetchQuestions, markPlayed, updateGame } from '../lib/data'
import { formatAnswer, formatTime } from '../lib/format'
import { mediaUrl } from '../lib/media'
import type { Category, Game, Media, Question } from '../lib/types'
import { youTubeThumbnail } from '../lib/youtube'

const REVEAL_LABELS = ['Hinweis 1 aufdecken', 'Hinweis 2 aufdecken', 'Lösung aufdecken']
const NEXT_LABELS = ['Hinweis 1', 'Hinweis 2', 'die Lösung']

export function GameMaster() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [game, setGame] = useState<Game | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([fetchGame(id), fetchCategories(), fetchQuestions()])
      .then(([g, cs, qs]) => {
        setGame(g)
        setCategories(cs)
        setQuestions(qs)
      })
      .catch(() => setError('Spielabend konnte nicht geladen werden.'))
  }, [id])

  useWakeLock()

  const display = useMemo(
    () => (game ? buildDisplay(game, game.state, categories, questions) : null),
    [game, categories, questions],
  )

  const { tvOnline, sendVideo } = useGmRoom(game?.room_code ?? null, display)

  async function save(patch: Partial<Game>) {
    if (!game) return
    const next = { ...game, ...patch }
    setGame(next)
    try {
      await updateGame(game.id, patch)
      setError(null)
    } catch (e) {
      console.error(e)
      setError('Speichern fehlgeschlagen – Internetverbindung prüfen.')
    }
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
  const available = availableQuestions(questions)

  async function endRound() {
    if (!game || !question) return
    setBusy(true)
    try {
      const playedAt = await markPlayed(game.id, question.id, s.completed + 1)
      setQuestions((qs) => qs.map((q) => (q.id === question.id ? { ...q, played_at: playedAt } : q)))
      const completed = s.completed + 1
      const levelUp = completed % Math.max(1, game.questions_per_level) === 0
      await setState({ phase: levelUp ? 'blinds' : 'category', completed, questionId: null, categoryId: null, reveal: 0, decided: false })
    } catch (e) {
      console.error(e)
      setError('Runde konnte nicht abgeschlossen werden.')
    } finally {
      setBusy(false)
    }
  }

  async function finishGame() {
    if (!game) return
    await save({ finished_at: new Date().toISOString(), state: { ...s, phase: 'ended' } })
    navigate('/')
  }

  const roundSteps: { label: string; icon: IconName }[] = [
    { label: 'Frage', icon: 'cards' },
    { label: 'Hinweis 1', icon: 'club' },
    { label: 'Hinweis 2', icon: 'diamond' },
    { label: 'Lösung', icon: 'spade' },
  ]

  return (
    <Frame>
      <header className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 truncate font-display text-[1.6rem] leading-tight font-extrabold text-cream-50">{game.name}</h1>
          <span
            className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
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
        <dl className="mt-3 grid grid-cols-3 divide-x divide-white/[0.07] rounded-2xl bg-felt-950/45 py-2.5 ring-1 ring-white/[0.05]">
          <Stat label="Frage" value={String(s.completed + (s.phase === 'round' ? 1 : 0) || '–')} />
          <Stat label="Blinds" value={formatBlinds(info.current)} chip />
          <Stat label="Erhöhung" value={s.phase === 'blinds' ? 'jetzt' : `in ${info.untilIncrease}`} />
        </dl>
      </header>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {s.phase === 'lobby' && (
        <div className="animate-enter flex flex-col items-center gap-5 py-10 text-center">
          <ChipMark className="size-20 drop-shadow-[0_12px_20px_rgba(0,0,0,0.6)]" />
          <p className="max-w-[30ch] text-cream-300">Der TV zeigt den Startbildschirm. Wenn alle am Tisch sitzen und die Chips verteilt sind:</p>
          <button type="button" className="btn btn-primary w-full py-4 text-lg" onClick={() => setState({ phase: 'category' })}>
            <Icon name="cards" weight="duotone" className="size-6" /> Spiel starten
          </button>
        </div>
      )}

      {s.phase === 'category' && (
        <CategoryStep
          categories={categories}
          available={available}
          picked={s.categoryId}
          onPick={(categoryId) => setState({ categoryId })}
          onStart={(q) => setState({ phase: 'round', categoryId: q.category_id, questionId: q.id, reveal: 0, decided: false })}
        />
      )}

      {s.phase === 'round' && question && (
        <div className="animate-enter flex flex-col gap-4 pb-48">
          <ol className="grid grid-cols-4 gap-2" aria-label="Fortschritt der Runde">
            {roundSteps.map((step, i) => (
              <li key={step.label} className="flex flex-col items-center gap-1.5">
                <MiniCard shown={s.reveal >= i} current={s.reveal === i} icon={step.icon} />
                <span className={`text-[0.7rem] font-medium ${s.reveal >= i ? 'text-cream-200' : 'text-cream-400'}`}>{step.label}</span>
              </li>
            ))}
          </ol>

          <div className="mt-2 flex items-center justify-between gap-3">
            <CategoryBadge category={categories.find((c) => c.id === question.category_id)} />
            <span className="rounded-full bg-chip-red/90 px-2.5 py-1 text-xs font-semibold text-cream-50">
              {s.decided ? 'Runde entschieden' : `Setzrunde ${Math.min(4, s.reveal + 1)}`}
            </span>
          </div>
          <h2 className="font-display text-[1.75rem] leading-tight font-extrabold text-cream-50">{question.title}</h2>

          <Block label="Frage" icon="cards" shown focus={s.focus} canZoom={(k) => isZoomable(k, s.reveal)} onZoom={toggleFocus} text={question.question} media={question.question_media} keyFor={mediaKey.question} onVideo={sendVideo} />
          <Block label="Hinweis 1" icon="club" focus={s.focus} canZoom={(k) => isZoomable(k, s.reveal)} onZoom={toggleFocus} shown={s.reveal >= 1} text={question.hint1} media={question.hint1_media} keyFor={(i) => mediaKey.hint(1, i)} onVideo={sendVideo} />
          <Block label="Hinweis 2" icon="diamond" focus={s.focus} canZoom={(k) => isZoomable(k, s.reveal)} onZoom={toggleFocus} shown={s.reveal >= 2} text={question.hint2} media={question.hint2_media} keyFor={(i) => mediaKey.hint(2, i)} onVideo={sendVideo} />
          <Block
            label="Lösung"
            icon="spade"
            focus={s.focus}
            canZoom={(k) => isZoomable(k, s.reveal)}
            onZoom={toggleFocus}
            shown={s.reveal >= 3}
            highlight={formatAnswer(question)}
            text={question.explanation}
            media={question.explanation_media}
            keyFor={mediaKey.answer}
            onVideo={sendVideo}
          />
          {(question.notes || question.source) && (
            <div className="rounded-2xl border border-dashed border-gold-400/30 bg-gold-400/[0.04] p-4 text-sm">
              <p className="mb-1.5 flex items-center gap-1.5 font-semibold text-gold-200">
                <Icon name="eyeOff" className="size-4" /> Nur für dich
              </p>
              {question.notes && <p className="leading-relaxed whitespace-pre-wrap text-cream-100">{question.notes}</p>}
              {question.source && <p className="mt-2 break-words text-cream-400">Quelle: {question.source}</p>}
            </div>
          )}

          <ActionBar>
            <p className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-cream-300">
              {s.reveal < 3 ? (
                <>
                  <Icon name="tv" className="size-3.5 text-gold-300" /> Als Nächstes am TV: <span className="text-cream-50">{NEXT_LABELS[s.reveal]}</span>
                </>
              ) : (
                'Beenden markiert die Frage als gespielt'
              )}
            </p>
            <HoldButton
              className="btn btn-primary w-full py-3 text-lg"
              disabled={busy}
              confirmTitle={s.reveal < 3 ? `${NEXT_LABELS[s.reveal][0].toUpperCase()}${NEXT_LABELS[s.reveal].slice(1)} aufdecken?` : 'Runde beenden?'}
              confirmLabel={s.reveal < 3 ? 'Aufdecken' : 'Runde beenden'}
              confirmBody={s.reveal < 3 ? 'Der ganze Tisch sieht es sofort am TV.' : 'Die Frage wird als gespielt markiert.'}
              onConfirm={() => (s.reveal < 3 ? setState({ reveal: s.reveal + 1 }) : endRound())}
            >
              <Icon name={s.reveal < 3 ? 'eye' : 'flag'} weight="duotone" className="size-6" />
              {s.reveal < 3 ? REVEAL_LABELS[s.reveal] : 'Runde beenden'}
            </HoldButton>
            <div className="flex gap-2">
              {s.reveal > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost min-h-11 flex-1 py-2.5 text-sm"
                  onClick={() => setState({ reveal: s.reveal - 1, decided: false })}
                >
                  <Icon name="eyeOff" className="size-4" /> Wieder verdecken
                </button>
              )}
              {s.reveal === 0 && (
                <button
                  type="button"
                  className="btn btn-ghost min-h-11 flex-1 py-2.5 text-sm"
                  onClick={() => setState({ phase: 'category', questionId: null })}
                >
                  <Icon name="shuffle" className="size-4" /> Andere Frage
                </button>
              )}
              {s.reveal < 3 && (
                <HoldButton
                  className="btn btn-ghost flex-1 py-1.5 text-sm"
                  fill="rgb(209 164 70 / 0.3)"
                  hint="halten oder tippen"
                  confirmTitle="Lösung sofort zeigen?"
                  confirmLabel="Lösung zeigen"
                  confirmBody="Nur noch ein Spieler ist dabei – die übrigen Hinweise werden übersprungen."
                  onConfirm={() => setState({ reveal: 3, decided: true })}
                >
                  <Icon name="crown" className="size-4" /> Nur 1 Spieler übrig
                </HoldButton>
              )}
            </div>
          </ActionBar>
        </div>
      )}

      {s.phase === 'round' && !question && (
        <div className="flex flex-col gap-3">
          <p className="text-danger">Die aktuelle Frage wurde nicht gefunden.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setState({ phase: 'category', questionId: null })}>
            Zur Kategorie-Wahl
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
            Weiter zur Kategorie-Wahl <Icon name="arrow" weight="bold" className="size-5" />
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
        <div className={`mt-12 flex flex-col gap-2.5 ${s.phase === 'category' && s.categoryId ? 'pb-44' : ''}`}>
          <Collapsible title="Blinds anpassen" icon="stack">
            <BlindEditor
              levels={game.blind_levels}
              perLevel={game.questions_per_level}
              currentLevel={info.levelIndex}
              onChange={(levels, perLevel) => save({ blind_levels: levels, questions_per_level: perLevel })}
            />
          </Collapsible>
          <Collapsible title="TV neu verbinden" icon="tv">
            <RoomCodeForm current={game.room_code} onSave={(code) => save({ room_code: code })} />
          </Collapsible>
          <button type="button" className="btn btn-danger mt-4 min-h-11 self-start py-2.5 text-sm" onClick={() => setConfirmEnd(true)}>
            <Icon name="flag" className="size-4" /> Spielabend beenden
          </button>
        </div>
      )}
    </Frame>
  )
}

// ---------------------------------------------------------------------------

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}

function Stat({ label, value, chip }: { label: string; value: string; chip?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2">
      <dt className="text-[0.7rem] font-medium text-cream-400">{label}</dt>
      <dd className="flex items-center gap-1.5 font-display text-lg leading-tight font-extrabold text-cream-50 tabular-nums">
        {chip && <ChipMark className="size-4" />}
        {value}
      </dd>
    </div>
  )
}

/** Kleine Spielkarte für den Rundenfortschritt – dreht sich beim Aufdecken um. */
function MiniCard({ shown, current, icon }: { shown: boolean; current: boolean; icon: IconName }) {
  return (
    <span className="relative block aspect-[5/7] w-full [perspective:600px]">
      <span
        className="absolute inset-0 transition-transform duration-700 ease-[var(--ease-out-expo)] [transform-style:preserve-3d]"
        style={{ transform: shown ? 'rotateY(0deg)' : 'rotateY(180deg)' }}
      >
        <span
          className={`playing-card absolute inset-0 grid place-items-center [backface-visibility:hidden] ${
            current ? 'ring-2 ring-gold-300 ring-offset-2 ring-offset-felt-900' : ''
          }`}
        >
          <Icon name={icon} weight="fill" className={`size-6 ${icon === 'diamond' ? 'text-chip-red' : 'text-ink'}`} />
        </span>
        <span className="card-back absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]" />
      </span>
    </span>
  )
}

function Collapsible({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  return (
    <details className="card group overflow-hidden">
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
  onPick,
  onStart,
}: {
  categories: Category[]
  available: Question[]
  picked: string | null
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
        <Icon name="crown" weight="duotone" className="size-5 text-gold-300" /> Der Big Blind wählt eine Kategorie
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
}) {
  return (
    <section
      className={`rounded-2xl border p-4 transition-colors duration-500 ${
        shown ? 'border-gold-400/45 bg-felt-800/80 shadow-[var(--shadow-lift)]' : 'border-white/[0.06] bg-felt-950/35'
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1.5 text-cream-300">
          <Icon name={icon} weight="fill" className="size-3.5 text-gold-300" /> {label}
        </span>
        <span className={`flex items-center gap-1 ${shown ? 'text-gold-200' : 'text-cream-400'}`}>
          <Icon name={shown ? 'eye' : 'eyeOff'} className="size-3.5" />
          {shown ? 'am TV' : 'verdeckt'}
        </span>
      </div>
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
