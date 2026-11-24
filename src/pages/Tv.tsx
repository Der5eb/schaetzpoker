import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { MediaGallery } from '../components/MediaGallery'
import { Qr } from '../components/Qr'
import { formatBlinds } from '../game/blinds'
import { mediaKey } from '../game/display'
import { newRoomCode, useTvRoom } from '../game/room'
import type { DisplayState, VideoCommand } from '../game/types'
import { controlVideo, type VideoRegistry } from '../game/video'

const CODE_KEY = 'schaetzpoker:tv-code'

function loadCode(): string {
  try {
    const existing = sessionStorage.getItem(CODE_KEY)
    if (existing) return existing
    const code = newRoomCode()
    sessionStorage.setItem(CODE_KEY, code)
    return code
  } catch {
    return newRoomCode()
  }
}

const STEPS = ['Frage', 'Hinweis 1', 'Hinweis 2', 'Lösung']

/** Präsentations-Bildschirm für Laptop/TV. Braucht kein Login. */
export function Tv() {
  const [code] = useState(loadCode)
  const [display, setDisplay] = useState<DisplayState | null>(null)
  const [videos] = useState<VideoRegistry>(() => new Map())

  const onVideo = useCallback((c: VideoCommand) => {
    const iframe = videos.get(c.key)
    if (iframe) controlVideo(iframe, c.cmd)
  }, [videos])

  const { connected } = useTvRoom(code, setDisplay, onVideo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pairUrl = `${location.origin}${location.pathname}#/spiel?raum=${code}`

  return (
    <div
      className="relative flex h-dvh w-full flex-col overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#1d4c3a_0%,#0d241b_55%,#06110b_100%)] text-cream-100 select-none"
      onDoubleClick={toggleFullscreen}
    >
      {display && display.phase !== 'ended' && <TopBar d={display} />}

      <main className="flex min-h-0 flex-1 flex-col px-[5vw] pt-[2vh] pb-[5vh]">
        {!display && <Waiting code={code} pairUrl={pairUrl} />}
        {display?.phase === 'lobby' && <Lobby d={display} />}
        {display?.phase === 'category' && <CategoryPick d={display} />}
        {display?.phase === 'round' && <Round d={display} videos={videos} />}
        {display?.phase === 'blinds' && <BlindsUp d={display} />}
        {display?.phase === 'ended' && <Center><Title>Danke fürs Spielen!</Title></Center>}
      </main>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-[1.5vw] pb-[1.2vh] text-[clamp(0.7rem,0.9vw,1rem)] text-cream-300/60">
        <span className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-chip-red'}`} />
          {display ? `TV-Code ${code}` : connected ? 'bereit' : 'verbindet …'}
        </span>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="pointer-events-auto rounded px-2 py-1 hover:bg-white/5 hover:text-cream-100"
        >
          Vollbild (F)
        </button>
      </footer>
    </div>
  )
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  else document.documentElement.requestFullscreen().catch(() => {})
}

// ---------------------------------------------------------------------------

function Center({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-[3vh] text-center">{children}</div>
}

function Title({ children }: { children: ReactNode }) {
  return <h1 className="animate-rise font-display text-[clamp(2.5rem,6vw,8rem)] leading-[1.05] text-cream-50">{children}</h1>
}

function Chip({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#d4a84b" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="#0d241b" strokeWidth="2.4" strokeDasharray="2.6 2.6" />
      <circle cx="12" cy="12" r="6" fill="#123528" />
    </svg>
  )
}

function TopBar({ d }: { d: DisplayState }) {
  const increaseText =
    d.untilIncrease === 1
      ? 'letzte Frage vor der Erhöhung'
      : `erhöhen nach Frage ${d.questionNumber + d.untilIncrease - 1}`
  return (
    <header className="flex items-center justify-between gap-[2vw] px-[5vw] pt-[3vh] text-[clamp(1rem,1.6vw,2rem)]">
      <div className="text-cream-300">
        {d.phase === 'round' || d.phase === 'category' ? (
          <>
            Frage <span className="font-display text-cream-50">{d.questionNumber}</span>
          </>
        ) : (
          d.gameName
        )}
      </div>
      <div className="flex items-center gap-[0.8vw]">
        <Chip className="size-[1.6em]" />
        <span className="font-display text-cream-50 tabular-nums">{formatBlinds(d.blinds)}</span>
        {d.phase !== 'blinds' && <span className="text-[0.75em] text-cream-300">· {increaseText}</span>}
      </div>
    </header>
  )
}

function Waiting({ code, pairUrl }: { code: string; pairUrl: string }) {
  return (
    <Center>
      <img src="./favicon.svg" alt="" className="size-[9vh]" />
      <Title>Schätzpoker</Title>
      <div className="mt-[2vh] flex items-center gap-[4vw] rounded-[1.5vw] bg-felt-950/50 p-[3vh] ring-1 ring-felt-700">
        <Qr value={pairUrl} className="size-[28vh] overflow-hidden rounded-[0.8vw] [&>svg]:size-full" />
        <div className="flex flex-col items-start gap-[1.5vh] text-left">
          <p className="max-w-[28vw] text-[clamp(1rem,1.6vw,2rem)] text-cream-300">
            Spielleitung: QR-Code mit dem Handy scannen oder diesen Code eingeben
          </p>
          <p className="font-mono text-[clamp(2rem,5vw,6rem)] tracking-[0.2em] text-gold-300">{code}</p>
        </div>
      </div>
    </Center>
  )
}

function Lobby({ d }: { d: DisplayState }) {
  return (
    <Center>
      <p className="animate-rise text-[clamp(1rem,2vw,2.4rem)] tracking-[0.3em] text-gold-300 uppercase">Gleich geht's los</p>
      <Title>{d.gameName}</Title>
      <p className="animate-rise text-[clamp(1.2rem,2.4vw,3rem)] text-cream-300 [animation-delay:200ms]">
        Start-Blinds <span className="font-display text-cream-50">{formatBlinds(d.blinds)}</span>
      </p>
    </Center>
  )
}

function CategoryPick({ d }: { d: DisplayState }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-[5vh]">
      <div className="animate-rise text-center">
        <p className="text-[clamp(1rem,1.8vw,2.2rem)] tracking-[0.3em] text-gold-300 uppercase">Big Blind wählt</p>
        <h1 className="font-display text-[clamp(2.2rem,4.5vw,6rem)] text-cream-50">eine Kategorie</h1>
      </div>
      {d.categories.length === 0 ? (
        <p className="text-center text-[2vw] text-cream-300">Keine spielbereiten Fragen mehr.</p>
      ) : (
        <ul className="mx-auto grid w-full max-w-[85vw] grid-cols-[repeat(auto-fit,minmax(min(22vw,100%),1fr))] gap-[1.6vw]">
          {d.categories.map((c, i) => (
            <li
              key={c.id}
              className="animate-pop flex flex-col justify-between gap-[1.5vh] rounded-[1.2vw] bg-felt-800/80 px-[1.8vw] py-[2.4vh] shadow-xl shadow-black/30 ring-1 ring-white/5"
              style={{ animationDelay: `${i * 70}ms`, borderTop: `0.5vh solid ${c.color}` }}
            >
              <span className="font-display text-[clamp(1.4rem,2.6vw,3.4rem)] leading-tight text-cream-50">{c.name}</span>
              <span className="text-[clamp(0.9rem,1.3vw,1.6rem)] text-cream-300">
                {c.count} {c.count === 1 ? 'Frage' : 'Fragen'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Round({ d, videos }: { d: DisplayState; videos: VideoRegistry }) {
  const solved = d.reveal >= 3 && d.answer
  const bettingRound = d.reveal + 1

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[3vh]">
      <div className="flex flex-wrap items-center justify-between gap-[1.5vw]">
        <div className="flex items-center gap-[1.5vw]">
          {d.category && (
            <span className="flex items-center gap-[0.6vw] rounded-full bg-felt-950/60 px-[1.2vw] py-[0.6vh] text-[clamp(0.9rem,1.4vw,1.8rem)] text-cream-100">
              <span className="size-[0.9em] rounded-full" style={{ background: d.category.color }} />
              {d.category.name}
            </span>
          )}
          <ol className="flex items-center gap-[0.5vw] text-[clamp(0.8rem,1.15vw,1.5rem)]">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={`rounded-full px-[0.9vw] py-[0.3vh] transition-colors ${
                  i === d.reveal ? 'bg-gold-400 text-felt-950' : i < d.reveal ? 'text-cream-100' : 'text-cream-300/40'
                }`}
              >
                {s}
              </li>
            ))}
          </ol>
        </div>
        <span className="rounded-full bg-chip-red/90 px-[1.2vw] py-[0.6vh] text-[clamp(0.9rem,1.4vw,1.8rem)] font-semibold text-cream-50 shadow-lg shadow-black/30">
          {d.decided ? 'Runde entschieden' : d.reveal >= 3 ? 'Setzrunde 4 · danach Showdown' : `Setzrunde ${bettingRound}`}
        </span>
      </div>

      {solved ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[2.5vh] text-center">
          <p className="max-w-[80vw] text-[clamp(1.1rem,2vw,2.6rem)] text-cream-300">{d.question?.text}</p>
          <p
            key={d.answer!.display}
            className="animate-pop font-display text-[clamp(3rem,9vw,12rem)] leading-none text-gold-300 drop-shadow-[0_0.4vw_1.5vw_rgba(0,0,0,0.5)] tabular-nums"
          >
            {d.answer!.display}
          </p>
          {d.answer!.explanation.text && (
            <p className="animate-rise max-w-[70vw] text-[clamp(1rem,1.7vw,2.2rem)] leading-snug text-cream-100 [animation-delay:400ms]">
              {d.answer!.explanation.text}
            </p>
          )}
          <MediaGallery
            media={d.answer!.explanation.media}
            keyFor={mediaKey.answer}
            registry={videos}
            className="animate-rise [animation-delay:600ms]"
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-[3.5vh]">
          <div className="flex flex-col items-center gap-[2.5vh] text-center">
            <h1
              key={d.question?.text}
              className={`animate-rise max-w-[85vw] font-display leading-[1.12] text-cream-50 ${
                d.hints.length ? 'text-[clamp(1.6rem,3.4vw,4.6rem)]' : 'text-[clamp(2rem,4.6vw,6.4rem)]'
              }`}
            >
              {d.question?.text}
            </h1>
            {d.question && <MediaGallery media={d.question.media} keyFor={mediaKey.question} registry={videos} />}
          </div>

          {d.hints.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(38vw,100%),1fr))] gap-[2vw]">
              {d.hints.map((h, i) => (
                <section
                  key={i}
                  className={`animate-rise flex flex-col gap-[1.5vh] rounded-[1.2vw] px-[2vw] py-[2.5vh] ring-1 ${
                    i === d.hints.length - 1 ? 'bg-felt-800/90 ring-gold-500/50' : 'bg-felt-900/60 ring-white/5'
                  }`}
                >
                  <span className="text-[clamp(0.8rem,1.2vw,1.5rem)] tracking-[0.25em] text-gold-300 uppercase">Hinweis {i + 1}</span>
                  {h.text && <p className="text-[clamp(1.2rem,2.2vw,3rem)] leading-snug text-cream-50">{h.text}</p>}
                  <MediaGallery media={h.media} keyFor={(j) => mediaKey.hint(i + 1, j)} registry={videos} size="sm" />
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BlindsUp({ d }: { d: DisplayState }) {
  return (
    <Center>
      <p className="animate-rise text-[clamp(1rem,2vw,2.4rem)] tracking-[0.3em] text-gold-300 uppercase">Achtung</p>
      <Title>Die Blinds steigen</Title>
      <div className="mt-[3vh] flex items-center gap-[3vw] font-display tabular-nums">
        {d.previousBlinds && (
          <span className="text-[clamp(1.5rem,3.5vw,4.5rem)] text-cream-300/50 line-through decoration-chip-red decoration-[0.3vw]">
            {formatBlinds(d.previousBlinds)}
          </span>
        )}
        <span className="text-[clamp(1.5rem,3vw,4rem)] text-cream-300">→</span>
        <span className="animate-pop flex items-center gap-[1vw] text-[clamp(2.5rem,7vw,9rem)] text-gold-300 [animation-delay:300ms]">
          <Chip className="size-[0.8em]" />
          {formatBlinds(d.blinds)}
        </span>
      </div>
    </Center>
  )
}
