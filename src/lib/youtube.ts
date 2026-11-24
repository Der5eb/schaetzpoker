const ID = /^[\w-]{11}$/

/** Erkennt youtu.be/…, youtube.com/watch?v=…, /shorts/…, /embed/…, /live/… und die nackte Video-ID. */
export function parseYouTube(input: string): { videoId: string; start?: number } | null {
  const s = input.trim()
  if (ID.test(s)) return { videoId: s }

  let url: URL
  try {
    url = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }

  const host = url.hostname.replace(/^(www|m|music)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0]
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else id = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1] ?? null
  }
  if (!id || !ID.test(id)) return null

  const t = url.searchParams.get('t') ?? url.searchParams.get('start')
  return { videoId: id, start: t ? parseYouTubeTime(t) : undefined }
}

/** "90", "90s", "1m30s", "1h2m3s" → Sekunden */
function parseYouTubeTime(t: string): number | undefined {
  if (/^\d+$/.test(t)) return Number(t)
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/)
  if (!m || !m[0]) return undefined
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
}

export function youTubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}
