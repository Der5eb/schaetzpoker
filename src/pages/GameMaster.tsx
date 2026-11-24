import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BlindEditor } from '../components/BlindEditor'
import { CategoryBadge } from '../components/CategoryBadge'
import { Icon } from '../components/Icon'
import { blindInfo, formatBlinds } from '../game/blinds'
import { availableQuestions, buildDisplay, mediaKey } from '../game/display'
import { normalizeRoomCode, useGmRoom } from '../game/room'
import type { GameState, VideoCommand } from '../game/types'
import { fetchCategories, fetchGame, fetchQuestions, markPlayed, updateGame } from '../lib/data'
import { formatAnswer, formatTime } from '../lib/format'
import { mediaUrl } from '../lib/media'
import type { Category, Game, Media, Question } from '../lib/types'
import { youTubeThumbnail } from '../lib/youtube'

const REVEAL_LABELS = ['Hinweis 1 aufdecken', 'Hinweis 2 aufdecken', 'Lösung aufdecken']

export function GameMaster() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [game, setGame] = useState<Game | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pickedCategory, setPickedCategory] = useState<string | null>(null)

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

  const setState = (patch: Partial<GameState>) => game && save({ state: { ...game.state, ...patch } })

  if (error && !game) return <Frame><p className="text-chip-red">{error}</p></Frame>
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
      setPickedCategory(null)
    } catch (e) {
      console.error(e)
      setError('Runde konnte nicht abgeschlossen werden.')
    } finally {
      setBusy(false)
    }
  }

  async function finishGame() {
    if (!game || !window.confirm('Spielabend beenden?')) return
    await save({ finished_at: new Date().toISOString(), state: { ...s, phase: 'ended' } })
    navigate('/')
  }

  return (
    <Frame>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl text-cream-50">{game.name}</h1>
          <p className="text-sm text-cream-300">
            Frage {s.completed + (s.phase === 'round' ? 1 : 0) || '–'} · Blinds{' '}
            <span className="text-cream-50 tabular-nums">{formatBlinds(info.current)}</span>
            {s.phase !== 'blinds' && <> · noch {info.untilIncrease}</>}
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
            tvOnline ? 'bg-emerald-500/15 text-emerald-300' : 'bg-chip-red/15 text-chip-red'
          }`}
        >
          <span className={`size-2 rounded-full ${tvOnline ? 'bg-emerald-400' : 'bg-chip-red'}`} />
          {tvOnline ? 'TV verbunden' : 'TV offline'}
        </span>
      </header>

      {error && <p className="mb-4 text-sm text-chip-red">{error}</p>}

      {s.phase === 'lobby' && (
        <div className="flex flex-col gap-4">
          <p className="text-cream-300">Der TV zeigt den Startbildschirm. Wenn alle sitzen:</p>
          <button type="button" className="btn btn-primary py-3" onClick={() => setState({ phase: 'category' })}>
            Spiel starten
          </button>
        </div>
      )}

      {s.phase === 'category' && (
        <CategoryStep
          categories={categories}
          available={available}
          picked={pickedCategory}
          onPick={setPickedCategory}
          onStart={(q) =>
            setState({ phase: 'round', categoryId: q.category_id, questionId: q.id, reveal: 0, decided: false })
          }
        />
      )}

      {s.phase === 'round' && question && (
        <div className="flex flex-col gap-4 pb-40">
          <div className="flex items-center justify-between">
            <CategoryBadge category={categories.find((c) => c.id === question.category_id)} />
            <span className="text-sm text-cream-300">
              {s.decided ? 'entschieden' : `Setzrunde ${Math.min(4, s.reveal + 1)}`}
            </span>
          </div>
          <h2 className="font-display text-2xl text-cream-50">{question.title}</h2>

          <Block label="Frage" shown text={question.question} media={question.question_media} keyFor={mediaKey.question} onVideo={sendVideo} />
          <Block label="Hinweis 1" shown={s.reveal >= 1} text={question.hint1} media={question.hint1_media} keyFor={(i) => mediaKey.hint(1, i)} onVideo={sendVideo} />
          <Block label="Hinweis 2" shown={s.reveal >= 2} text={question.hint2} media={question.hint2_media} keyFor={(i) => mediaKey.hint(2, i)} onVideo={sendVideo} />
          <Block
            label="Lösung"
            shown={s.reveal >= 3}
            highlight={formatAnswer(question)}
            text={question.explanation}
            media={question.explanation_media}
            keyFor={mediaKey.answer}
            onVideo={sendVideo}
          />
          {(question.notes || question.source) && (
            <div className="rounded-xl border border-dashed border-felt-600 p-4 text-sm">
              <div className="mb-1 text-xs tracking-widest text-cream-300 uppercase">Nur für dich</div>
              {question.notes && <p className="whitespace-pre-wrap text-cream-100">{question.notes}</p>}
              {question.source && <p className="mt-2 break-words text-cream-300">Quelle: {question.source}</p>}
            </div>
          )}

          <ActionBar>
            <button
              type="button"
              className="btn btn-primary w-full py-3.5 text-lg"
              disabled={busy}
              onClick={() => (s.reveal < 3 ? setState({ reveal: s.reveal + 1 }) : endRound())}
            >
              {s.reveal < 3 ? REVEAL_LABELS[s.reveal] : 'Runde beenden'}
            </button>
            <div className="flex gap-2">
              {s.reveal > 0 && (
                <button type="button" className="btn btn-ghost flex-1 py-2 text-sm" onClick={() => setState({ reveal: s.reveal - 1, decided: false })}>
                  Zurück
                </button>
              )}
              {s.reveal === 0 && (
                <button
                  type="button"
                  className="btn btn-ghost flex-1 py-2 text-sm"
                  onClick={() => setState({ phase: 'category', questionId: null, categoryId: null })}
                >
                  Andere Frage
                </button>
              )}
              {s.reveal < 3 && (
                <button
                  type="button"
                  className="btn btn-ghost flex-1 py-2 text-sm"
                  onClick={() => setState({ reveal: 3, decided: true })}
                >
                  Nur 1 Spieler übrig
                </button>
              )}
            </div>
          </ActionBar>
        </div>
      )}

      {s.phase === 'round' && !question && (
        <div className="flex flex-col gap-3">
          <p className="text-chip-red">Die aktuelle Frage wurde nicht gefunden.</p>
          <button type="button" className="btn btn-ghost" onClick={() => setState({ phase: 'category', questionId: null })}>
            Zur Kategorie-Auswahl
          </button>
        </div>
      )}

      {s.phase === 'blinds' && (
        <div className="flex flex-col gap-4">
          <p className="text-cream-300">Der TV kündigt die neuen Blinds an:</p>
          <p className="font-display text-4xl text-gold-300 tabular-nums">{formatBlinds(info.current)}</p>
          <button type="button" className="btn btn-primary py-3" onClick={() => setState({ phase: 'category' })}>
            Weiter zur Kategorie-Wahl
          </button>
        </div>
      )}

      {s.phase === 'ended' && <p className="text-cream-300">Dieser Spielabend ist beendet.</p>}

      {s.phase !== 'round' && s.phase !== 'ended' && (
        <div className="mt-10 flex flex-col gap-3 border-t border-felt-700 pt-6">
          <Collapsible title="Blinds anpassen">
            <BlindEditor
              levels={game.blind_levels}
              perLevel={game.questions_per_level}
              currentLevel={info.levelIndex}
              onChange={(levels, perLevel) => save({ blind_levels: levels, questions_per_level: perLevel })}
            />
          </Collapsible>
          <Collapsible title="TV neu verbinden">
            <RoomCodeForm current={game.room_code} onSave={(code) => save({ room_code: code })} />
          </Collapsible>
          <button type="button" className="btn btn-danger mt-2 self-start py-2 text-sm" onClick={finishGame}>
            Spielabend beenden
          </button>
        </div>
      )}
    </Frame>
  )
}

// ---------------------------------------------------------------------------

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {children}
    </div>
  )
}

function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-felt-700 bg-felt-900/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-xl flex-col gap-2">{children}</div>
    </div>
  )
}

function Collapsible({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="card group px-4 py-3">
      <summary className="cursor-pointer list-none text-cream-100 marker:hidden">
        <span className="flex items-center justify-between">
          {title}
          <span className="text-cream-300 transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="pt-4">{children}</div>
    </details>
  )
}

function RoomCodeForm({ current, onSave }: { current: string; onSave: (code: string) => void }) {
  const [code, setCode] = useState('')
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-cream-300">Aktueller Code: <span className="font-mono text-cream-100">{current}</span>. Neuen Code vom TV eintippen:</p>
      <div className="flex gap-2">
        <input
          className="field text-center font-mono tracking-[0.3em] uppercase"
          placeholder="TV-CODE"
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
  const withQuestions = categories
    .map((c) => ({ c, qs: available.filter((q) => q.category_id === c.id) }))
    .filter((x) => x.qs.length > 0)

  if (picked) {
    const entry = withQuestions.find((x) => x.c.id === picked)
    const qs = entry?.qs ?? []
    return (
      <div className="flex flex-col gap-3">
        <button type="button" className="self-start text-sm text-cream-300 hover:text-cream-50" onClick={() => onPick(null)}>
          ‹ Andere Kategorie
        </button>
        <h2 className="flex items-center gap-2 font-display text-2xl text-cream-50">
          <span className="size-3 rounded-full" style={{ background: entry?.c.color }} />
          {entry?.c.name}
        </h2>
        <p className="text-sm text-cream-300">Welche Frage wird gespielt? (nur du siehst das)</p>
        <ul className="flex flex-col gap-2">
          {qs.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                className="card flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:border-gold-500"
                onClick={() => onStart(q)}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-display text-lg text-cream-50">{q.title}</span>
                  <span className="shrink-0 text-sm text-gold-300 tabular-nums">{formatAnswer(q)}</span>
                </span>
                <span className="line-clamp-2 text-sm text-cream-300">{q.question}</span>
              </button>
            </li>
          ))}
        </ul>
        {qs.length > 1 && (
          <button type="button" className="btn btn-ghost" onClick={() => onStart(qs[Math.floor(Math.random() * qs.length)])}>
            Zufällige Frage
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-cream-300">Der Big Blind wählt eine Kategorie:</p>
      {withQuestions.length === 0 && <p className="text-gold-300">Keine spielbereiten Fragen mehr übrig.</p>}
      <ul className="grid grid-cols-2 gap-2">
        {withQuestions.map(({ c, qs }) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className="card flex h-full w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:border-gold-500"
              style={{ borderTopColor: c.color, borderTopWidth: 3 }}
            >
              <span className="font-display text-lg leading-tight text-cream-50">{c.name}</span>
              <span className="text-sm text-cream-300">{qs.length} {qs.length === 1 ? 'Frage' : 'Fragen'}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Block({
  label,
  shown,
  text,
  highlight,
  media,
  keyFor,
  onVideo,
}: {
  label: string
  shown: boolean
  text: string
  highlight?: string
  media: Media[]
  keyFor: (i: number) => string
  onVideo: (c: VideoCommand) => void
}) {
  return (
    <section className={`rounded-xl border p-4 ${shown ? 'border-gold-500/50 bg-felt-800' : 'border-felt-700 bg-felt-900/60'}`}>
      <div className="mb-1.5 flex items-center justify-between text-xs tracking-widest uppercase">
        <span className="text-cream-300">{label}</span>
        <span className={shown ? 'text-gold-300' : 'text-cream-300/60'}>{shown ? 'auf dem TV' : 'verdeckt'}</span>
      </div>
      {highlight && <p className="font-display text-3xl text-gold-300 tabular-nums">{highlight}</p>}
      {text && <p className="whitespace-pre-wrap text-cream-50">{text}</p>}
      {media.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {media.map((m, i) => (
            <li key={i} className="flex items-center gap-3">
              <img
                src={m.type === 'image' ? mediaUrl(m.path) : youTubeThumbnail(m.videoId)}
                alt=""
                className="size-14 shrink-0 rounded-md object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-cream-300">
                {m.caption || (m.type === 'image' ? 'Bild' : 'YouTube')}
                {m.type === 'youtube' && (m.start != null || m.end != null) && (
                  <span className="block text-xs">{formatTime(m.start ?? 0)}–{m.end != null ? formatTime(m.end) : 'Ende'}</span>
                )}
              </span>
              {m.type === 'youtube' && shown && (
                <span className="flex shrink-0 gap-1">
                  <VideoButton label="Abspielen" icon="play" onClick={() => onVideo({ key: keyFor(i), cmd: 'play' })} />
                  <VideoButton label="Pause" text="❚❚" onClick={() => onVideo({ key: keyFor(i), cmd: 'pause' })} />
                  <VideoButton label="Von vorn" text="↺" onClick={() => onVideo({ key: keyFor(i), cmd: 'restart' })} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function VideoButton({ label, icon, text, onClick }: { label: string; icon?: 'play'; text?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-lg border border-felt-600 text-cream-100 hover:border-gold-500"
    >
      {icon ? <Icon name={icon} className="size-4" /> : <span className="text-sm">{text}</span>}
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
