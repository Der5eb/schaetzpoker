import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { ActionBar, Shell } from '../components/Shell'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

const MIN_LENGTH = 6

/** Eigenes Passwort ändern – z. B. nachdem jemand anderes den Zugang angelegt hat. */
export function Password() {
  const { session } = useAuth()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const tooShort = password.length > 0 && password.length < MIN_LENGTH
  const mismatch = repeat.length > 0 && password !== repeat

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || password.length < MIN_LENGTH || password !== repeat) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (!error) {
      setDone(true)
      return
    }
    console.error(error)
    if (error.code === 'same_password') setError('Das ist schon dein aktuelles Passwort.')
    else if (error.code === 'weak_password') setError('Dieses Passwort ist zu schwach. Bitte ein längeres wählen.')
    else if (error.code === 'reauthentication_needed')
      setError('Aus Sicherheitsgründen bitte einmal ab- und wieder anmelden, dann erneut versuchen.')
    else setError('Passwort konnte nicht geändert werden. Internet prüfen und erneut versuchen.')
  }

  if (done) {
    return (
      <Shell title="Passwort ändern" back="/">
        <div className="animate-enter flex flex-col items-center gap-5 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-ok/12 text-ok">
            <Icon name="check" weight="bold" className="size-8" />
          </span>
          <p className="max-w-[30ch] text-cream-200">
            Passwort geändert. Ab jetzt meldest du dich mit dem neuen Passwort an – auf allen Geräten.
          </p>
          <Link to="/" className="btn btn-primary w-full py-3.5 text-base">
            Zur Startseite
          </Link>
        </div>
      </Shell>
    )
  }

  return (
    <Shell title="Passwort ändern" back="/">
      <form id="password-form" onSubmit={submit} className="flex flex-col gap-5 pb-32">
        <p className="text-sm leading-relaxed text-cream-300">
          Angemeldet als <span className="font-medium text-cream-100">{session?.user.email}</span>.
        </p>
        {/* Für Passwort-Manager: zu welchem Konto das neue Passwort gehört */}
        <input type="email" autoComplete="username" value={session?.user.email ?? ''} readOnly hidden />

        <label className="flex flex-col gap-1.5">
          <span className="label">Neues Passwort</span>
          <span className="relative">
            <input
              className="field pr-14"
              type={visible ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={MIN_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
            />
            <button
              type="button"
              className="btn btn-icon absolute top-1/2 right-1 -translate-y-1/2 text-cream-400 hover:text-cream-100"
              aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'}
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
            >
              <Icon name={visible ? 'eyeOff' : 'eye'} className="size-5" />
            </button>
          </span>
          <span id="password-hint" className={`text-sm ${tooShort ? 'text-danger' : 'text-cream-400'}`}>
            Mindestens {MIN_LENGTH} Zeichen
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="label">Neues Passwort wiederholen</span>
          <input
            className="field"
            type={visible ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
          {mismatch && <span className="text-sm text-danger">Die beiden Passwörter sind nicht gleich.</span>}
        </label>
      </form>

      <ActionBar>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          form="password-form"
          className="btn btn-primary w-full py-3.5 text-base"
          disabled={busy || password.length < MIN_LENGTH || password !== repeat}
        >
          {busy ? 'Speichert …' : 'Passwort speichern'}
        </button>
      </ActionBar>
    </Shell>
  )
}
