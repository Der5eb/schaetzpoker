// Steuerung eingebetteter YouTube-Videos auf dem TV über die IFrame-API (postMessage).
// Der Player meldet seinen Zustand zurück – so wissen wir, ob ein Ausschnitt schon zu Ende ist
// oder ob der Browser das Abspielen mit Ton blockiert hat.

const ENDED = 0
const PLAYING = 1
const PAUSED = 2
const BUFFERING = 3
/** So lange darf ein Video laden, bevor wir von einer Sperre ausgehen */
const MAX_LOADING_MS = 15000

export interface SoundState {
  /** Ein Video läuft nur stumm oder wartet auf einen Klick am TV */
  blocked: boolean
  /** Auf dieser Seite lief schon ein Video mit Ton – der Browser erlaubt es also */
  works: boolean
}
type SoundListener = (s: SoundState) => void
const soundListeners = new Set<SoundListener>()
let soundWorks = false
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
  private watchStarted = 0
  private triedMuted = false
  /** Zuletzt gesehen, dass die Wiedergabezeit weiterläuft (ms) */
  private lastProgress = 0
  /** Von uns stummgeschaltet, weil der Browser Ton ohne Klick nicht erlaubt */
  mutedByUs = false
  /** Browser hat sogar stummes Abspielen blockiert – nach dem nächsten Klick am TV starten */
  waitingForClick = false

  readonly iframe: HTMLIFrameElement
  private readonly start: number
  private readonly end: number | undefined

  constructor(iframe: HTMLIFrameElement, videoId: string, start?: number, end?: number) {
    this.iframe = iframe
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
    if (this.mutedByUs || this.waitingForClick) notifySound()
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
      if (typeof info?.currentTime === 'number') {
        if (this.state === PLAYING && info.currentTime > this.time) this.lastProgress = Date.now()
        this.time = info.currentTime
      }
      // Ende des Ausschnitts selbst einhalten: anhalten statt YouTube „beenden“ zu lassen –
      // so bleibt das Video geladen und startet beim nächsten Mal sofort.
      if (this.state === PLAYING && this.end != null && this.time >= this.end - 0.25) {
        this.state = PAUSED
        this.send('pauseVideo')
      }
    }
  }

  command(cmd: 'play' | 'pause' | 'restart') {
    const run = () => {
      if (cmd === 'pause') {
        window.clearTimeout(this.check)
        if (this.waitingForClick) {
          this.waitingForClick = false
          notifySound()
        }
        return this.send('pauseVideo')
      }
      // Ausschnitt schon durchgelaufen (oder außerhalb)? Zurück an den Anfang springen –
      // ohne Neuladen, damit es sofort weitergeht.
      const started = this.state !== -1 && this.state !== 5
      const outside = this.state === ENDED || this.time < this.start - 1 || (this.end != null && this.time >= this.end - 0.5)
      if (cmd === 'restart' || (started && outside)) this.send('seekTo', [this.start, true])
      this.send('playVideo')
      this.watchStart()
    }
    if (this.ready) run()
    else this.queue = [run]
  }

  /** Nach einem Klick am TV: Ton einschalten bzw. blockiertes Video jetzt starten. */
  activate() {
    if (this.mutedByUs) {
      this.mutedByUs = false
      this.send('unMute')
      soundWorks = true
    }
    if (this.waitingForClick) {
      this.waitingForClick = false
      this.send('unMute')
      this.send('playVideo')
    }
  }

  /** Läuft wirklich etwas? „Lädt“ zählt nicht – blockierte Videos bleiben oft beim Laden hängen. */
  private running() {
    return this.state === PLAYING && Date.now() - this.lastProgress < 1500
  }

  /**
   * Läuft das Video nach dem Befehl nicht an, hat der Browser vermutlich Ton ohne Klick blockiert:
   * stumm weiterspielen und am TV um einen Klick bitten. Klappt nicht mal das, startet es nach dem Klick.
   * Solange YouTube noch lädt, wird gewartet – langes Laden ist keine Sperre.
   */
  private watchStart() {
    window.clearTimeout(this.check)
    this.watchStarted = Date.now()
    this.triedMuted = false
    const tick = () => {
      if (this.running()) {
        if (this.triedMuted) this.mutedByUs = true
        else soundWorks = true
        notifySound()
        return
      }
      const elapsed = Date.now() - this.watchStarted
      // Lädt noch oder meldet schon „spielt“, die Zeit läuft aber noch nicht: abwarten
      const loading = (this.state === BUFFERING || this.state === PLAYING) && elapsed < MAX_LOADING_MS
      if (elapsed < 2500 || loading) {
        this.check = window.setTimeout(tick, 500)
        return
      }
      if (!this.triedMuted) {
        // Abgelehnt: stumm noch einmal versuchen (das erlauben Browser ohne Klick)
        this.triedMuted = true
        this.watchStarted = Date.now()
        this.send('mute')
        this.send('playVideo')
        this.check = window.setTimeout(tick, 500)
        return
      }
      this.send('unMute')
      this.waitingForClick = true
      notifySound()
    }
    this.check = window.setTimeout(tick, 500)
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
  const blocked = [...players].some((p) => p.mutedByUs || p.waitingForClick)
  soundListeners.forEach((l) => l({ blocked, works: soundWorks }))
}

/** Meldet, ob gerade ein Video nur stumm läuft (Ton braucht einen Klick am TV) und ob Ton schon klappte. */
export function onSoundState(l: SoundListener): () => void {
  soundListeners.add(l)
  return () => soundListeners.delete(l)
}

/** Nach einem Klick/Tastendruck am TV: Ton einschalten bzw. blockierte Videos starten. */
export function activateVideos() {
  players.forEach((p) => p.activate())
  notifySound()
}
