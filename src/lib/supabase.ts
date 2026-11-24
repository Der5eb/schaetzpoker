import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined

/** null, solange .env noch nicht ausgefüllt ist – die App zeigt dann eine Einrichtungs-Hilfe. */
export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null

export const MEDIA_BUCKET = 'media'
