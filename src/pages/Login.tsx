import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ChipMark } from '../components/ChipMark'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function Login() {
  const { session } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (session) return <Navigate to={from} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Anmeldung fehlgeschlagen. E-Mail und Passwort prüfen.')
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <div className="animate-focus-in mb-10 flex flex-col items-center gap-5 text-center">
        <ChipMark className="size-20 drop-shadow-[0_10px_18px_rgba(0,0,0,0.55)]" />
        <h1 className="wordmark text-5xl">
          Schätz<em>poker</em>
        </h1>
      </div>
      <form onSubmit={submit} className="animate-enter flex flex-col gap-4 [animation-delay:150ms]">
        <label className="flex flex-col gap-1.5">
          <span className="label">E-Mail</span>
          <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Passwort</span>
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary mt-3 py-3.5 text-base">
          {busy ? 'Anmelden …' : 'Anmelden'}
        </button>
      </form>
    </div>
  )
}
