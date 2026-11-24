import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
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
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <img src="./favicon.svg" alt="" className="mx-auto mb-6 size-20" />
      <h1 className="mb-8 text-center font-display text-3xl text-cream-50">Schätzpoker</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-cream-300">E-Mail</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-felt-600 bg-felt-800 px-3 py-2.5 text-cream-50 outline-none focus:border-gold-400"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-cream-300">Passwort</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-felt-600 bg-felt-800 px-3 py-2.5 text-cream-50 outline-none focus:border-gold-400"
          />
        </label>
        {error && <p className="text-sm text-chip-red">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-lg bg-gold-400 px-4 py-3 font-semibold text-felt-950 hover:bg-gold-300 disabled:opacity-60"
        >
          {busy ? 'Anmelden …' : 'Anmelden'}
        </button>
      </form>
    </div>
  )
}
