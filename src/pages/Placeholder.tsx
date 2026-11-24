import { Shell } from '../components/Shell'

/** Platzhalter für Ansichten, die in späteren Etappen gebaut werden. */
export function Placeholder({ title, stage }: { title: string; stage: string }) {
  return (
    <Shell title={title} back="/">
      <p className="text-cream-300">Kommt in {stage}.</p>
    </Shell>
  )
}
