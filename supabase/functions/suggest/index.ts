// Supabase Edge Function "suggest"
// Schlägt per Google Gemini eine Überschrift und eine Kategorie für eine Schätzfrage vor.
//
// Benötigte Secrets (Supabase Dashboard → Edge Functions → Secrets):
//   GEMINI_API_KEY  – Schlüssel aus https://aistudio.google.com/apikey
//   GEMINI_MODEL    – optional, Standard: gemini-flash-latest
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
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400)
  }
  if (!body.question?.trim()) return json({ error: 'Frage fehlt' }, 400)

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
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
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    console.error('Gemini-Fehler', res.status, detail)
    return json({ error: `Gemini antwortet mit ${res.status}` }, 502)
  }

  const data = await res.json()
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? []
  const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join('')
  try {
    const out = JSON.parse(text)
    return json({ title: String(out.title ?? '').trim(), category: String(out.category ?? '').trim() })
  } catch {
    console.error('Unerwartete Gemini-Antwort', text)
    return json({ error: 'Unerwartete KI-Antwort' }, 502)
  }
})
