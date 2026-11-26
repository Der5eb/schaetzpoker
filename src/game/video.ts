// Steuerung eingebetteter YouTube-Videos auf dem TV über die IFrame-API (postMessage).
// Der Player meldet seinen Zustand zurück – so wissen wir, ob ein Ausschnitt schon zu Ende ist
// oder ob der Browser das Abspielen mit Ton blockiert hat.

const PLAYING = 1
const BUFFERING = 3
const ENDED = 0

type SoundListener = (blocked: boolean) => void
const soundListeners = new Set<SoundListener>()
const players = new Set<YouTubePlayer>()
let listening = false

function ensureListener() {
  if (listening) return
  listening = true
  window.addEventListener('message', (e) => {
    if (typeof e.data !== 'string' || !/^https:\/\/(www\.)?youtube(-nocookie)?\.com$/.test(e.origin)) return
    let msg: { event?: string; info?: { playerState?: number; currentTime?: number } | null }
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    for (const p of players) if (p.iframe.contentWindow === e.source) p.receive(msg)
  })
}

export class YouTubePlayer {
  private ready = false
  private state = -1
  private time = 0
  private queue: (() => void)[] = []
  private handshake: number | undefined
  private check: number | undefined
  /** Von uns stummgeschaltet, weil der Browser Ton ohne Klick nicht erlaubt */
  mutedByUs = false

  readonly iframe: HTMLIFrameElement
  private readonly videoId: string
  private readonly start: number
  private readonly end: number | undefined

  constructor(iframe: HTMLIFrameElement, videoId: string, start?: number, end?: number) {
    this.iframe = iframe
    this.videoId = videoId
    this.start = start ?? 0
    this.end = end
    ensureListener()
    players.add(this)
    // Anmelden, bis der Player antwortet (er lädt evtl. noch)
    let tries = 0
    this.handshake = window.setInterval(() => {
      if (this.ready || ++tries > 120) return window.clearInterval(this.handshake)
      this.post({ event: 'listening', id: videoId, channel: 'widget' })
    }, 250)
  }

  destroy() {
    window.clearInterval(this.handshake)
    window.clearTimeout(this.check)
    players.delete(this)
    if (this.mutedByUs) notifySound()
  }

  receive(msg: { event?: string; info?: { playerState?: number; currentTime?: number } | null }) {
    if (msg.event === 'onReady' || msg.event === 'initialDelivery') {
      if (!this.ready) {
        this.ready = true
        window.clearInterval(this.handshake)
        const q = this.queue
        this.queue = []
        q.forEach((f) => f())
      }
    }
    if (msg.event === 'infoDelivery' || msg.event === 'onStateChange') {
      const info = msg.info
      if (typeof info?.playerState === 'number') this.state = info.playerState
      if (typeof info?.currentTime === 'number') this.time = info.currentTime
    }
  }

  command(cmd: 'play' | 'pause' | 'restart') {
    const run = () => {
      if (cmd === 'pause') {
        window.clearTimeout(this.check)
        return this.send('pauseVideo')
      }
      // Ausschnitt schon durchgelaufen? Dann würde YouTube das ganze Video ab 0:00 abspielen –
      // stattdessen den Ausschnitt neu laden (startet und stoppt an den richtigen Stellen).
      const outside = this.state === ENDED || this.time < this.start - 1 || (this.end != null && this.time >= this.end - 0.5)
      if (cmd === 'restart' || (outside && this.state !== -1 && this.state !== 5)) {
        this.send('loadVideoById', [{ videoId: this.videoId, startSeconds: this.start, ...(this.end != null && { endSeconds: this.end }) }])
      } else {
        this.send('playVideo')
      }
      this.watchStart()
    }
    if (this.ready) run()
    else this.queue = [run]
  }

  unmute() {
    if (!this.mutedByUs) return
    this.mutedByUs = false
    this.send('unMute')
  }

  /** Läuft das Video nach dem Befehl nicht an, hat der Browser vermutlich Ton blockiert: stumm starten. */
  private watchStart() {
    window.clearTimeout(this.check)
    this.check = window.setTimeout(() => {
      if (this.state === PLAYING || this.state === BUFFERING) return
      this.send('mute')
      this.send('playVideo')
      this.check = window.setTimeout(() => {
        if (this.state === PLAYING || this.state === BUFFERING) {
          this.mutedByUs = true
          notifySound()
        } else {
          this.send('unMute')
        }
      }, 1500)
    }, 2000)
  }

  private send(func: string, args: unknown[] = []) {
    this.post({ event: 'command', func, args })
  }

  private post(data: unknown) {
    this.iframe.contentWindow?.postMessage(JSON.stringify(data), '*')
  }
}

export type VideoRegistry = Map<string, YouTubePlayer>

export function controlVideo(player: YouTubePlayer, cmd: 'play' | 'pause' | 'restart') {
  player.command(cmd)
}

function notifySound() {
  const blocked = [...players].some((p) => p.mutedByUs)
  soundListeners.forEach((l) => l(blocked))
}

/** Meldet, ob gerade ein Video nur stumm läuft (Ton braucht einen Klick am TV). */
export function onSoundBlocked(l: SoundListener): () => void {
  soundListeners.add(l)
  return () => soundListeners.delete(l)
}

/** Nach einem Klick/Tastendruck am TV: Ton für alle stumm gestarteten Videos einschalten. */
export function unmuteAll() {
  players.forEach((p) => p.unmute())
  notifySound()
}
