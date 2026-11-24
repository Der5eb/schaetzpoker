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
        <div key={m.type === 'image' ? m.path : `${m.videoId}-${i}`} className="flex gap-3 rounded-lg border border-felt-700 bg-felt-900/60 p-2">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-felt-950">
            <img
              src={m.type === 'image' ? mediaUrl(m.path) : youTubeThumbnail(m.videoId)}
              alt=""
              className="size-full object-cover"
            />
            {m.type === 'youtube' && (
              <span className="absolute inset-0 grid place-items-center text-cream-50">
                <span className="rounded-full bg-chip-red p-1.5"><Icon name="play" className="size-4" /></span>
              </span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <input
              className="field py-1.5 text-sm"
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
          <button type="button" onClick={() => remove(i)} aria-label="Entfernen" className="self-start rounded-full p-1.5 text-cream-300 hover:bg-felt-700 hover:text-cream-50">
            <Icon name="x" className="size-4" />
          </button>
        </div>
      ))}

      {uploading > 0 && <p className="text-sm text-cream-300">Bild wird hochgeladen …</p>}
      {error && <p className="text-sm text-chip-red">{error}</p>}

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
          <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm font-medium" onClick={() => fileInput.current?.click()}>
            <Icon name="image" className="size-4" /> Bild
          </button>
          <button type="button" className="btn btn-ghost px-3 py-1.5 text-sm font-medium" onClick={() => setYtOpen(true)}>
            <Icon name="play" className="size-4" /> YouTube
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
      <span className="text-cream-300">{label}</span>
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
    <div className="flex flex-col gap-2 rounded-lg border border-felt-700 bg-felt-900/60 p-3">
      <input
        className="field"
        placeholder="YouTube-Link einfügen"
        inputMode="url"
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      {url && !parsed && <p className="text-sm text-chip-red">Kein gültiger YouTube-Link.</p>}
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
