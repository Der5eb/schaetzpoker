import { useLayoutEffect, useRef, useState } from 'react'
import { formatTime, parseTime } from '../lib/format'
import { mediaUrl, uploadImage } from '../lib/media'
import type { Media } from '../lib/types'
import { parseYouTube, youTubeThumbnail } from '../lib/youtube'
import { Icon } from './Icon'

interface Props {
  value: Media[]
  onChange: (media: Media[]) => void
  /** Bild wurde entfernt – Datei erst beim Speichern löschen. */
  onImageRemoved: (path: string) => void
}

/** Bilder und YouTube-Ausschnitte zu einer Frage, einem Hinweis oder der Auflösung. */
export function MediaEditor({ value, onChange, onImageRemoved }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ytOpen, setYtOpen] = useState(false)

  // Aktueller Stand für asynchrone Uploads
  const latest = useRef(value)
  useLayoutEffect(() => {
    latest.current = value
  }, [value])

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setError(null)
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1)
      try {
        const path = await uploadImage(file)
        const next: Media[] = [...latest.current, { type: 'image', path }]
        latest.current = next
        onChange(next)
      } catch (e) {
        console.error(e)
        setError('Bild konnte nicht hochgeladen werden. Internetverbindung prüfen.')
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  function update(i: number, patch: Partial<Media>) {
    onChange(value.map((m, j) => (j === i ? ({ ...m, ...patch } as Media) : m)))
  }

  function remove(i: number) {
    const m = value[i]
    if (m.type === 'image') onImageRemoved(m.path)
    onChange(value.filter((_, j) => j !== i))
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((m, i) => (
        <div
          key={m.type === 'image' ? m.path : `${m.videoId}-${i}`}
          className="animate-enter flex gap-3 rounded-2xl border border-white/[0.07] bg-felt-950/45 p-2.5"
        >
          <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-felt-950 ring-1 ring-white/10">
            <img
              src={m.type === 'image' ? mediaUrl(m.path) : youTubeThumbnail(m.videoId)}
              alt=""
              className="size-full object-cover"
            />
            {m.type === 'youtube' && (
              <span className="absolute inset-0 grid place-items-center bg-black/25 text-cream-50">
                <Icon name="youtube" weight="fill" className="size-7 text-[#ff3b30] drop-shadow" />
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              className="field py-2 text-sm"
              aria-label={m.type === 'image' ? `Bildunterschrift ${i + 1}` : `Beschreibung Video ${i + 1}`}
              placeholder={m.type === 'image' ? 'Bildunterschrift (optional)' : 'Beschreibung (optional)'}
              value={m.caption ?? ''}
              onChange={(e) => update(i, { caption: e.target.value })}
            />
            {m.type === 'youtube' && (
              <div className="flex items-center gap-2 text-sm">
                <TimeInput label="von" value={m.start} onChange={(start) => update(i, { start })} />
                <TimeInput label="bis" value={m.end} onChange={(end) => update(i, { end })} />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label={m.type === 'image' ? `Bild ${i + 1} entfernen` : `Video ${i + 1} entfernen`}
            className="grid size-11 shrink-0 place-items-center self-start rounded-full text-cream-400 transition-colors hover:bg-white/5 hover:text-cream-50"
          >
            <Icon name="x" className="size-4" />
          </button>
        </div>
      ))}

      {uploading > 0 && (
        <p className="flex items-center gap-2 text-sm text-cream-300">
          <Icon name="chip" weight="duotone" className="size-4 animate-spin text-gold-300" /> Bild wird hochgeladen …
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {ytOpen ? (
        <YouTubeForm
          onCancel={() => setYtOpen(false)}
          onAdd={(m) => {
            onChange([...value, m])
            setYtOpen(false)
          }}
        />
      ) : (
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost min-h-11 px-3.5 py-2 text-sm font-medium text-cream-200" onClick={() => fileInput.current?.click()}>
            <Icon name="image" weight="duotone" className="size-[1.1rem] text-gold-300" /> Bild
          </button>
          <button type="button" className="btn btn-ghost min-h-11 px-3.5 py-2 text-sm font-medium text-cream-200" onClick={() => setYtOpen(true)}>
            <Icon name="youtube" weight="duotone" className="size-[1.1rem] text-gold-300" /> YouTube
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </div>
      )}
    </div>
  )
}

function TimeInput({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState(formatTime(value))
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-cream-400">{label}</span>
      <input
        className="field w-20 px-2 py-1 text-sm"
        inputMode="numeric"
        placeholder="m:ss"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const v = parseTime(text)
          onChange(v)
          setText(formatTime(v))
        }}
      />
    </label>
  )
}

function YouTubeForm({ onAdd, onCancel }: { onAdd: (m: Media) => void; onCancel: () => void }) {
  const [url, setUrl] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const parsed = parseYouTube(url)

  function submit() {
    if (!parsed) return
    const s = parseTime(start) ?? parsed.start
    const e = parseTime(end)
    onAdd({ type: 'youtube', videoId: parsed.videoId, ...(s != null && { start: s }), ...(e != null && { end: e }) })
  }

  return (
    <div className="animate-enter flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-felt-950/45 p-3">
      <input
        className="field"
        placeholder="YouTube-Link einfügen"
        aria-label="YouTube-Link"
        inputMode="url"
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      {url && !parsed && <p className="text-sm text-danger">Kein gültiger YouTube-Link.</p>}
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1">
          <span className="label">Start (m:ss)</span>
          <input className="field" inputMode="numeric" placeholder={parsed?.start != null ? formatTime(parsed.start) : '0:00'} value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="label">Ende (m:ss)</span>
          <input className="field" inputMode="numeric" placeholder="optional" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost py-1.5 text-sm" onClick={onCancel}>Abbrechen</button>
        <button type="button" className="btn btn-primary py-1.5 text-sm" disabled={!parsed} onClick={submit}>Hinzufügen</button>
      </div>
    </div>
  )
}
