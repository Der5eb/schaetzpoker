import type { RealtimeChannel } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { DisplayState, VideoCommand } from './types'

// Verbindung TV ↔ Spielleitung über einen Supabase-Realtime-Kanal.
// Die Spielleitung schickt nur aufgedeckte Inhalte; der TV braucht kein Login.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

function channelName(code: string) {
  return `schaetzpoker-${code}`
}

function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}

/** TV-Seite: empfängt Anzeige und Video-Befehle. */
export function useTvRoom(
  code: string,
  onDisplay: (d: DisplayState) => void,
  onVideo: (c: VideoCommand) => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false)
  const displayRef = useLatest(onDisplay)
  const videoRef = useLatest(onVideo)

  useEffect(() => {
    if (!supabase || !code) return
    const client = supabase
    const ch = client.channel(channelName(code), { config: { broadcast: { self: false }, presence: { key: 'tv' } } })
    ch.on('broadcast', { event: 'display' }, ({ payload }) => displayRef.current(payload as DisplayState))
    ch.on('broadcast', { event: 'video' }, ({ payload }) => videoRef.current(payload as VideoCommand))
    ch.subscribe((status) => {
      setConnected(status === 'SUBSCRIBED')
      if (status === 'SUBSCRIBED') {
        ch.track({ role: 'tv' })
        // Spielleitung um den aktuellen Stand bitten (z. B. nach Neuladen)
        ch.send({ type: 'broadcast', event: 'hello', payload: {} })
      }
    })
    return () => {
      client.removeChannel(ch)
    }
  }, [code, displayRef, videoRef])

  return { connected }
}

/**
 * Spielleitung: schickt die Anzeige bei jeder Änderung an den TV
 * (und erneut, wenn sich der TV meldet), sieht ob der TV verbunden ist.
 */
export function useGmRoom(code: string | null, display: DisplayState | null) {
  const [tvOnline, setTvOnline] = useState(false)
  const channel = useRef<RealtimeChannel | null>(null)
  const displayRef = useLatest(display)

  useEffect(() => {
    if (!supabase || !code) return
    const client = supabase
    const ch = client.channel(channelName(code), { config: { broadcast: { self: false } } })
    const push = () => {
      if (displayRef.current) ch.send({ type: 'broadcast', event: 'display', payload: displayRef.current })
    }
    ch.on('broadcast', { event: 'hello' }, push)
    ch.on('presence', { event: 'sync' }, () => setTvOnline('tv' in ch.presenceState()))
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.current = ch
        push()
      }
    })
    return () => {
      channel.current = null
      setTvOnline(false)
      client.removeChannel(ch)
    }
  }, [code, displayRef])

  useEffect(() => {
    if (display) channel.current?.send({ type: 'broadcast', event: 'display', payload: display })
  }, [display])

  const sendVideo = useCallback((c: VideoCommand) => {
    channel.current?.send({ type: 'broadcast', event: 'video', payload: c })
  }, [])

  return { tvOnline, sendVideo }
}
