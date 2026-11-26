import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BlindEditor } from '../components/BlindEditor'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Icon } from '../components/Icon'
import { ActionBar, SectionTitle, Shell } from '../components/Shell'
import { defaultLevels, validateLevels } from '../game/blinds'
import { availableQuestions } from '../game/display'
import { newRoomCode, normalizeRoomCode } from '../game/room'
import { createGame, fetchOpenGame, fetchQuestions, updateGame } from '../lib/data'
import type { BlindLevel, Game } from '../lib/types'

function tvUrl(): string {
  return `${location.origin}${location.pathname}#/tv`
}

export function GameSetup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [openGame, setOpenGame] = useState<Game | null>(null)
  const [stats, setStats] = useState<{ questions: number; categories: number } | null>(null)
  const [roomCode, setRoomCode] = useState(() => normalizeRoomCode(params.get('raum') ?? ''))
  const [name, setName] = useState(() => `Spielabend ${new Date().toLocaleDateString('de-DE')}`)
  const [levels, setLevels] = useState<BlindLevel[]>(() => defaultLevels(10, 20, 6))
  const [perLevel, setPerLevel] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'new' | 'finish'>(null)

  useEffect(() => {
    fetchOpenGame().then(setOpenGame).catch(() => {})
    fetchQuestions()
      .then((qs) => {
        const av = availableQuestions(qs)
        setStats({ questions: av.length, categories: new Set(av.map((q) => q.category_id).filter(Boolean)).size })
      })
      .catch(() => {})
  }, [])

  async function resume(game: Game) {
    // Neuer TV-Code aus dem QR-Code? Dann den laufenden Abend dorthin verbinden.
    if (roomCode.length === 6 && roomCode !== game.room_code) {
      await updateGame(game.id, { room_code: roomCode })
    }
    navigate(`/leitung/${game.id}`)
  }

  async function finish(game: Game) {
    await updateGame(game.id, { finished_at: new Date().toISOString(), state: { ...game.state, phase: 'ended' } })
    setOpenGame(null)
  }

  async function start() {
    setBusy(true)
    setError(null)
    try {
      if (openGame) await updateGame(openGame.id, { finished_at: new Date().toISOString() })
      const game = await createGame({
        room_code: roomCode.length === 6 ? roomCode : newRoomCode(),
        name: name.trim() || 'Spielabend',
        blind_levels: levels,
        questions_per_level: perLevel,
      })
      navigate(`/leitung/${game.id}`)
    } catch (e) {
      console.error(e)
      setError('Spielabend konnte nicht angelegt werden.')
      setBusy(false)
    }
  }

  return (
    <Shell title="Spielabend" back="/">
      {openGame && (
        <div className="animate-focus-in mb-8 rounded-2xl border border-gold-400/40 bg-[linear-gradient(135deg,rgb(209_164_70/0.16),rgb(209_164_70/0.03))] p-4 shadow-[var(--shadow-lift)]">
          <div className="flex items-center gap-3">
            <span className="relative flex size-2.5">
              <span className="animate-pulse-dot absolute inset-0 rounded-full bg-ok" />
              <span className="relative size-2.5 rounded-full bg-ok" />
            </span>
            <span className="text-sm font-medium text-gold-200">Läuft gerade</span>
          </div>
          <p className="mt-1.5 font-display text-2xl font-extrabold text-cream-50">{openGame.name}</p>
          <p className="text-sm text-cream-400">
            {openGame.state.completed ?? 0} {(openGame.state.completed ?? 0) === 1 ? 'Frage' : 'Fragen'} gespielt
          </p>
          <button type="button" className="btn btn-ghost mt-4 min-h-11 py-2 text-sm" onClick={() => setConfirm('finish')}>
            <Icon name="flag" className="size-4" /> Abend beenden
          </button>
        </div>
      )}

      <div className={`flex flex-col gap-10 ${openGame ? "pb-48" : "pb-32"}`}>
        <section className="flex flex-col gap-3">
          <SectionTitle>TV verbinden</SectionTitle>
          <p className="text-sm leading-relaxed text-cream-300">
            Am Fernseher <span className="font-medium text-cream-100">{tvUrl().replace(/^https?:\/\//, '')}</span> öffnen (im TV-Browser oder per Laptop/Chromecast)
            und den QR-Code mit diesem Handy scannen – oder den Code hier eintippen. Geht auch später.
          </p>
          <div className="relative">
            <Icon name="tv" weight="duotone" className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-gold-300" />
            <input
              className="field py-3.5 pl-14 font-display text-2xl font-extrabold tracking-[0.35em] text-gold-200 uppercase placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal"
              aria-label="TV-Code"
              placeholder="TV-Code"
              autoCapitalize="characters"
              autoComplete="off"
              value={roomCode}
              onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
            />
            {roomCode.length === 6 && (
              <Icon name="check" weight="bold" className="animate-enter absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ok" />
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionTitle>Name des Abends</SectionTitle>
          <input className="field" aria-label="Name des Abends" value={name} onChange={(e) => setName(e.target.value)} />
        </section>

        <section className="flex flex-col gap-4">
          <SectionTitle>Blinds</SectionTitle>
          <BlindEditor
            levels={levels}
            perLevel={perLevel}
            onChange={(l, p) => {
              setLevels(l)
              setPerLevel(p)
            }}
          />
          {validateLevels(levels, perLevel) && (
            <p role="alert" className="text-sm text-danger">
              {validateLevels(levels, perLevel)}
            </p>
          )}
        </section>

        {stats && (
          <p
            className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm ${
              stats.questions < 10 ? 'bg-gold-400/10 text-gold-200' : 'bg-felt-950/40 text-cream-300'
            }`}
          >
            <Icon name="cards" weight="duotone" className="mt-px size-5 shrink-0" />
            <span>
              {stats.questions} spielbereite {stats.questions === 1 ? 'Frage' : 'Fragen'} in {stats.categories}{' '}
              {stats.categories === 1 ? 'Kategorie' : 'Kategorien'}.
              {stats.questions < 10 && ' Für einen Abend werden etwa 10 gebraucht.'}
            </span>
          </p>
        )}
      </div>

      <ActionBar>
        {error && <p className="text-sm text-danger">{error}</p>}
        {openGame ? (
          <>
            <button type="button" className="btn btn-primary w-full py-3.5 text-base" onClick={() => resume(openGame)}>
              „{openGame.name}“ fortsetzen <Icon name="arrow" weight="bold" className="size-5" />
            </button>
            <button type="button" className="btn btn-ghost min-h-11 w-full text-sm" disabled={busy} onClick={() => setConfirm('new')}>
              Stattdessen neuen Abend starten
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full py-3.5 text-base"
            disabled={busy || !!validateLevels(levels, perLevel)}
            onClick={start}
          >
            <Icon name="chip" weight="duotone" className="size-5" /> Spielabend starten
          </button>
        )}
      </ActionBar>

      <ConfirmDialog
        open={confirm === 'new'}
        danger
        title="Laufenden Abend ersetzen?"
        confirmLabel="Beenden und neu starten"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          start()
        }}
      >
        „{openGame?.name}“ läuft noch ({openGame?.state.completed ?? 0} Fragen gespielt). Ein neuer Abend beendet ihn.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'finish'}
        danger
        title="Spielabend beenden?"
        confirmLabel="Abend beenden"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          if (openGame) finish(openGame)
        }}
      >
        „{openGame?.name}“ wird beendet. Gespielte Fragen bleiben als gespielt markiert.
      </ConfirmDialog>
    </Shell>
  )
}
