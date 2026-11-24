import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ChipMark } from '../components/ChipMark'
import { ChipStack } from '../components/ChipStack'
import { Icon, type IconName } from '../components/Icon'
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

const STEPS: { label: string; icon: IconName }[] = [
  { label: 'Frage', icon: 'cards' },
  { label: 'Hinweis 1', icon: 'club' },
  { label: 'Hinweis 2', icon: 'diamond' },
  { label: 'Lösung', icon: 'spade' },
]

/** Präsentations-Bildschirm für Laptop/TV. Braucht kein Login. */
export function Tv() {
  const [code] = useState(loadCode)
  const [display, setDisplay] = useState<DisplayState | null>(null)
  const [videos] = useState<VideoRegistry>(() => new Map())

  const onVideo = useCallback(
    (c: VideoCommand) => {
      const iframe = videos.get(c.key)
      if (iframe) controlVideo(iframe, c.cmd)
    },
    [videos],
  )

  const { connected } = useTvRoom(code, setDisplay, onVideo)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pairUrl = `${location.origin}${location.pathname}#/spiel?raum=${code}`
  // Bei jedem Phasen- oder Fragenwechsel wird die Bühne neu "scharfgestellt"
  const sceneKey = display ? `${display.phase}-${display.question?.text ?? ''}-${display.questionNumber}` : 'waiting'

  return (
    <div
      className="relative flex h-dvh w-full cursor-default flex-col overflow-hidden text-cream-100 select-none"
      onDoubleClick={toggleFullscreen}
    >
      <TableBackdrop />

      {display && display.phase !== 'ended' && <TopBar d={display} />}

      <main key={sceneKey} className="animate-focus-in relative flex min-h-0 flex-1 flex-col px-[5vw] pt-[2vh] pb-[6vh]">
        {!display && <Waiting code={code} pairUrl={pairUrl} />}
        {display?.phase === 'lobby' && <Lobby d={display} />}
        {display?.phase === 'category' && <CategoryPick d={display} />}
        {display?.phase === 'round' && <Round d={display} videos={videos} />}
        {display?.phase === 'blinds' && <BlindsUp d={display} />}
        {display?.phase === 'ended' && <Ended />}
      </main>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-[2vw] pb-[1.4vh] text-[clamp(0.7rem,0.85vw,1rem)] text-cream-400/80">
        <span className="flex items-center gap-2">
          <span className={`size-[0.55em] rounded-full ${connected ? 'bg-ok' : 'animate-pulse-dot bg-danger'}`} />
          {display ? `TV-Code ${code}` : connected ? 'bereit' : 'verbindet …'}
        </span>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="pointer-events-auto flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-white/5 hover:text-cream-100"
        >
          <Icon name="fullscreen" className="size-[1.2em]" /> Vollbild (F)
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
// Tisch

/** Lichtkegel, Setzlinie und dunkle Tischkante. */
function TableBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_42%,rgb(255_226_160/0.10),transparent_70%)]" />
      <svg className="absolute inset-0 size-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
        <ellipse cx="800" cy="470" rx="700" ry="360" fill="none" stroke="#d1a446" strokeOpacity="0.16" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <ellipse
          cx="800"
          cy="470"
          rx="672"
          ry="334"
          fill="none"
          stroke="#d1a446"
          strokeOpacity="0.09"
          strokeWidth="1"
          strokeDasharray="2 10"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="absolute inset-0 shadow-[inset_0_0_14vw_3vw_rgb(2_8_5/0.75)]" />
    </div>
  )
}

