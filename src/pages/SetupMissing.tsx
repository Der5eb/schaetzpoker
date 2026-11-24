export function SetupMissing() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="font-display text-3xl text-cream-50">Fast geschafft</h1>
      <p className="text-cream-300">
        Die Verbindung zur Datenbank fehlt noch. Lege im Projektordner eine Datei <code>.env</code> an
        (Vorlage: <code>.env.example</code>) und trage die Werte aus deinem Supabase-Projekt ein. Die
        Schritte stehen in <code>SETUP.md</code>.
      </p>
    </div>
  )
}
