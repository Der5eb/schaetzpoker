import { uuid } from './format'
import { MEDIA_BUCKET, supabase } from './supabase'

const MAX_SIZE = 1600

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Verkleinert Fotos auf max. 1600 px und speichert sie als WebP (Fallback JPEG). */
export async function compressImage(file: File): Promise<Blob> {
  if (file.type === 'image/gif') return file // Animationen erhalten

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const webp = await toBlob(canvas, 'image/webp', 0.82)
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.85)
  if (!jpeg) throw new Error('Bild konnte nicht verarbeitet werden.')
  return jpeg
}

const EXT: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' }

/** Lädt ein Bild hoch und gibt den Speicherpfad zurück. */
export async function uploadImage(file: File): Promise<string> {
  if (!supabase) throw new Error('Supabase nicht konfiguriert')
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user.id
  if (!userId) throw new Error('Nicht angemeldet')

  const blob = await compressImage(file)
  const path = `${userId}/${uuid()}.${EXT[blob.type] ?? 'jpg'}`
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (error) throw error
  return path
}

export function mediaUrl(path: string): string {
  if (!supabase) return ''
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function deleteMediaFiles(paths: string[]): Promise<void> {
  if (!supabase || paths.length === 0) return
  await supabase.storage.from(MEDIA_BUCKET).remove(paths)
}
