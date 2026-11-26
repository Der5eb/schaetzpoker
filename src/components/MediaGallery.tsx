import { useEffect, useRef } from 'react'
import { YouTubePlayer, type VideoRegistry } from '../game/video'
import { mediaUrl } from '../lib/media'
import type { Media } from '../lib/types'

interface Props {
  media: Media[]
  /** Schlüssel-Präfix je Medium, z. B. (i) => `q-${i}` */
  keyFor: (i: number) => string
  registry: VideoRegistry
  className?: string
  /** Höhe von Bildern/Videos; in Hinweis-Karten kleiner */
  size?: 'lg' | 'sm' | 'xs'
}

/** Bilder und YouTube-Ausschnitte auf dem TV. */
export function MediaGallery({ media, keyFor, registry, className = '', size = 'lg' }: Props) {
  if (media.length === 0) return null
  const h = { lg: 'max-h-[38vh]', sm: 'max-h-[26vh]', xs: 'max-h-[16vh]' }[size]
  const vh = { lg: 'h-[38vh]', sm: 'h-[26vh]', xs: 'h-[16vh]' }[size]
  return (
    <div className={`flex min-h-0 flex-wrap items-start justify-center ${size === 'xs' ? 'gap-[1.2vw]' : 'gap-[2vw]'} ${className}`}>
      {media.map((m, i) => (
        <figure key={keyFor(i)} data-media-key={keyFor(i)} className="flex min-h-0 max-w-full flex-col items-center gap-[0.6vw]">
          {m.type === 'image' ? (
            <img
              src={mediaUrl(m.path)}
              alt={m.caption ?? ''}
              className={`${h} max-w-full rounded-[0.8vw] object-contain shadow-2xl shadow-black/50`}
            />
          ) : (
            <YouTubeFrame
              registryKey={keyFor(i)}
              registry={registry}
              title={m.caption ?? 'Video'}
              className={`aspect-video ${vh} max-w-full rounded-[0.8vw] bg-black shadow-2xl shadow-black/50`}
              videoId={m.videoId}
              start={m.start}
              end={m.end}
            />
          )}
          {m.caption && <figcaption className="text-[clamp(0.9rem,1.3vw,1.6rem)] text-cream-300">{m.caption}</figcaption>}
        </figure>
      ))}
    </div>
  )
}

/** Eingebettetes Video, das sich unter seinem Schlüssel für die Fernsteuerung anmeldet. */
function YouTubeFrame({
  registryKey,
  registry,
  title,
  className,
  videoId,
  start,
  end,
}: {
  registryKey: string
  registry: VideoRegistry
  title: string
  className: string
  videoId: string
  start?: number
  end?: number
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const player = new YouTubePlayer(el, videoId, start, end)
    registry.set(registryKey, player)
    return () => {
      player.destroy()
      if (registry.get(registryKey) === player) registry.delete(registryKey)
    }
  }, [registry, registryKey, videoId, start, end])
  return (
    <iframe
      ref={ref}
      title={title}
      className={className}
      src={youTubeEmbedUrl(videoId, start, end)}
      allow="autoplay; encrypted-media; fullscreen"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  )
}

function youTubeEmbedUrl(id: string, start?: number, end?: number): string {
  const p = new URLSearchParams({ enablejsapi: '1', rel: '0', playsinline: '1', modestbranding: '1', origin: location.origin })
  if (start != null) p.set('start', String(start))
  if (end != null) p.set('end', String(end))
  return `https://www.youtube-nocookie.com/embed/${id}?${p}`
}
