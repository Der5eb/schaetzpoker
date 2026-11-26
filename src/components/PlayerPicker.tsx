import { useState } from 'react'
import { createPlayer, deletePlayer } from '../lib/data'
import type { Player } from '../lib/types'
import { ConfirmDialog } from './ConfirmDialog'
import { Icon } from './Icon'

/** Spieler am Tisch an- und abwählen, neue Namen anlegen, alte löschen. */
export function PlayerPicker({
  players,
  selected,
  onChange,
  onPlayersChange,
}: {
  players: Player[]
  selected: string[]
  onChange: (ids: string[]) => void
  onPlayersChange: (players: Player[]) => void
}) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<Player | null>(null)

  const isSelected = (id: string) => selected.includes(id)
  const toggle = (id: string) => onChange(isSelected(id) ? selected.filter((x) => x !== id) : [...selected, id])

  async function add() {
    const trimmed = name.trim()
    if (!trimmed) return
    setError(null)
    // Gibt es den Namen schon, wird er einfach ausgewählt
    const existing = players.find((p) => p.name.trim().toLocaleLowerCase('de') === trimmed.toLocaleLowerCase('de'))
    if (existing) {
      if (!isSelected(existing.id)) onChange([...selected, existing.id])
      setName('')
      return
    }
    setBusy(true)
    try {
      const player = await createPlayer(trimmed)
      onPlayersChange([...players, player].sort((a, b) => a.name.localeCompare(b.name, 'de')))
      onChange([...selected, player.id])
      setName('')
    } catch (e) {
      console.error(e)
      setError('Spieler konnte nicht angelegt werden.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(player: Player) {
    setError(null)
    try {
      await deletePlayer(player.id)
      onPlayersChange(players.filter((p) => p.id !== player.id))
      if (isSelected(player.id)) onChange(selected.filter((x) => x !== player.id))
    } catch (e) {
      console.error(e)
      setError('Spieler konnte nicht gelöscht werden.')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {players.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {players.map((p) =>
            editing ? (
              <button
                key={p.id}
                type="button"
                onClick={() => setToDelete(p)}
                aria-label={`${p.name} löschen`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-danger/40 px-3.5 py-2 text-sm font-medium text-cream-200 transition-colors hover:bg-danger/10"
              >
                {p.name} <Icon name="x" weight="bold" className="size-3.5 text-danger" />
              </button>
            ) : (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                aria-pressed={isSelected(p.id)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                  isSelected(p.id)
                    ? 'border-gold-400/70 bg-gold-400/15 text-cream-50'
                    : 'border-white/10 text-cream-400 hover:border-white/20 hover:text-cream-100'
                }`}
              >
                {isSelected(p.id) && <Icon name="check" weight="bold" className="size-3.5 text-gold-300" />}
                {p.name}
              </button>
            ),
          )}
        </div>
      )}

      {!editing && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input
            className="field"
            aria-label="Neuer Spieler"
            placeholder={players.length ? 'Weiterer Name' : 'Name'}
            autoCapitalize="words"
            autoComplete="off"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn btn-ghost shrink-0" disabled={busy || !name.trim()} aria-label="Spieler hinzufügen">
            <Icon name="plus" weight="bold" className="size-5" />
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {players.length > 0 && (
        <button
          type="button"
          className="min-h-11 self-start text-sm text-cream-400 underline-offset-4 hover:text-cream-100 hover:underline"
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Fertig' : 'Namen löschen …'}
        </button>
      )}

      <ConfirmDialog
        open={!!toDelete}
        danger
        title={`„${toDelete?.name}“ löschen?`}
        confirmLabel="Löschen"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          const p = toDelete
          setToDelete(null)
          if (p) remove(p)
        }}
      >
        Die App vergisst dann, welche Fragen {toDelete?.name} schon kennt.
      </ConfirmDialog>
    </div>
  )
}
