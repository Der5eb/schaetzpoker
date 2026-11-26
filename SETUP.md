# Einrichtung

Einmalig, ca. 15 Minuten. Alles kostenlos, keine Kreditkarte nötig.

## 1. Supabase (Datenbank, Login, Bilder)

1. Auf https://supabase.com mit GitHub anmelden → **New project**.
   Name z. B. `schaetzpoker`, Region **Frankfurt (eu-central-1)**, ein Datenbank-Passwort vergeben (wird später nicht gebraucht).
2. Links **SQL Editor** → **New query** → Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen → **Run**.
3. Eigenen Benutzer anlegen: **Authentication → Users → Add user → Create new user**.
   E-Mail + Passwort eintragen, Haken bei **Auto Confirm User** setzen.
4. Fremde Registrierungen abschalten: **Authentication → Sign In / Providers** → **Allow new users to sign up** ausschalten.
5. Zugangsdaten holen: **Project Settings → API Keys** (bzw. **Data API**).
   - Project URL
   - **publishable** Key (heißt in älteren Projekten **anon public**)

> Hinweis: Kostenlose Supabase-Projekte werden nach ca. 7 Tagen ohne Nutzung pausiert.
> Im Dashboard reaktivierst du sie mit einem Klick, die Daten bleiben erhalten.

## 2. Lokal starten

```bash
cp .env.example .env
```
URL und Key in `.env` eintragen, dann:

```bash
npm install
```

```bash
npm run dev
```

Die App läuft dann unter http://localhost:5173. Mit `npm run dev -- --host` ist sie auch vom Handy im selben WLAN erreichbar.

## 3. Online stellen (GitHub Pages)

GitHub Pages ist nur für **öffentliche** Repositories kostenlos. Das ist unkritisch:
Im Code stehen keine Fragen und keine Passwörter. Die Fragen liegen geschützt in Supabase,
der publishable Key ist dafür gedacht, öffentlich zu sein.

1. Auf GitHub ein neues, öffentliches Repository anlegen, z. B. `schaetzpoker`, und den Code hochladen.
2. Im Repository: **Settings → Secrets and variables → Actions → Variables** →
   `VITE_SUPABASE_URL` und `VITE_SUPABASE_KEY` anlegen (gleiche Werte wie in `.env`).
3. **Settings → Pages → Source: GitHub Actions**.
4. Jeder Push auf `main` baut und veröffentlicht die App unter
   `https://<dein-github-name>.github.io/schaetzpoker/`.
5. In Supabase unter **Authentication → URL Configuration** diese Adresse als **Site URL** eintragen.

## 4. KI-Vorschläge (Überschrift & Kategorie)

1. Auf https://aistudio.google.com/apikey mit einem Google-Konto anmelden → **Create API key**.
   Den Schlüssel kopieren (er bleibt geheim, nicht ins Repo schreiben).
2. Supabase Dashboard → **Edge Functions → Secrets** → **Add new secret**:
   Name `GEMINI_API_KEY`, Wert = der kopierte Schlüssel.
3. Funktion anlegen – eine der beiden Varianten:
   - **Im Browser:** **Edge Functions → Deploy a new function → Via Editor**, Name `suggest`,
     den Inhalt von [`supabase/functions/suggest/index.ts`](supabase/functions/suggest/index.ts) einfügen → **Deploy**.
     Danach in den Einstellungen der Funktion **Verify JWT / Enforce JWT verification** ausschalten
     (die Funktion prüft das Login selbst).
   - **Im Terminal:** einmalig `npx supabase login`, dann
     `npx supabase functions deploy suggest --no-verify-jwt --project-ref <projekt-id>`
     (die Projekt-ID ist der vordere Teil deiner Supabase-URL).

Ohne diese Funktion klappt alles andere trotzdem – Überschrift und Kategorie trägst du dann selbst ein.
Ist Gemini gerade überlastet (passiert im Free Tier gelegentlich), wird die Frage trotzdem gespeichert.
In der Bibliothek erscheint dann „Fragen ohne Kategorie → Einordnen“, um das später nachzuholen.
Kostenlos: Googles Free Tier reicht für Hunderte Vorschläge am Tag. Hinweis: Im Free Tier darf Google
die Eingaben zur Verbesserung seiner Modelle verwenden.

## 5. Aufs Handy

Die Adresse im Handy-Browser öffnen →
- **iPhone (Safari):** Teilen → *Zum Home-Bildschirm*
- **Android (Chrome):** Menü → *App installieren*

## 6. Datenbank-Updates

Neue Funktionen brauchen manchmal eine Ergänzung der Datenbank. Wer `schema.sql` **vor** einem Update eingespielt hat,
führt die Datei einmalig aus: **SQL Editor → New query** → Inhalt einfügen → **Run**.

| Datei | Wofür |
|---|---|
| [`supabase/updates/001-media-read-policy.sql`](supabase/updates/001-media-read-policy.sql) | Gelöschte Bilder werden auch wirklich entfernt |
| [`supabase/updates/002-players.sql`](supabase/updates/002-players.sql) | Spieler pro Abend: nur Fragen, die alle am Tisch noch nicht kennen |
