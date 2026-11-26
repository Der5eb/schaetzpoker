// Spiegelt supabase/schema.sql wider.
import type { GameState } from '../game/types'

export type Media =
  | { type: 'image'; path: string; caption?: string }
  | { type: 'youtube'; videoId: string; start?: number; end?: number; caption?: string }

export type QuestionStatus = 'draft' | 'ready'

export interface Category {
  id: string
  owner_id: string
  name: string
  color: string
  sort_order: number
  created_at: string
}

export interface Question {
  id: string
  owner_id: string
  category_id: string | null
  title: string
  question: string
  question_media: Media[]
  hint1: string
  hint1_media: Media[]
  hint2: string
  hint2_media: Media[]
  answer: number | null
  answer_unit: string
  answer_display: string
  explanation: string
  explanation_media: Media[]
  notes: string
  source: string
  status: QuestionStatus
  played_at: string | null
  created_at: string
  updated_at: string
}

export interface BlindLevel {
  small: number
  big: number
}

export interface Game {
  id: string
  owner_id: string
  room_code: string
  name: string
  blind_levels: BlindLevel[]
  questions_per_level: number
  current_level: number
  state: GameState
  started_at: string
  finished_at: string | null
  /** Wer gerade am Tisch sitzt (fehlt, solange Datenbank-Update 002 nicht eingespielt ist) */
  player_ids?: string[]
}

export interface Player {
  id: string
  owner_id: string
  name: string
  created_at: string
}

/** Eine an einem Abend gespielte Frage – und wer dabei war (leer = unbekannt). */
export interface PlayRecord {
  game_id: string
  question_id: string
  played_at: string
  player_ids: string[]
}
