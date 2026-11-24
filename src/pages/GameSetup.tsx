import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BlindEditor } from '../components/BlindEditor'
import { Shell } from '../components/Shell'
import { defaultLevels } from '../game/blinds'
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
    if (!window.confirm(`„${game.name}“ beenden?`)) return
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
        <div className="card mb-6 flex flex-col gap-3 border-gold-500/50 p-4">
          <div>
            <div className="text-sm text-gold-300">Läuft gerade</div>
            <div className="font-display text-xl text-cream-50">{openGame.name}</div>
            <div className="text-sm text-cream-300">{openGame.state.completed ?? 0} Fragen gespielt</div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary flex-1" onClick={() => resume(openGame)}>
              Fortsetzen
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => finish(openGame)}>
              Beenden
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-7 pb-28">
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-cream-50">TV verbinden</h2>
          <p className="text-sm text-cream-300">
            Auf dem Laptop am TV <span className="text-cream-100">{tvUrl().replace(/^https?:\/\//, '')}</span> öffnen und den
            QR-Code mit diesem Handy scannen – oder den Code hier eintippen. Geht auch später.
          </p>
          <input
            className="field text-center font-mono text-xl tracking-[0.3em] uppercase"
            placeholder="TV-CODE"
            value={roomCode}
            onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-cream-50">Name</h2>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg text-cream-50">Blinds</h2>
          <BlindEditor
            levels={levels}
            perLevel={perLevel}
            onChange={(l, p) => {
              setLevels(l)
              setPerLevel(p)
            }}
          />
        </section>

        {stats && (
          <p className={`text-sm ${stats.questions < 10 ? 'text-gold-300' : 'text-cream-300'}`}>
            {stats.questions} spielbereite Fragen in {stats.categories} Kategorien.
            {stats.questions < 10 && ' Für einen Abend werden etwa 10 gebraucht.'}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-felt-700 bg-felt-900/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {error && <p className="text-sm text-chip-red">{error}</p>}
          <button type="button" className="btn btn-primary w-full py-3" disabled={busy} onClick={start}>
            {openGame ? 'Neuen Spielabend starten' : 'Spielabend starten'}
          </button>
        </div>
      </div>
    </Shell>
  )
}
