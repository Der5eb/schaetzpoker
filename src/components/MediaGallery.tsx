import { mediaUrl } from '../lib/media'
import type { VideoRegistry } from '../game/video'
import type { Media } from '../lib/types'


interface Props {
  media: Media[]
  /** Schlüssel-Präfix je Medium, z. B. (i) => `q-${i}` */
  keyFor: (i: number) => string
  registry: VideoRegistry
  className?: string
  /** Höhe von Bildern/Videos; in Hinweis-Karten kleiner */
  size?: 'lg' | 'sm'
}

/** Bilder und YouTube-Ausschnitte auf dem TV. */
export function MediaGallery({ media, keyFor, registry, className = '', size = 'lg' }: Props) {
  if (media.length === 0) return null
  const h = size === 'lg' ? 'max-h-[38vh]' : 'max-h-[26vh]'
  const vh = size === 'lg' ? 'h-[38vh]' : 'h-[26vh]'
  return (
    <div className={`flex min-h-0 flex-wrap items-start justify-center gap-[2vw] ${className}`}>
      {media.map((m, i) => (
        <figure key={keyFor(i)} className="flex min-h-0 max-w-full flex-col items-center gap-[0.6vw]">
          {m.type === 'image' ? (
            <img
              src={mediaUrl(m.path)}
              alt={m.caption ?? ''}
              className={`${h} max-w-full rounded-[0.8vw] object-contain shadow-2xl shadow-black/50`}
            />
          ) : (
            <iframe
              ref={(el) => {
                if (el) registry.set(keyFor(i), el)
                else registry.delete(keyFor(i))
              }}
              title={m.caption ?? 'Video'}
              className={`aspect-video ${vh} max-w-full rounded-[0.8vw] bg-black shadow-2xl shadow-black/50`}
              src={youTubeEmbedUrl(m.videoId, m.start, m.end)}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          )}
          {m.caption && <figcaption className="text-[clamp(0.9rem,1.3vw,1.6rem)] text-cream-300">{m.caption}</figcaption>}
        </figure>
      ))}
    </div>
  )
}

function youTubeEmbedUrl(id: string, start?: number, end?: number): string {
  const p = new URLSearchParams({ enablejsapi: '1', rel: '0', playsinline: '1', modestbranding: '1' })
  if (start != null) p.set('start', String(start))
  if (end != null) p.set('end', String(end))
  return `https://www.youtube-nocookie.com/embed/${id}?${p}`
}
