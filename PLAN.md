# Schätzpoker – Projektplan

## Spielidee
Eine Schätzfrage wird gestellt, alle notieren eine Zahl. Gesetzt wird wie bei Texas Hold'em
(echte Chips, die App zählt nichts). Statt Flop/Turn/River gibt es zwei Hinweise und die Lösung.

**Ablauf einer Runde**
```
Kategorie wählen (Big Blind) → Spielleitung wählt Frage → Frage → Schätzung notieren
→ Setzrunde 1 → Hinweis 1 → Setzrunde 2 → Hinweis 2 → Setzrunde 3
→ Auflösung (+ Erklärung/Medien) → Setzrunde 4 → Showdown (nächste Schätzung gewinnt)
```
- Ist nur noch ein Spieler übrig → direkt zur Auflösung springen.
- Nach je 3 Fragen steigen die Blinds (Standard: verdoppeln, pro Abend und während des Abends anpassbar).
- Ca. 10 Fragen pro Abend.

## Ansichten (eine Web-App, PWA)
| Ansicht | Gerät | Zweck |
|---|---|---|
| Erfassen & Bibliothek | Smartphone | Fragen mit 2 Hinweisen, Lösung (Zahl + Einheit), Notizen, Medien. KI schlägt Überschrift & Kategorie vor. |
| Präsentation | Laptop/TV | Vollbild-Folien: Kategorien (nur mit verbleibenden Fragen), Frage, Hinweise, Auflösung, Blind-Level. Reine Anzeige. |
| Spielleitung | Smartphone | Fernbedienung, sieht Lösung/Notizen/Hinweise, wählt Frage, steuert YouTube-Videos. Kopplung per QR-Code. |

## Medien
- Bilder: Upload, clientseitig verkleinert (Supabase Storage).
- Videos: YouTube-Link mit Start-/Endzeit (kein Upload).
- Möglich in Frage, Hinweis 1, Hinweis 2 und Auflösung.

## Technik (0 €)
- React + TypeScript + Vite + Tailwind, PWA
- Supabase (Free): Postgres mit Row Level Security (jede Spielleitung sieht nur eigene Fragen), Auth, Storage, Realtime
- KI: Google Gemini (Free Tier) über Supabase Edge Function
- Hosting: GitHub Pages

## Etappen
1. Setup: Projekt, Datenbankschema mit Benutzertrennung, Login, Hosting
2. Erfassen & Bibliothek inkl. Medien, KI-Vorschläge, Kategorien verwalten
3. Präsentation: Spielabend mit Blind-Struktur, Kategorie-Auswahl, Phasen, Vollbild
4. Spielleitung & Sync: QR-Kopplung, Fernbedienung, Video-Steuerung
5. Später-Liste:
   - Antwortmaske pro Spieler + Zahlenstrahl beim Showdown
   - ✓ Chip-Stände: Spielleitung tippt Aktionen in Tischreihenfolge (checkt, geht mit, erhöht auf …, steigt aus),
     beim Showdown den Gewinner; App rechnet wer dran ist, Blinds, All-in, Nebentöpfe.
     Inkl. Sitzreihenfolge, Big-Blind-Anzeige, Ausscheiden. TV zeigt die Stände am unteren Rand
   - ✓ Spieler pro Abend: Die App merkt sich, wer welche Frage kennt, und bietet nur für alle neue Fragen an
   - Statistiken, Backup-Export/-Import
   - Weitere Spielleitung mit eigenem Account
   - Gemeinsamer Fragenpool mehrerer Accounts: Die Spielleitung moderiert nur und bietet nicht mit.
     Andere Accounts (mit eigener Bibliothek) können als Spieler am Tisch sitzen. Gespielt werden
     Fragen aus allen Bibliotheken, die für alle Spieler am Tisch neu sind – wer eine Frage selbst
     angelegt hat, kennt sie. Also: die eigenen Fragen der Spielleitung plus Fragen von Accounts, die
     an diesem Abend nicht mitspielen. Beispiel: A leitet, B und C spielen mit → Fragen von A und D.
     Braucht: Freigabe der Fragen zwischen Accounts (Datenbank-Regeln), Verknüpfung Spieler ↔ Account
