// Supabase Edge Function "suggest"
// Schlägt per Google Gemini eine Überschrift und eine Kategorie für eine Schätzfrage vor.
//
// Benötigte Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   GEMINI_API_KEY  – Schlüssel aus https://aistudio.google.com/apikey
//   GEMINI_MODEL    – optional, Standard: gemini-flash-lite-latest (mit automatischen Ausweichmodellen)
//
// Die Funktion prüft selbst, ob ein angemeldeter Benutzer anfragt
// ("Verify JWT" kann deshalb ausgeschaltet bleiben).

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

async function isLoggedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization')
  const apikey = req.headers.get('apikey')
  const url = Deno.env.get('SUPABASE_URL')
  if (!auth || !apikey || !url) return false
  const res = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey } })
  return res.ok
}

interface Body {
  question?: string
  hint1?: string
  hint2?: string
  answer?: string
  explanation?: string
  categories?: string[]
}

function buildPrompt(b: Body): string {
  const categories = (b.categories ?? []).filter(Boolean)
  return `Du hilfst beim Sortieren von Schätzfragen für ein Quiz-Pokerspiel. Die Antwort ist immer eine Zahl.

Aufgabe:
1. "title": eine kurze, prägnante Überschrift auf Deutsch (2–5 Wörter). Sie beschreibt das Thema und darf die Lösung NICHT verraten.
2. "category": eine Kategorie.
   ${
     categories.length
       ? `Bestehende Kategorien: ${categories.map((c) => `"${c}"`).join(', ')}.
   Verwende exakt eine davon, wenn sie halbwegs passt.`
       : 'Es gibt noch keine Kategorien.'
   }
   Nur wenn keine passt: schlage eine neue, eher breite Kategorie vor (1–2 Wörter),
   z. B. Geografie, Geschichte, Natur, Tiere, Sport, Technik, Wissenschaft, Essen & Trinken,
   Popkultur, Musik, Film & TV, Wirtschaft, Politik, Körper & Gesundheit, Alltag.

Frage: ${b.question ?? ''}
Hinweis 1: ${b.hint1 ?? ''}
Hinweis 2: ${b.hint2 ?? ''}
Lösung: ${b.answer ?? ''}
Erklärung: ${b.explanation ?? ''}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Nur POST' }, 405)
  if (!(await isLoggedIn(req))) return json({ error: 'Nicht angemeldet' }, 401)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'GEMINI_API_KEY fehlt in den Supabase-Secrets' }, 500)
  const model = Deno.env.get('GEMINI_MODEL') || FALLBACK_MODELS[0]

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400)
  }
  if (!body.question?.trim()) return json({ error: 'Frage fehlt' }, 400)

  const request = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(body) }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { title: { type: 'STRING' }, category: { type: 'STRING' } },
        required: ['title', 'category'],
      },
    },
  })

  // Ist ein Modell überlastet oder nicht verfügbar, wird das nächste probiert.
  // Erstes Modell bei kurzzeitiger Überlastung einmal wiederholen.
  const attempts = [model, model, ...FALLBACK_MODELS.filter((m) => m !== model)]
  const errors: string[] = []
  for (const [i, m] of attempts.entries()) {
    if (i === 1) await new Promise((r) => setTimeout(r, 1200))
    const result = await askGemini(m, apiKey, request)
    if ('title' in result) return json({ ...result, model: m })
    errors.push(`${m}: ${result.error}`)
    console.error('Gemini-Fehler', m, result.error)
    if (!result.retry) break
  }
  return json({ error: `Gemini nicht verfügbar – ${errors.join(' | ')}` }, 502)
})

// Reihenfolge: schnelles "Lite"-Modell zuerst – für Überschrift + Kategorie reicht es völlig.
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.8-flash']

type GeminiResult = { title: string; category: string } | { error: string; retry: boolean }

async function askGemini(model: string, apiKey: string, request: string): Promise<GeminiResult> {
  let res: Response
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: request,
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    return { error: `keine Antwort (${e instanceof Error ? e.name : 'Fehler'})`, retry: true }
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    const message = String(detail?.error?.message ?? '').slice(0, 120)
    // 400/401/403 = Schlüssel oder Anfrage falsch → andere Modelle helfen nicht
    const retry = ![400, 401, 403].includes(res.status)
    return { error: `${res.status} ${message}`.trim(), retry }
  }

  const data = await res.json()
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? []
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join('')
  try {
    const out = JSON.parse(text)
    const title = String(out.title ?? '').trim()
    const category = String(out.category ?? '').trim()
    if (!title || !category) return { error: 'leere Antwort', retry: true }
    return { title, category }
  } catch {
    return { error: 'unerwartetes Antwortformat', retry: true }
  }
}