function TopBar({ d }: { d: DisplayState }) {
  const increaseText =
    d.untilIncrease === 1 ? 'letzte Frage vor der Erhöhung' : `Erhöhung nach Frage ${d.questionNumber + d.untilIncrease - 1}`
  return (
    <header className="relative flex items-start justify-between gap-[2vw] px-[5vw] pt-[3.5vh] text-[clamp(1rem,1.5vw,2rem)]">
      <div className="text-cream-300">
        {d.phase === 'round' || d.phase === 'category' ? (
          <span className="flex items-baseline gap-[0.4em]">
            Frage <span className="font-display text-[1.6em] leading-none font-extrabold text-cream-50 tabular-nums">{d.questionNumber}</span>
          </span>
        ) : (
          <span className="font-display text-[1.2em] font-extrabold text-cream-100">{d.gameName}</span>
        )}
      </div>
      <div className="flex flex-col items-end gap-[0.3vh]">
        <span className="flex items-center gap-[0.5em]">
          <ChipMark className="size-[1.7em] drop-shadow-[0_0.3vh_0.6vh_rgba(0,0,0,0.6)]" />
          <span className="font-display text-[1.5em] leading-none font-extrabold text-cream-50 tabular-nums">{formatBlinds(d.blinds)}</span>
        </span>
        {d.phase !== 'blinds' && <span className="text-[0.72em] text-cream-400">{increaseText}</span>}
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Szenen

function Center({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-1 flex-col items-center justify-center text-center ${className}`}>{children}</div>
}

function Wordmark({ className = '' }: { className?: string }) {
  return (
    <h1 className={`wordmark leading-none ${className}`}>
      Schätz<em>poker</em>
    </h1>
  )
}

function Waiting({ code, pairUrl }: { code: string; pairUrl: string }) {
  return (
    <Center className="gap-[5vh]">
      <div className="flex items-center gap-[1.5vw]">
        <ChipMark className="size-[12vh] drop-shadow-[0_1vh_2vh_rgba(0,0,0,0.6)]" />
        <Wordmark className="text-[clamp(3rem,7.5vw,9rem)]" />
      </div>
      <div className="flex items-center gap-[4vw]">
        <div
          className="playing-card animate-deal p-[2.2vh]"
          style={{ '--deal-x': '-20vw', '--deal-r': '-14deg', '--rest-r': '-3deg', animationDelay: '250ms' } as CSSProperties}
        >
          <Qr value={pairUrl} className="size-[30vh] overflow-hidden rounded-[0.6vw] [&>svg]:size-full" />
        </div>
        <div className="flex flex-col items-start gap-[2vh] text-left">
          <p className="max-w-[26vw] text-[clamp(1rem,1.5vw,2rem)] leading-snug text-cream-300">
            Spielleitung: QR-Code mit dem Handy scannen oder diesen Code eingeben
          </p>
          <p className="font-display text-[clamp(2.5rem,5.5vw,7rem)] leading-none font-extrabold tracking-[0.18em] text-gold-200">{code}</p>
        </div>
      </div>
    </Center>
  )
}

function Lobby({ d }: { d: DisplayState }) {
  return (
    <Center className="gap-[4vh]">
      <ChipMark className="size-[12vh] drop-shadow-[0_1.4vh_2.4vh_rgba(0,0,0,0.6)]" />
      <h1 className="max-w-[80vw] font-display text-[clamp(3rem,7vw,8.5rem)] leading-[1.02] font-extrabold text-cream-50">{d.gameName}</h1>
      <p className="flex items-center gap-[1vw] text-[clamp(1.2rem,2.2vw,2.8rem)] text-cream-300">
        Start-Blinds
        <span className="font-display font-extrabold text-gold-200 tabular-nums">{formatBlinds(d.blinds)}</span>
      </p>
    </Center>
  )
}

function CategoryPick({ d }: { d: DisplayState }) {
  const n = d.categories.length
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-[6vh]">
      <h1 className="text-center font-display text-[clamp(2.2rem,4.4vw,5.6rem)] leading-tight font-extrabold text-cream-50">
        Der Big Blind wählt <em className="font-normal text-gold-200 italic">eine Kategorie</em>
      </h1>
      {n === 0 ? (
        <p className="text-center text-[2vw] text-cream-300">Keine spielbereiten Fragen mehr.</p>
      ) : (
        <ul className="mx-auto flex w-full max-w-[88vw] flex-wrap justify-center gap-[2vw]">
          {d.categories.map((c, i) => {
            const rest = ((i % 3) - 1) * 1.6
            return (
              <li
                key={c.id}
                className="playing-card animate-deal flex aspect-[5/7] w-[clamp(9rem,15vw,20rem)] flex-col justify-between p-[1.4vw]"
                style={
                  {
                    '--deal-x': `${(n / 2 - i) * 9}vw`,
                    '--deal-r': `${-20 + i * 7}deg`,
                    '--rest-r': `${rest}deg`,
                    animationDelay: `${150 + i * 110}ms`,
                  } as CSSProperties
                }
              >
                <span className="flex items-center gap-[0.5vw]">
                  <span className="size-[1.3vw] rounded-full shadow-inner" style={{ background: c.color }} />
                </span>
                <span className="text-center font-display text-[clamp(1.2rem,2.1vw,2.9rem)] leading-tight font-extrabold text-balance text-ink">
                  {c.name}
                </span>
                <span className="flex items-center justify-end gap-[0.4vw] text-[clamp(0.85rem,1.1vw,1.4rem)] text-ink-soft">
                  <span className="font-display font-extrabold tabular-nums">{c.count}</span> {c.count === 1 ? 'Frage' : 'Fragen'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Round({ d, videos }: { d: DisplayState; videos: VideoRegistry }) {
  const solved = d.reveal >= 3 && d.answer

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[3vh]">
      <div className="flex flex-wrap items-center justify-between gap-[1.5vw] text-[clamp(0.85rem,1.2vw,1.6rem)]">
        <div className="flex items-center gap-[1.6vw]">
          {d.category && (
            <span className="flex items-center gap-[0.6vw] rounded-full bg-felt-950/55 px-[1.1vw] py-[0.7vh] text-cream-100 ring-1 ring-white/[0.06]">
              <span className="size-[0.8em] rounded-full" style={{ background: d.category.color }} />
              {d.category.name}
            </span>
          )}
          <ol className="flex items-center gap-[0.3vw]">
            {STEPS.map((s, i) => (
              <li
                key={s.label}
                className={`flex items-center gap-[0.4em] rounded-full px-[0.9vw] py-[0.5vh] transition-colors duration-500 ${
                  i === d.reveal ? 'bg-gold-300 text-felt-950' : i < d.reveal ? 'text-cream-200' : 'text-cream-400/45'
                }`}
              >
                <Icon name={s.icon} weight="fill" className="size-[0.95em]" />
                {s.label}
              </li>
            ))}
          </ol>
        </div>
        <span className="flex items-center gap-[0.5em] rounded-full bg-chip-red px-[1.1vw] py-[0.7vh] font-semibold text-cream-50 shadow-[0_0.6vh_1.6vh_-0.4vh_rgb(0_0_0/0.7),inset_0_1px_0_rgb(255_255_255/0.2)]">
          <Icon name="chip" weight="fill" className="size-[1.1em]" />
          {d.decided ? 'Runde entschieden' : d.reveal >= 3 ? 'Setzrunde 4 · danach Showdown' : `Setzrunde ${d.reveal + 1}`}
        </span>
      </div>

      {solved ? <Solution d={d} videos={videos} /> : <QuestionAndHints d={d} videos={videos} />}
    </div>
  )
}

function QuestionAndHints({ d, videos }: { d: DisplayState; videos: VideoRegistry }) {
  const hasHints = d.hints.length > 0
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-[4vh]">
      <div className="flex flex-col items-center gap-[2.5vh] text-center">
        <h1
          className={`max-w-[84vw] font-display leading-[1.08] font-extrabold text-cream-50 drop-shadow-[0_0.4vh_1vh_rgba(0,0,0,0.45)] transition-[font-size] duration-700 ease-[var(--ease-out-expo)] ${
            hasHints ? 'text-[clamp(1.6rem,3.2vw,4.4rem)]' : 'text-[clamp(2.2rem,5vw,6.6rem)]'
          }`}
        >
          {d.question?.text}
        </h1>
        {d.question && <MediaGallery media={d.question.media} keyFor={mediaKey.question} registry={videos} size={hasHints ? 'sm' : 'lg'} />}
      </div>

      {hasHints && (
        <div className="flex items-stretch justify-center gap-[2.5vw]">
          {d.hints.map((h, i) => (
            <section
              key={i}
              className="playing-card animate-deal flex w-[min(40vw,46rem)] flex-col gap-[1.6vh] px-[2.4vw] pt-[2.8vh] pb-[3vh]"
              style={
                {
                  '--deal-x': i === 0 ? '30vw' : '10vw',
                  '--deal-r': '-18deg',
                  '--rest-r': i === 0 ? '-1deg' : '1deg',
                } as CSSProperties
              }
            >
              <span className="flex items-center gap-[0.5vw] text-[clamp(0.9rem,1.25vw,1.6rem)] font-semibold text-ink-soft">
                <Icon
                  name={i === 0 ? 'club' : 'diamond'}
                  weight="fill"
                  className={`size-[1.3em] ${i === 0 ? 'text-ink' : 'text-chip-red'}`}
                />
                Hinweis {i + 1}
              </span>
              {h.text && <p className="font-display text-[clamp(1.2rem,2.2vw,3rem)] leading-snug font-bold text-ink">{h.text}</p>}
              <MediaGallery media={h.media} keyFor={(j) => mediaKey.hint(i + 1, j)} registry={videos} size="sm" />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function Solution({ d, videos }: { d: DisplayState; videos: VideoRegistry }) {
  const a = d.answer!
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[3.5vh] text-center">
      <p className="max-w-[78vw] font-display text-[clamp(1.1rem,2vw,2.6rem)] leading-snug text-cream-300">{d.question?.text}</p>

      {/* Die Lösung als Karte, die umgedreht wird */}
      <div className="[perspective:2400px]">
        <div className="animate-flip relative [transform-style:preserve-3d]">
          <div className="playing-card flex min-w-[min(44vw,52rem)] flex-col items-center gap-[1vh] px-[4vw] py-[4.5vh] [backface-visibility:hidden]">
            <Icon name="spade" weight="fill" className="absolute top-[2.2vh] left-[1.6vw] size-[2.2vw] text-ink" />
            <Icon name="spade" weight="fill" className="absolute right-[1.6vw] bottom-[2.2vh] size-[2.2vw] rotate-180 text-ink" />
            <span className="font-display text-[clamp(3rem,8.5vw,11rem)] leading-none font-black text-ink tabular-nums">{a.display}</span>
          </div>
          <div className="card-back absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]" />
        </div>
      </div>

      {a.explanation.text && (
        <p className="animate-enter max-w-[66vw] text-[clamp(1rem,1.65vw,2.2rem)] leading-relaxed text-cream-100 [animation-delay:1500ms]">
          {a.explanation.text}
        </p>
      )}
      <MediaGallery media={a.explanation.media} keyFor={mediaKey.answer} registry={videos} size="sm" className="animate-enter [animation-delay:1700ms]" />
    </div>
  )
}

function BlindsUp({ d }: { d: DisplayState }) {
  return (
    <Center className="gap-[5vh]">
      <h1 className="font-display text-[clamp(2.5rem,6vw,7.5rem)] leading-none font-extrabold text-cream-50">
        Die Blinds <em className="font-normal text-gold-200 italic">steigen</em>
      </h1>
      <div className="flex items-end gap-[4vw]">
        <ChipStack count={7} className="h-[34vh] w-auto drop-shadow-[0_1vh_1.5vh_rgba(0,0,0,0.45)]" />
        <div className="flex flex-col items-start gap-[1.5vh] pb-[2vh] font-display tabular-nums">
          {d.previousBlinds && (
            <span className="relative text-[clamp(1.4rem,3.2vw,4rem)] leading-none text-cream-400">
              {formatBlinds(d.previousBlinds)}
              <span
                aria-hidden="true"
                className="absolute inset-x-[-0.1em] top-1/2 h-[0.08em] origin-left rounded-full bg-chip-red [animation:strike_0.5s_var(--ease-out-expo)_0.9s_both]"
              />
            </span>
          )}
          <span className="animate-enter text-[clamp(3rem,8vw,10rem)] leading-none font-semibold text-gold-200 [animation-delay:1100ms]">
            {formatBlinds(d.blinds)}
          </span>
        </div>
      </div>
    </Center>
  )
}

function Ended() {
  return (
    <Center className="gap-[4vh]">
      <ChipMark className="size-[12vh]" />
      <Wordmark className="text-[clamp(3rem,7vw,8.5rem)]" />
      <p className="font-display text-[clamp(1.4rem,3vw,3.8rem)] text-cream-200 italic">Danke fürs Spielen!</p>
    </Center>
  )
}
