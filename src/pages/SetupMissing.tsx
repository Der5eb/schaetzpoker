import { ChipMark } from '../components/ChipMark'

export function SetupMissing() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-5">
      <ChipMark className="size-14" />
      <h1 className="font-display text-4xl font-extrabold text-cream-50">Fast geschafft</h1>
      <p className="leading-relaxed text-cream-300">
        Die Verbindung zur Datenbank fehlt noch. Lege im Projektordner eine Datei <code className="text-gold-200">.env</code> an
        (Vorlage: <code className="text-gold-200">.env.example</code>) und trage die Werte aus deinem Supabase-Projekt ein. Die
        Schritte stehen in <code className="text-gold-200">SETUP.md</code>.
      </p>
    </div>
  )
}
